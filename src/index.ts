#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  // Connect and start the server
  await server.connect(transport);
  console.error("expect2 MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start expect2 MCP server:", error);
  process.exit(1);
});
