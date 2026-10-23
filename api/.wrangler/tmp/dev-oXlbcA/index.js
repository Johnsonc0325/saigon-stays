var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://johnsonc0325.github.io",
  "Access-Control-Allow-Headers": "Content-Type, X-Share-Token, X-Client-Name",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS }
  });
}
__name(json, "json");
function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}
__name(error, "error");
function id() {
  return crypto.randomUUID();
}
__name(id, "id");
function token() {
  return crypto.randomUUID().replaceAll("-", "");
}
__name(token, "token");
async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid_json");
  }
}
__name(body, "body");
function clientName(request) {
  return request.headers.get("X-Client-Name") || "";
}
__name(clientName, "clientName");
async function authorizedList(env, listId, shareToken) {
  return env.DB.prepare(
    "SELECT id FROM lists WHERE id = ? AND share_token = ? AND deleted = 0"
  ).bind(listId, shareToken).first();
}
__name(authorizedList, "authorizedList");
async function authorizedToken(env, shareToken) {
  return env.DB.prepare(
    "SELECT 1 FROM lists WHERE share_token = ? AND deleted = 0 LIMIT 1"
  ).bind(shareToken).first();
}
__name(authorizedToken, "authorizedToken");
function taskResponse(row) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    priority: row.priority,
    note: row.note,
    position: row.position,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}
__name(taskResponse, "taskResponse");
async function getLists(env, shareToken) {
  const lists = await env.DB.prepare(
    "SELECT id, name FROM lists WHERE share_token = ? AND deleted = 0 ORDER BY created_at, id"
  ).bind(shareToken).all();
  const result = [];
  for (const list of lists.results) {
    const tasks = await env.DB.prepare(
      "SELECT id, title, done, priority, note, position, updated_at, updated_by FROM tasks WHERE list_id = ? AND deleted = 0 ORDER BY position, updated_at, id"
    ).bind(list.id).all();
    result.push({ id: list.id, name: list.name, tasks: tasks.results.map(taskResponse) });
  }
  return result;
}
__name(getLists, "getLists");
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
      "SELECT COALESCE(MAX(updated_at), '') AS v FROM (SELECT updated_at FROM lists WHERE share_token = ? AND deleted = 0 UNION ALL SELECT t.updated_at FROM tasks t JOIN lists l ON l.id = t.list_id WHERE l.share_token = ? AND l.deleted = 0 AND t.deleted = 0)"
    ).bind(shareToken, shareToken).first();
    return json({ ok: true, serverVersion: last.v || "", lists });
  }
  if (method === "POST" && path === "/api/lists") {
    const input = await body(request);
    if (typeof input.name !== "string" || !input.name.trim()) return error("name_required");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const listId = id();
    await env.DB.prepare(
      "INSERT INTO lists (id, name, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(listId, input.name.trim(), shareToken, now, now).run();
    return json({ ok: true, list: { id: listId, name: input.name.trim(), tasks: [] } }, 201);
  }
  if (method === "POST" && path === "/api/tasks") {
    const input = await body(request);
    if (typeof input.listId !== "string" || !input.listId) return error("listId_required");
    if (typeof input.title !== "string") return error("title_required");
    if (input.priority !== void 0 && typeof input.priority !== "string") return error("invalid_priority");
    if (input.note !== void 0 && typeof input.note !== "string") return error("invalid_note");
    if (!await authorizedList(env, input.listId, shareToken)) return error("not_found", 404);
    const max = await env.DB.prepare(
      "SELECT COALESCE(MAX(position), -1) AS max_position FROM tasks WHERE list_id = ? AND deleted = 0"
    ).bind(input.listId).first();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const task = {
      id: id(),
      title: input.title,
      done: 0,
      priority: input.priority || "normal",
      note: input.note || "",
      position: Number(max.max_position) + 1,
      updatedAt: now,
      updatedBy: clientName(request)
    };
    await env.DB.prepare(
      "INSERT INTO tasks (id, list_id, title, done, priority, note, position, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(task.id, input.listId, task.title, task.done, task.priority, task.note, task.position, now, now, task.updatedBy).run();
    return json({ ok: true, task }, 201);
  }
  const listMatch = path.match(/^\/api\/lists\/([^/]+)$/);
  if (listMatch && (method === "PATCH" || method === "DELETE")) {
    const listId = listMatch[1];
    if (!await authorizedList(env, listId, shareToken)) return error("not_found", 404);
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
      "SELECT t.id FROM tasks t JOIN lists l ON l.id = t.list_id WHERE t.id = ? AND t.deleted = 0 AND l.share_token = ? AND l.deleted = 0"
    ).bind(taskId, shareToken).first();
    if (!taskRow) return error("not_found", 404);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (method === "DELETE") {
      await env.DB.prepare("UPDATE tasks SET deleted = 1, updated_at = ?, updated_by = ? WHERE id = ?").bind(now, clientName(request), taskId).run();
      return json({ ok: true });
    }
    const input = await body(request);
    const fields = [];
    const values = [];
    for (const field of ["title", "priority", "note", "position"]) {
      if (input[field] !== void 0) {
        if ((field === "title" || field === "priority" || field === "note") && typeof input[field] !== "string") return error(`invalid_${field}`);
        if (field === "position" && (!Number.isInteger(input[field]) || input[field] < 0)) return error("invalid_position");
        fields.push(`${field} = ?`);
        values.push(input[field]);
      }
    }
    if (input.done !== void 0) {
      if (typeof input.done !== "boolean" && input.done !== 0 && input.done !== 1) return error("invalid_done");
      fields.push("done = ?");
      values.push(input.done === true ? 1 : input.done);
    }
    if (!fields.length) return error("no_fields");
    fields.push("updated_at = ?", "updated_by = ?");
    values.push(now, clientName(request), taskId);
    await env.DB.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ ok: true });
  }
  if (method === "POST" && path === "/api/token/reset") {
    const newToken = token();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare("UPDATE lists SET share_token = ?, updated_at = ? WHERE share_token = ? AND deleted = 0").bind(newToken, now, shareToken).run();
    return json({ ok: true, shareToken: newToken });
  }
  return error("not_found", 404);
}
__name(handle, "handle");
var src_default = {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      if (err && err.message === "invalid_json") return error("invalid_json");
      return error("internal_error", 500);
    }
  }
};

// C:/Users/USER/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/USER/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    const body2 = JSON.stringify(error2);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body2);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body2, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-GGln17/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/USER/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-GGln17/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
