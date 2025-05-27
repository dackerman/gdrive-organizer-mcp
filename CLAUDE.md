# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
npm run dev          # Start local dev server on port 8788
npm run start        # Alias for dev
```

### Deployment

```bash
npm run deploy       # Deploy to Cloudflare Workers
```

### Type Checking

```bash
npm run cf-typegen   # Generate Cloudflare types
npm run type-check   # Run TypeScript type checking
```

## Architecture Overview

This is a **Google Drive Organizer MCP Server** deployed on Cloudflare Workers that combines:

- **Model Context Protocol (MCP)** server functionality using `workers-mcp`
- **Google OAuth authentication** via `@cloudflare/workers-oauth-provider`
- **Durable Objects** for persistent state management

### Key Components

1. **`src/index.ts`**: Main entry point containing:

   - `GDriveOrganizerMCP` class extending `DurableMCP` - handles MCP tool implementations
   - OAuth provider setup for client authentication
   - Route handlers for SSE connections and OAuth callbacks

2. **`src/google-handler.ts`**: Google OAuth flow implementation:

   - Manages authentication with Google Cloud OAuth
   - Stores tokens in KV storage (`OAUTH_KV`)
   - Returns user info and access tokens

3. **Configuration Files**:
   - `wrangler.jsonc`: Cloudflare Workers config (main entry, durable objects, KV namespace)
   - `tsconfig.json`: TypeScript configuration with strict checking
   - `package.json`: Dependencies and scripts

### Authentication Flow

The server acts as both:

- OAuth **Server** to MCP clients (Claude, Inspector, etc.)
- OAuth **Client** to Google Cloud OAuth

Required secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_ENCRYPTION_KEY`
- `HOSTED_DOMAIN` (optional - restricts to specific Google domain)

### Adding New Tools

Tools are added to the `GDriveOrganizerMCP` class in `src/index.ts`. Example:

```typescript
async listTools() {
  return {
    tools: [
      {
        name: "your_tool_name",
        description: "Tool description",
        inputSchema: {
          type: "object",
          properties: {
            // Define parameters
          },
          required: ["required_params"]
        }
      }
    ]
  };
}

async callTool(name: string, args: Record<string, any>) {
  if (name === "your_tool_name") {
    // Tool implementation
    // Access authenticated user via this.props
  }
}
```

### Local Development Setup

1. Create a Google Cloud OAuth App with localhost URLs
2. Create `.dev.vars` file with:
   ```
   GOOGLE_CLIENT_ID=your_dev_client_id
   GOOGLE_CLIENT_SECRET=your_dev_client_secret
   ```
3. Run `npm run dev` to start local server
4. Test with MCP Inspector at `http://localhost:8788/sse`

## Troubleshooting

### 403 Forbidden Error from Google Drive API

If you get a "403 Forbidden" error when calling Drive tools, check:

1. **API Enabled**: Ensure Google Drive API is enabled in your Google Cloud Console
2. **OAuth Scopes**: The app requests these scopes:
   - `email` and `profile` (basic user info)
   - `https://www.googleapis.com/auth/drive` (full Drive access)
   - `https://www.googleapis.com/auth/drive.file` (file-level access)
3. **Re-authenticate**: If you previously authenticated without Drive scopes, disconnect and reconnect
4. **Check Logs**: The service includes detailed logging:
   - Token validation
   - Request URLs and headers
   - Response status and error bodies

### Token Refresh and Authentication

The service automatically handles token refresh to prevent authentication errors:

1. **Automatic Token Refresh**: When the access token expires (typically after 1 hour), the service automatically refreshes it using the refresh token
2. **Proactive Refresh**: Tokens are refreshed proactively when they're within 5 minutes of expiration
3. **401 Recovery**: If a request fails with 401 Unauthorized, the service attempts to refresh the token and retry
4. **Persistent Sessions**: The refresh token is stored in the MCP token, allowing long-running sessions without re-authentication

**Important Notes**:

- The initial OAuth flow requests `access_type=offline` and `prompt=consent` to ensure a refresh token is obtained
- Client credentials (ID and secret) are passed from the environment to the GoogleDriveService for token refresh
- If token refresh fails (missing refresh token or credentials), the user must re-authenticate

### Debugging

All components include detailed logging prefixed with their module name:

- `[GoogleHandler]` - OAuth flow
- `[GDriveOrganizerMCP]` - MCP server initialization
- `[GoogleDriveService]` - Drive API calls
- `[GoogleDriveApiClient]` - Token refresh and API requests
- `[listDirectory tool]` - Tool execution

Check the Cloudflare Workers logs or local dev console for debugging information.

## Memories

- When building mcp tools, we should try to minimize the amount of LLM context that is used by both inputs and outputs. If the input schema is large and complex, an LLM is going to have a harder time knowing how to call it. Additionally, if the response data is inscrutible, hard to follow, or has additional unneeded information, then it wastes tokens.
