#!/bin/bash

# expect2 MCP Test Script
# Usage: ./test.sh [command]
#   init     - Initialize a new session
#   verify   - Run verify_changes
#   status   - Get verification status
#   analyze  - Analyze failure
#   all      - Run all commands in sequence

BASE_URL="http://localhost:3000/mcp"
SESSION_FILE="/tmp/expect2-session"
HEADERS='-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream"'

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

get_session() {
  if [ -f "$SESSION_FILE" ]; then
    cat "$SESSION_FILE"
  else
    echo ""
  fi
}

cmd_init() {
  echo -e "${CYAN}Initializing session...${NC}"
  RESPONSE=$(curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-cli","version":"1.0"}}}')

  echo "$RESPONSE" | head -c 200
  echo ""
  echo -e "${GREEN}Session initialized. Check server console for session ID.${NC}"
  echo -e "${YELLOW}Enter session ID:${NC}"
  read SESSION_ID
  echo "$SESSION_ID" > "$SESSION_FILE"
  echo -e "${GREEN}Session saved: $SESSION_ID${NC}"
}

cmd_verify() {
  SESSION_ID=$(get_session)
  if [ -z "$SESSION_ID" ]; then
    echo "No session. Run: ./test.sh init"
    exit 1
  fi

  echo -e "${CYAN}Running verify_changes (streaming)...${NC}"
  echo -e "${YELLOW}Watch the server console for progress!${NC}"
  echo ""

  curl -N --no-buffer -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"verify_changes","arguments":{"projectPath":"/dreamrest-mattresses","changedFiles":["src/contexts/WishlistContext.tsx","src/components/WishlistButton.tsx","src/components/ProductCard.tsx","src/app/favorites/page.tsx","src/components/Header.tsx"]},"_meta":{"progressToken":"test_001"}}}'

  echo ""
}

cmd_status() {
  SESSION_ID=$(get_session)
  if [ -z "$SESSION_ID" ]; then
    echo "No session. Run: ./test.sh init"
    exit 1
  fi

  echo -e "${CYAN}Getting verification status...${NC}"
  echo ""

  curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_verification_status","arguments":{"sessionId":"sess_001"}}}'

  echo ""
}

cmd_analyze() {
  SESSION_ID=$(get_session)
  if [ -z "$SESSION_ID" ]; then
    echo "No session. Run: ./test.sh init"
    exit 1
  fi

  echo -e "${CYAN}Analyzing failure (takes ~8 seconds)...${NC}"
  echo ""

  curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"analyze_failure","arguments":{"sessionId":"sess_001","testName":"should persist cart items across page reload"}}}'

  echo ""
}

cmd_all() {
  cmd_init
  echo ""
  echo -e "${YELLOW}Press Enter to run verify_changes...${NC}"
  read
  cmd_verify
  echo ""
  echo -e "${YELLOW}Press Enter to get status...${NC}"
  read
  cmd_status
  echo ""
  echo -e "${YELLOW}Press Enter to analyze failure...${NC}"
  read
  cmd_analyze
}

show_help() {
  echo "expect2 MCP Test Script"
  echo ""
  echo "Usage: ./test.sh [command]"
  echo ""
  echo "Commands:"
  echo "  init     Initialize a new session"
  echo "  verify   Run verify_changes (streaming, ~28s)"
  echo "  status   Get verification status with failure logs"
  echo "  analyze  Analyze specific failure (~8s)"
  echo "  all      Run all commands interactively"
  echo ""
  echo "First, start the server: pnpm run http"
}

case "${1:-help}" in
  init)    cmd_init ;;
  verify)  cmd_verify ;;
  status)  cmd_status ;;
  analyze) cmd_analyze ;;
  all)     cmd_all ;;
  *)       show_help ;;
esac
