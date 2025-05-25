# Google Drive Organizer MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that enables AI assistants like Claude to intelligently organize your Google Drive files through natural conversation.

This server provides tools for exploring, analyzing, and reorganizing your Google Drive content with AI assistance. It uses Google OAuth for secure authentication and runs on Cloudflare Workers for reliable remote access.

## Features

### Available Tools

- **`list_directory`** - Browse files and folders in your Google Drive
  - Lists up to 100 files per request
  - Shows file paths, sizes, and sharing status
  - Supports filtering by folder and shared files

- **`read_file`** - Read file contents with smart handling
  - Supports pagination for large files (default 1MB chunks)
  - Automatically exports Google Docs to readable formats
  - Returns base64 encoding for binary files
  - Handles text files with UTF-8 encoding

- **`search_files`** - Search across your entire Drive
  - Search by file name or content
  - Filter by folder, MIME type, or name pattern (regex)
  - Sort results by modification time
  - Returns same rich metadata as list_directory

### Coming Soon
- **`create_folder`** - Create new folders for organization
- **`execute_plan`** - Execute AI-generated organization plans
- **`get_operation_status`** - Monitor long-running operations

## Getting Started

### Prerequisites

1. A Google Cloud Project with Drive API enabled
2. A Cloudflare account
3. Node.js and pnpm installed locally

### Setup Instructions

#### 1. Create Google OAuth Client

**Using Google Cloud Console:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable the Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Configure the OAuth consent screen if prompted
   - Select "Web application" as the application type
   - Add authorized redirect URIs:
     - Production: `https://your-worker-name.your-subdomain.workers.dev/callback`
     - Development: `http://localhost:8788/callback`
5. Save your Client ID and Client Secret

#### 2. Deploy to Cloudflare

```bash
# Clone the repository
git clone https://github.com/yourusername/gdrive-organizer-mcp.git
cd gdrive-organizer-mcp

# Install dependencies
pnpm install

# Set up Cloudflare secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY # Generate with: openssl rand -hex 32
wrangler secret put HOSTED_DOMAIN # Optional: restrict to your Google Workspace domain

# Create KV namespace for OAuth storage
wrangler kv:namespace create "OAUTH_KV"
# Update wrangler.jsonc with the generated KV namespace ID

# Deploy to Cloudflare Workers
wrangler deploy
```

#### 3. Connect to Claude Desktop

Add to your Claude Desktop configuration (`Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "gdrive-organizer": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

Restart Claude Desktop. When you first use a Drive tool, you'll be prompted to authenticate with Google.

## Local Development

1. Create a development OAuth client in Google Cloud Console with localhost URLs
2. Create `.dev.vars` file:
   ```
   GOOGLE_CLIENT_ID=your_dev_client_id
   GOOGLE_CLIENT_SECRET=your_dev_client_secret
   COOKIE_ENCRYPTION_KEY=any_random_string_for_dev
   ```
3. Run the development server:
   ```bash
   pnpm dev
   ```
4. Test with MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector@latest
   # Connect to: http://localhost:8788/sse
   ```

## Usage Examples

Once connected, you can ask Claude to:

- "List all files in my Drive root folder"
- "Show me what's in my Documents folder"
- "Read the contents of my meeting notes file"
- "Find all PDF files in my Drive"
- "Search for budget spreadsheets from 2024"
- "Show me all files containing the word 'proposal'"
- "Help me organize my scattered project files" (coming soon)
- "Create a folder structure for my tax documents" (coming soon)

## Troubleshooting

### 403 Forbidden Error
If you see "Google Drive API error: 403 Forbidden":
1. Ensure Google Drive API is enabled in your Google Cloud Console
2. Disconnect and reconnect the MCP server to refresh OAuth scopes
3. Check that your OAuth client has the correct redirect URIs

### Authentication Issues
- Make sure your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly set
- For local development, ensure your `.dev.vars` file exists and has the correct values
- Check Cloudflare Workers logs for detailed error messages

### NixOS Users
If you encounter TLS certificate errors during local development:
```bash
env SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt pnpm dev
```

## Architecture

This MCP server combines several key technologies:

- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** - Serverless runtime for global deployment
- **[workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)** - OAuth 2.1 server implementation
- **[workers-mcp](https://github.com/cloudflare/workers-mcp)** - MCP server implementation with Durable Objects
- **Google Drive API v3** - For file operations and organization

The server acts as both:
- An OAuth **server** to MCP clients (Claude, Inspector, etc.)
- An OAuth **client** to Google's OAuth services

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details