import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "mcp-session-id",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id"],
  })
);

// --- Well-Known Metadata (RFC9728 / RFC8414) ---

app.get("/.well-known/oauth-protected-resource", (c) => {
  return c.json({
    resource: `${BASE_URL}/mcp`,
    authorization_servers: [BASE_URL],
  });
});

app.get("/.well-known/oauth-authorization-server", (c) => {
  return c.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/auth`,
    token_endpoint: `${BASE_URL}/token`,
    registration_endpoint: `${BASE_URL}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  });
});

// --- Dynamic Client Registration (RFC7591) ---

app.post("/register", async (c) => {
  const body = await c.req.json();
  console.log("Received registration request:", body);
  return c.json({
    ...body,
    client_id: "uuid-client-id-12345",
    client_secret: "uuid-client-secret-6789",
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
  });
});

// --- Authorization Endpoint ---

app.get("/auth", (c) => {
  const redirectUri = c.req.query("redirect_uri");
  const state = c.req.query("state");
  console.log(
    "Received auth request:",
    Object.fromEntries(new URL(c.req.url).searchParams)
  );
  return c.redirect(`${redirectUri}?code=uuid-auth-code-12345&state=${state}`);
});

// --- Token Endpoint ---

app.post("/token", async (c) => {
  const contentType = c.req.header("content-type") || "";
  let body: Record<string, string>;
  if (contentType.includes("application/json")) {
    body = await c.req.json();
  } else {
    body = (await c.req.parseBody()) as Record<string, string>;
  }
  console.log("Received token request:", body);
  return c.json({
    access_token: "uuid-access-token-12345",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "uuid-refresh-token-6789",
    scope: "",
  });
});

// --- MCP Endpoint ---

app.all("/mcp", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32601, message: "Unauthorized" }, id: null },
      401,
      {
        "WWW-Authenticate":
          `Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// --- Start ---

const port = 5173;
serve({ fetch: app.fetch, port });
console.log(`UUID MCP server running on ${BASE_URL}`);
