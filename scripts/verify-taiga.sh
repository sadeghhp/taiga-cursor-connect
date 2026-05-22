#!/usr/bin/env bash
set -euo pipefail

API_URL="${TAIGA_API_URL:-http://localhost:9000/api/v1}"
USERNAME="${TAIGA_USERNAME:-admin}"
PASSWORD="${TAIGA_PASSWORD:-123123}"

echo "=== Login ==="
TOKEN=$(curl -sf -X POST "${API_URL%/}/auth" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"normal\",\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['auth_token'])")

echo "Token obtained (${#TOKEN} chars)"

echo "=== users/me ==="
curl -sf "${API_URL%/}/users/me" -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool | head -20

echo "=== From taiga-mcp container ==="
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e TAIGA_API_URL=http://host.docker.internal:9000/api/v1 \
  -e TAIGA_TOKEN="${TOKEN}" \
  taiga-mcp:local node -e \
  "import('axios').then(({default:a})=>a.get(process.env.TAIGA_API_URL+'/users/me',{headers:{Authorization:'Bearer '+process.env.TAIGA_TOKEN}}).then(r=>console.log('username:',r.data.username)))"
echo "OK"
