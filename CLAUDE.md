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
   - `MyMCP` class extending `DurableMCP` - handles MCP tool implementations
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

Tools are added to the `MyMCP` class in `src/index.ts`. Example:

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