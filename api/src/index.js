// saigon-api — 待辦清單跨裝置同步後端
// Cloudflare Worker + D1，分享 token 認證（無帳號系統）

const PROD_ORIGIN = "https://johnsonc0325.github.io";

// 允許的來源：正式站 + 本機開發（8000/8788/8899 等任意 localhost 埠）
const ALLOWED_ORIGIN_RE = new RegExp(
  "^(https://johnsonc0325\\.github\\.io|http://(localhost|127\\.0\\.0\\.1)(:\\d+)?)$",
);

// 前端 saigon-lists-store.js 的 validPriorities 必須與此一致
const VALID_PRIORITIES = new Set(["high", "normal", "low"]);

const MAX_TITLE = 200;
const MAX_NAME = 40;
const MAX_NOTE = 500;

const BASE_CORS = {
  "Access-Control-Allow-Headers": "Content-Type, X-Share-Token, X-Client-Name",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function corsHeaders(origin) {
  return {
    ...BASE_CORS,
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN_RE.test(origin || "") ? origin : PROD_ORIGIN,
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function error(message, status, origin) {
  return json({ ok: false, error: message }, status || 400, origin);
}

function now() {
  return new Date().toISOString();
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function clientName(request) {
  return (request.headers.get("X-Client-Name") || "").slice(0, 60);
}

// 驗證並清理標題：拒絕空字串 / 純空白 / 超長
function cleanTitle(value) {
  if (typeof value !== "string") return { error: "title_required" };
  const title = value.trim();
  if (!title) return { error: "title_required" };
  if (title.length > MAX_TITLE) return { error: "title_too_long" };
  return { title };
}

async function authorizedList(env, listId, shareToken) {
  return env.DB.prepare(
    "SELECT id FROM lists WHERE id = ? AND share_token = ? AND deleted = 0",
  ).bind(listId, shareToken).first();
}

async function authorizedToken(env, shareToken) {
  return env.DB.prepare(
    "SELECT 1 FROM lists WHERE share_token = ? AND deleted = 0 LIMIT 1",
  ).bind(shareToken).first();
}

function taskResponse(row) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    priority: row.priority,
    note: row.note,
    position: row.position,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function getLists(env, shareToken) {
  const lists = await env.DB.prepare(
    "SELECT id, name FROM lists WHERE share_token = ? AND deleted = 0 ORDER BY created_at, id",
  ).bind(shareToken).all();
  const result = [];
  for (const list of lists.results) {
    const tasks = await env.DB.prepare(
      "SELECT id, title, done, priority, note, position, updated_at, updated_by " +
      "FROM tasks WHERE list_id = ? AND deleted = 0 ORDER BY position, updated_at, id",
    ).bind(list.id).all();
    result.push({ id: list.id, name: list.name, tasks: tasks.results.map(taskResponse) });
  }
  return result;
}

// serverVersion 必須反映「資料最後變動時間」，不能是當前時間，
// 否則前端每次輪詢都會誤判為「有更新」。
async function serverVersion(env, shareToken) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(MAX(updated_at), '') AS v FROM (" +
    "SELECT updated_at FROM lists WHERE share_token = ? AND deleted = 0 " +
    "UNION ALL " +
    "SELECT t.updated_at FROM tasks t JOIN lists l ON l.id = t.list_id " +
    "WHERE l.share_token = ? AND l.deleted = 0 AND t.deleted = 0)",
  ).bind(shareToken, shareToken).first();
  return (row && row.v) || "";
}

async function handle(request, env, origin) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (method === "GET" && path === "/api/health") return json({ ok: true }, 200, origin);

  const shareToken = request.headers.get("X-Share-Token");
  if (!shareToken) return error("unauthorized", 401, origin);
  if (!(await authorizedToken(env, shareToken))) return error("unauthorized", 401, origin);

  // ── 讀取全部清單 ────────────────────────────────────────────
  if (method === "GET" && path === "/api/lists") {
    const lists = await getLists(env, shareToken);
    return json({ ok: true, serverVersion: await serverVersion(env, shareToken), lists }, 200, origin);
  }

  // ── 建立清單 ───────────────────────────────────────────────
  if (method === "POST" && path === "/api/lists") {
    const input = await readBody(request);
    if (typeof input.name !== "string" || !input.name.trim()) return error("name_required", 400, origin);
    const name = input.name.trim();
    if (name.length > MAX_NAME) return error("name_too_long", 400, origin);
    const ts = now();
    const listId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO lists (id, name, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(listId, name, shareToken, ts, ts).run();
    return json({ ok: true, list: { id: listId, name, tasks: [] } }, 201, origin);
  }

  // ── 建立待辦 ───────────────────────────────────────────────
  if (method === "POST" && path === "/api/tasks") {
    const input = await readBody(request);
    if (typeof input.listId !== "string" || !input.listId) return error("listId_required", 400, origin);
    const cleaned = cleanTitle(input.title);
    if (cleaned.error) return error(cleaned.error, 400, origin);
    const priority = input.priority === undefined ? "normal" : input.priority;
    if (!VALID_PRIORITIES.has(priority)) return error("invalid_priority", 400, origin);
    if (input.note !== undefined && (typeof input.note !== "string" || input.note.length > MAX_NOTE)) {
      return error("invalid_note", 400, origin);
    }
    if (!(await authorizedList(env, input.listId, shareToken))) return error("not_found", 404, origin);

    const max = await env.DB.prepare(
      "SELECT COALESCE(MAX(position), -1) AS max_position FROM tasks WHERE list_id = ? AND deleted = 0",
    ).bind(input.listId).first();
    const ts = now();
    const task = {
      id: crypto.randomUUID(),
      title: cleaned.title,
      done: 0,
      priority,
      note: input.note || "",
      position: Number(max.max_position) + 1,
      updatedAt: ts,
      updatedBy: clientName(request),
    };
    await env.DB.prepare(
      "INSERT INTO tasks (id, list_id, title, done, priority, note, position, created_at, updated_at, updated_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(task.id, input.listId, task.title, task.done, task.priority, task.note,
      task.position, ts, ts, task.updatedBy).run();
    return json({ ok: true, task }, 201, origin);
  }

  // ── 清單：改名 / 刪除 ──────────────────────────────────────
  const listMatch = path.match(/^\/api\/lists\/([^/]+)$/);
  if (listMatch && (method === "PATCH" || method === "DELETE")) {
    const listId = listMatch[1];
    if (!(await authorizedList(env, listId, shareToken))) return error("not_found", 404, origin);
    const ts = now();

    if (method === "DELETE") {
      // 軟刪除要串連到其下的 tasks，避免留下永遠不會顯示、卻持續累積的孤兒資料
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE tasks SET deleted = 1, updated_at = ? WHERE list_id = ? AND deleted = 0",
        ).bind(ts, listId),
        env.DB.prepare("UPDATE lists SET deleted = 1, updated_at = ? WHERE id = ?").bind(ts, listId),
      ]);
      return json({ ok: true }, 200, origin);
    }

    const input = await readBody(request);
    if (typeof input.name !== "string" || !input.name.trim()) return error("name_required", 400, origin);
    const name = input.name.trim();
    if (name.length > MAX_NAME) return error("name_too_long", 400, origin);
    await env.DB.prepare("UPDATE lists SET name = ?, updated_at = ? WHERE id = ?").bind(name, ts, listId).run();
    return json({ ok: true, list: { id: listId, name } }, 200, origin);
  }

  // ── 待辦：更新 / 刪除 ──────────────────────────────────────
  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && (method === "PATCH" || method === "DELETE")) {
    const taskId = taskMatch[1];
    const owned = await env.DB.prepare(
      "SELECT t.id FROM tasks t JOIN lists l ON l.id = t.list_id " +
      "WHERE t.id = ? AND t.deleted = 0 AND l.share_token = ? AND l.deleted = 0",
    ).bind(taskId, shareToken).first();
    if (!owned) return error("not_found", 404, origin);
    const ts = now();

    if (method === "DELETE") {
      await env.DB.prepare(
        "UPDATE tasks SET deleted = 1, updated_at = ?, updated_by = ? WHERE id = ?",
      ).bind(ts, clientName(request), taskId).run();
      return json({ ok: true }, 200, origin);
    }

    const input = await readBody(request);
    const fields = [];
    const values = [];

    if (input.title !== undefined) {
      const cleaned = cleanTitle(input.title);
      if (cleaned.error) return error(cleaned.error, 400, origin);
      fields.push("title = ?"); values.push(cleaned.title);
    }
    if (input.priority !== undefined) {
      if (!VALID_PRIORITIES.has(input.priority)) return error("invalid_priority", 400, origin);
      fields.push("priority = ?"); values.push(input.priority);
    }
    if (input.note !== undefined) {
      if (typeof input.note !== "string" || input.note.length > MAX_NOTE) return error("invalid_note", 400, origin);
      fields.push("note = ?"); values.push(input.note);
    }
    if (input.position !== undefined) {
      if (!Number.isInteger(input.position) || input.position < 0) return error("invalid_position", 400, origin);
      fields.push("position = ?"); values.push(input.position);
    }
    if (input.done !== undefined) {
      if (typeof input.done !== "boolean" && input.done !== 0 && input.done !== 1) {
        return error("invalid_done", 400, origin);
      }
      fields.push("done = ?"); values.push(input.done === true || input.done === 1 ? 1 : 0);
    }
    if (!fields.length) return error("no_fields", 400, origin);

    fields.push("updated_at = ?", "updated_by = ?");
    values.push(ts, clientName(request), taskId);
    await env.DB.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ ok: true }, 200, origin);
  }

  // ── 重設分享 token ─────────────────────────────────────────
  if (method === "POST" && path === "/api/token/reset") {
    const newToken = crypto.randomUUID().replaceAll("-", "");
    await env.DB.prepare(
      "UPDATE lists SET share_token = ?, updated_at = ? WHERE share_token = ? AND deleted = 0",
    ).bind(newToken, now(), shareToken).run();
    return json({ ok: true, shareToken: newToken }, 200, origin);
  }

  return error("not_found", 404, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    try {
      return await handle(request, env, origin);
    } catch (err) {
      if (err && err.message === "invalid_json") return error("invalid_json", 400, origin);
      return error("internal_error", 500, origin);
    }
  },
};
