#!/usr/bin/env bash
set -u
cd ~/codeprojects/deplacementapp
echo "=== Files touched by OAuth commit c560263 ==="
git show --stat --oneline c560263 | head -20
echo ""
echo "=== docker-compose.yaml diff introduced by c560263 (oauth commit) ==="
git diff c560263~1 c560263 -- docker-compose.yaml
echo ""
echo "=== current migrator CMD in Dockerfile ==="
grep -n -E 'drizzle-kit|CMD' Dockerfile
echo ""
echo "=== logging config in current docker-compose.yaml ==="
grep -n -E 'logging:|max-size|max-file' docker-compose.yaml || echo "(no logging: block present)"
echo ""
echo "=== secrets present in current docker-compose.yaml ==="
grep -n -E 'POSTGRES_PASSWORD|NEXTAUTH_SECRET|DATABASE_URL' docker-compose.yaml | head -10
