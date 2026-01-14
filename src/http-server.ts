#!/usr/bin/env node
import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { log, setHttpMode } from "./logger.js";

// Enable HTTP mode for animated progress
setHttpMode(true);

const app = express();
app.use(express.json());

const PORT = 3000;

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

app.all("/mcp", async (req, res) => {
  try {
    // Check for existing session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else {
      // Create new transport and server
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: false,
      });

      const server = createServer();
      await server.connect(transport);

      // Store transport when session is initialized
      transport.onclose = () => {
        const sid = (transport as any).sessionId;
        if (sid) {
          transports.delete(sid);
          log.session("closed", sid);
        }
      };
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);

    // Store transport after handling (session ID is now set)
    const newSessionId = (transport as any).sessionId;
    if (newSessionId && !transports.has(newSessionId)) {
      transports.set(newSessionId, transport);
      log.session("new", newSessionId);
    }
  } catch (error) {
    log.error("Error handling request", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  log.startup(PORT);
});
