# saigon API 部署與驗證

以下指令在專案根目錄執行。先確認已登入 Cloudflare：

```bash
npx wrangler login
npx wrangler d1 create saigon-db          # 取得 database_id
# 把 database_id 填進 api/wrangler.toml
npx wrangler d1 execute saigon-db --remote --file=api/schema.sql
cd api && npx wrangler deploy
```

Worker 部署完成後，記下 Worker 網址，例如 `https://saigon-api.<你的帳號>.workers.dev`，以下以環境變數表示：

```bash
BASE='https://saigon-api.<你的帳號>.workers.dev'
```

## 產生第一個分享 token

先產生 token：

```bash
TOKEN=$(openssl rand -hex 8)
# Windows PowerShell 也可用：
$TOKEN = node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

再產生 UUID 作為清單 id（也可自行使用其他唯一字串），並用 D1 插入第一筆清單。時間請使用目前的 UTC ISO 時間：

```bash
LIST_ID=$(node -e "console.log(require('crypto').randomUUID())")
NOW=$(node -e "console.log(new Date().toISOString())")
npx wrangler d1 execute saigon-db --remote --command "INSERT INTO lists (id, name, share_token, created_at, updated_at) VALUES ('$LIST_ID', '打包清單', '$TOKEN', '$NOW', '$NOW')"
```

請把 `TOKEN` 安全地交給兩位使用者；它就是共用清單的存取憑證。不要把 token 寫入公開 git repository。

## curl 驗證

健康檢查不需要 token：

```bash
curl -i "$BASE/api/health"
```

無 token 應為 401；錯 token 也應為 401：

```bash
curl -i "$BASE/api/lists"
curl -i -H 'X-Share-Token: wrong-token' "$BASE/api/lists"
```

驗證 CORS preflight：

```bash
curl -i -X OPTIONS "$BASE/api/lists" \
  -H 'Origin: https://johnsonc0325.github.io' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: X-Share-Token, Content-Type'
```

取得清單、建立清單與建立 task：

```bash
curl -i -H "X-Share-Token: $TOKEN" "$BASE/api/lists"
curl -i -X POST "$BASE/api/lists" -H "X-Share-Token: $TOKEN" -H 'Content-Type: application/json' -d '{"name":"行程清單"}'
curl -i -X POST "$BASE/api/tasks" -H "X-Share-Token: $TOKEN" -H 'Content-Type: application/json' -H 'X-Client-Name: 天樂' -d '{"listId":"LIST_ID","title":"護照","priority":"normal","note":"確認有效期"}'
```

把回應中的 id 代入下列指令：

```bash
curl -i -X PATCH "$BASE/api/lists/LIST_ID" -H "X-Share-Token: $TOKEN" -H 'Content-Type: application/json' -d '{"name":"最新行程清單"}'
curl -i -X PATCH "$BASE/api/tasks/TASK_ID" -H "X-Share-Token: $TOKEN" -H 'Content-Type: application/json' -d '{"done":true}'
curl -i -X DELETE "$BASE/api/tasks/TASK_ID" -H "X-Share-Token: $TOKEN"
curl -i -X DELETE "$BASE/api/lists/LIST_ID" -H "X-Share-Token: $TOKEN"
```

重設 token；回應會提供新 token，舊 token 之後應收到 401：

```bash
curl -i -X POST "$BASE/api/token/reset" -H "X-Share-Token: $TOKEN"
curl -i -H "X-Share-Token: $TOKEN" "$BASE/api/lists"
curl -i -H "X-Share-Token: NEW_TOKEN" "$BASE/api/lists"
```

`LIST_ID`、`TASK_ID`、`NEW_TOKEN` 都要替換成實際回應中的值。所有刪除都是軟刪除，API 的 GET 不會回傳已刪除資料。
