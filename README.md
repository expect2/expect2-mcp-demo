# expect2-mcp

E2E test verification MCP server for coding agents. When a coding agent finishes making changes, it can use expect2 to verify those changes are correct.

**Current Status**: Mock implementation that returns fixed responses for testing the API contract.

## What expect2 Does

1. **Analyzes code changes** - Receives file paths, diffs, and ticket IDs
2. **Selects relevant tests** - Automatically decides which E2E test suites to run
3. **Modifies existing tests** - Updates tests affected by the changes
4. **Creates new tests** - Adds test coverage for new functionality
5. **Runs tests** - Executes the tests using Playwright
6. **Reports results** - Provides detailed failure reports with console/network logs

## Installation

```bash
pnpm install
```

## Running

```bash
# Start the MCP server (stdio - for Claude Code)
pnpm run start

# Start HTTP server (for curl testing)
pnpm run http

# Test with MCP Inspector
pnpm run inspector
```

## MCP Tools

### `verify_changes`

Main entry point. Provide change information and expect2 decides which tests to run.

**Input:**
- `projectPath` - Path to the project
- `changedFiles` - Array of changed file paths
- `diffs` (optional) - Git diff output
- `ticketId` (optional) - Associated ticket/issue ID

**Output:**
- `sessionId` - Session ID for follow-up queries
- `status` - analyzing | running | passed | failed | error
- `testsSelected` - Which tests were chosen and why
- `testsModified` - Existing tests that were updated
- `testsAdded` - New tests that were created
- `results` - Test counts (total, passed, failed, skipped)
- `summary` - Human-readable summary

### `get_verification_status`

Get detailed status of a verification session.

**Input:**
- `sessionId` - Session ID from verify_changes

**Output:**
- `progress` - Tests run / total, current test
- `results` - Detailed results with duration
- `failures` - Array of failures with logs (markdown-formatted)

### `analyze_failure`

Deep analysis of a specific test failure.

**Input:**
- `sessionId` - Session ID
- `testName` - Name of the failed test

**Output:**
- `failureType` - assertion | timeout | element_not_found | network | script_error
- `rootCause` - Explanation of why the test failed
- `suggestedFix` - How to fix the issue
- `logs` - Detailed console/network logs in markdown format

## Claude Code Integration

Add to your MCP config:

```json
{
  "mcpServers": {
    "expect2": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "/path/to/expect2-mcp/src/index.ts"]
    }
  }
}
```

## Testing with curl

```bash
# Start HTTP server
pnpm run http

# Initialize connection
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# List tools (use session ID from initialize response)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call verify_changes (~30 seconds)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"verify_changes","arguments":{"projectPath":"/test","changedFiles":["src/app.ts"]}}}'
```
