# Google Drive Organizer MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that enables AI assistants like Claude to intelligently organize your Google Drive files through natural conversation.

This server provides tools for exploring, analyzing, and reorganizing your Google Drive content with AI assistance. It uses Google OAuth for secure authentication and runs on Cloudflare Workers for reliable remote access.

## Features

### Available Tools

- **`list_directory`** - Browse files and folders in your Google Drive
  - Lists up to 100 files per request with pagination support
  - Flexible field selection to minimize token usage
  - Supports advanced Google Drive query syntax for filtering
  - Options to filter by shared files or directories only
  - Shows file paths, sizes, sharing status, and metadata

- **`read_file`** - Read file contents with smart handling
  - Supports text files and Google Docs/Sheets (exported as plain text)
  - Handles binary files with base64 encoding
  - Supports partial reads with offset parameters for large files (max 10MB)
  - Automatically exports Google Workspace files to readable formats

- **`search_files`** - Search across your entire Drive
  - Full-text search in file names and content
  - Advanced Google Drive query syntax support
  - Filter by folder, MIME type, or name pattern (regex)
  - Configurable max results (1-1000, default 50)
  - Returns same flexible metadata as list_directory

- **`move_files`** - Move or rename files and folders
  - Supports move, rename, or both in a single operation
  - Batch processing of multiple files/folders
  - Atomic per-item operations with detailed success/failure reporting
  - Smart path-to-ID resolution with caching

- **`create_folders`** - Create folders from paths
  - Automatically creates parent directories as needed
  - Batch folder creation from multiple paths
  - Handles existing folders gracefully
  - Returns folder IDs and creation status

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

# Install dependencies (requires pnpm)
pnpm install

# Set up Cloudflare secrets
pnpm wrangler secret put GOOGLE_CLIENT_ID
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put COOKIE_ENCRYPTION_KEY # Generate with: openssl rand -hex 32
pnpm wrangler secret put HOSTED_DOMAIN # Optional: restrict to your Google Workspace domain

# Create KV namespace for OAuth storage
pnpm wrangler kv:namespace create "OAUTH_KV"
# Update wrangler.jsonc with the generated KV namespace ID

# Deploy to Cloudflare Workers
pnpm run deploy
```

#### 3. Connect to Claude Desktop

Add to your Claude Desktop configuration (`Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "gdrive-organizer": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker-name.your-subdomain.workers.dev/sse"]
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
   pnpm run dev
   ```
4. Test with MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector@latest
   # Connect to: http://localhost:8788/sse
   ```

## Usage Examples

### Natural Language Interactions

Once connected to Claude Desktop, you can interact with your Google Drive using natural language. Here are example conversations:

**Exploring your Drive:**

```
You: "What files do I have in my Drive?"
Claude: I'll list your Google Drive files for you.
[Uses list_directory tool]
Claude: You have 47 files in your root folder, including:
- Documents/ (folder, 12 files)
- Photos/ (folder, 156 files)
- Budget_2024.xlsx (21.5 KB, modified yesterday)
- Meeting_Notes.docx (8.3 KB, modified 3 days ago)
...
```

**Reading file contents:**

```
You: "Can you read my meeting notes from last week?"
Claude: I'll help you find and read your meeting notes.
[Uses search_files to find recent meeting notes]
[Uses read_file with path /Documents/Meeting_Notes_Dec2024.docx]
Claude: Here are your meeting notes from December 15th:

**Project Kickoff Meeting**
- Attendees: Alice, Bob, Carol
- Key decisions: Launch date set for Q1 2025
- Action items: Alice to create timeline, Bob to review budget
...
```

**Advanced search and analysis:**

```
You: "Find all my budget-related spreadsheets and tell me what projects they cover"
Claude: I'll search for budget spreadsheets in your Drive.
[Uses search_files with query "budget" and mimeType filter for spreadsheets]
Claude: I found 5 budget spreadsheets:

1. /Finance/Budget_2024_Final.xlsx - Annual company budget
2. /Projects/Marketing_Campaign_Budget.xlsx - Q4 marketing spend
3. /Personal/Home_Renovation_Budget.xlsx - Kitchen remodel costs
...

Would you like me to read any of these files to analyze the project details?
```

**File organization:**

```
You: "My Documents folder is a mess. Can you help organize it by project?"
Claude: I'll analyze your Documents folder and help organize it.
[Uses list_directory to understand current structure]
[Uses create_folders to create new organization structure]
[Uses move_files to reorganize files into project folders]
Claude: I've organized your 23 documents into these project folders:
- /Documents/Projects/Website_Redesign/ (5 files)
- /Documents/Projects/Q1_Planning/ (8 files)
- /Documents/Admin/Contracts/ (4 files)
...
```

**Batch operations:**

```
You: "Create folders for each month of 2024 in my Archives folder"
Claude: I'll create monthly folders for 2024 in your Archives folder.
[Uses create_folders with paths like /Archives/2024/January, /Archives/2024/February, etc.]
Claude: I've created 12 monthly folders in /Archives/2024/:
- January/ through December/
All folders were created successfully.
```

### Simple Commands

You can also use simple commands:

- "List all files in my Drive root folder"
- "Show me what's in my Documents folder"
- "Read the contents of /Documents/project_plan.docx"
- "Find all PDF files in my Drive"
- "Search for files containing 'quarterly report'"
- "Move budget.xlsx to the Finance folder"
- "Rename 'Untitled Document' to 'Project Proposal 2024'"
- "Create folders for Q1, Q2, Q3, Q4 in my Reports directory"

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
env SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt pnpm run dev
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

### Key Features

- **Automatic Token Refresh** - Tokens are refreshed proactively before expiration and on 401 errors
- **Smart Path Resolution** - Efficient path-to-ID resolution with caching
- **Batch Operations** - Multiple files/folders can be processed in single tool calls
- **Flexible Field Selection** - List and search tools allow selecting specific fields to minimize token usage
- **Comprehensive Testing** - Includes unit tests, integration tests, and API stub verification

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details
