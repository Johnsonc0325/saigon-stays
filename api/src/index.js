const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://johnsonc0325.github.io",
  "Access-Control-Allow-Headers": "Content-Type, X-Share-Token, X-Client-Name",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function id() {
  return crypto.randomUUID();
}

function token() {
  return crypto.randomUUID().replaceAll("-", "");
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function clientName(request) {
  return request.headers.get("X-Client-Name") || "";
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
      "SELECT id, title, done, priority, note, position, updated_at, updated_by FROM tasks WHERE list_id = ? AND deleted = 0 ORDER BY position, updated_at, id",
    ).bind(list.id).all();
    result.push({ id: list.id, name: list.name, tasks: tasks.results.map(taskResponse) });
  }
  return result;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (method === "GET" && path === "/api/health") return json({ ok: true });

  const shareToken = request.headers.get("X-Share-Token");
  if (!shareToken) return error("unauthorized", 401);
  if (!await authorizedToken(env, shareToken)) return error("unauthorized", 401);

  if (method === "GET" && path === "/api/lists") {
    const lists = await getLists(env, shareToken);
    const last = await env.DB.prepare(
      "SELECT COALESCE(MAX(updated_at), '') AS v FROM (" +
      "SELECT updated_at FROM lists WHERE share_token = ? AND deleted = 0 " +
      "UNION ALL " +
      "SELECT t.updated_at FROM tasks t JOIN lists l ON l.id = t.list_id " +
      "WHERE l.share_token = ? AND l.deleted = 0 AND t.deleted = 0)",
    ).bind(shareToken, shareToken).first();
    return json({ ok: true, serverVersion: last.v || "", lists });
  }

  if (method === "POST" && path === "/api/lists") {
    const input = await body(request);
    if (typeof input.name !== "string" || !input.name.trim()) return error("name_required");
    const now = new Date().toISOString();
    const listId = id();
    await env.DB.prepare(
      "INSERT INTO lists (id, name, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(listId, input.name.trim(), shareToken, now, now).run();
    return json({ ok: true, list: { id: listId, name: input.name.trim(), tasks: [] } }, 201);
  }

  if (method === "POST" && path === "/api/tasks") {
    const input = await body(request);
    if (typeof input.listId !== "string" || !input.listId) return error("listId_required");
    if (typeof input.title !== "string") return error("title_required");
    if (input.priority !== undefined && typeof input.priority !== "string") return error("invalid_priority");
    if (input.note !== undefined && typeof input.note !== "string") return error("invalid_note");
    if (!await authorizedList(env, input.listId, shareToken)) return error("not_found", 404);
    const max = await env.DB.prepare(
      "SELECT COALESCE(MAX(position), -1) AS max_position FROM tasks WHERE list_id = ? AND deleted = 0",
    ).bind(input.listId).first();
    const now = new Date().toISOString();
    const task = {
      id: id(), title: input.title, done: 0, priority: input.priority || "normal",
      note: input.note || "", position: Number(max.max_position) + 1,
      updatedAt: now, updatedBy: clientName(request),
    };
    await env.DB.prepare(
      "INSERT INTO tasks (id, list_id, title, done, priority, note, position, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(task.id, input.listId, task.title, task.done, task.priority, task.note, task.position, now, now, task.updatedBy).run();
    return json({ ok: true, task }, 201);
  }

  const listMatch = path.match(/^\/api\/lists\/([^/]+)$/);
  if (listMatch && (method === "PATCH" || method === "DELETE")) {
    const listId = listMatch[1];
    if (!await authorizedList(env, listId, shareToken)) return error("not_found", 404);
    const now = new Date().toISOString();
    if (method === "DELETE") {
      await env.DB.prepare("UPDATE lists SET deleted = 1, updated_at = ? WHERE id = ?").bind(now, listId).run();
      return json({ ok: true });
    }
    const input = await body(request);
    if (typeof input.name !== "string" || !input.name.trim()) return error("name_required");
    await env.DB.prepare("UPDATE lists SET name = ?, updated_at = ? WHERE id = ?").bind(input.name.trim(), now, listId).run();
    return json({ ok: true, list: { id: listId, name: input.name.trim() } });
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && (method === "PATCH" || method === "DELETE")) {
    const taskId = taskMatch[1];
    const taskRow = await env.DB.prepare(
      "SELECT t.id FROM tasks t JOIN lists l ON l.id = t.list_id WHERE t.id = ? AND t.deleted = 0 AND l.share_token = ? AND l.deleted = 0",
    ).bind(taskId, shareToken).first();
    if (!taskRow) return error("not_found", 404);
    const now = new Date().toISOString();
    if (method === "DELETE") {
      await env.DB.prepare("UPDATE tasks SET deleted = 1, updated_at = ?, updated_by = ? WHERE id = ?").bind(now, clientName(request), taskId).run();
      return json({ ok: true });
    }
    const input = await body(request);
    const fields = [];
    const values = [];
    for (const field of ["title", "priority", "note", "position"]) {
      if (input[field] !== undefined) {
        if ((field === "title" || field === "priority" || field === "note") && typeof input[field] !== "string") return error(`invalid_${field}`);
        if (field === "position" && (!Number.isInteger(input[field]) || input[field] < 0)) return error("invalid_position");
        fields.push(`${field} = ?`); values.push(input[field]);
      }
    }
    if (input.done !== undefined) {
      if (typeof input.done !== "boolean" && input.done !== 0 && input.done !== 1) return error("invalid_done");
      fields.push("done = ?"); values.push(input.done === true ? 1 : input.done);
    }
    if (!fields.length) return error("no_fields");
    fields.push("updated_at = ?", "updated_by = ?"); values.push(now, clientName(request), taskId);
    await env.DB.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ ok: true });
  }

  if (method === "POST" && path === "/api/token/reset") {
    const newToken = token();
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE lists SET share_token = ?, updated_at = ? WHERE share_token = ? AND deleted = 0").bind(newToken, now, shareToken).run();
    return json({ ok: true, shareToken: newToken });
  }

  return error("not_found", 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      if (err && err.message === "invalid_json") return error("invalid_json");
      return error("internal_error", 500);
    }
  },
};
