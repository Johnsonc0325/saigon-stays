CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  share_token TEXT NOT NULL,
  owner       TEXT NOT NULL DEFAULT 'shared',
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lists_token ON lists(share_token, deleted);

CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  list_id    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  priority   TEXT NOT NULL DEFAULT 'normal',
  note       TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id, deleted, position);
