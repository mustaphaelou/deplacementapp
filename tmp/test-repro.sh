#!/bin/bash
set -e

cd ~/codeprojects/deplacementapp

export DATABASE_URL="postgresql://user:pass@localhost:5433/deplacementapp"
export BETTER_AUTH_SECRET="test-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
export BETTER_AUTH_URL="http://localhost:3001"

npx next start --port 3001 &
PID=$!
sleep 5

echo "--- Login ---"
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST "http://localhost:3001/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"employe@exemple.ma","password":"password123"}' 2>&1

echo "--- Dashboard ---"
curl -s -L -b /tmp/cookies.txt "http://localhost:3001/" 2>&1 | head -30

kill $PID 2>/dev/null