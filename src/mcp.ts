import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { v4 as uuidv4 } from "uuid";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "UUID MCP Server",
    version: "1.0.0",
  });

  server.registerTool(
    "generate_uuid",
    { description: "Generate a new UUID" },
    async () => {
      const uuid = uuidv4();
      return {
        content: [{ type: "text" as const, text: uuid }],
      };
    }
  );

  return server;
}
