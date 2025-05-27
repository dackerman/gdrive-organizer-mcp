import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleHandler } from './google-handler'
import { createListDirectoryTool } from './tools/list-directory'
import { createReadFileTool } from './tools/read-file'
import { createSearchFilesTool } from './tools/search-files'
import { createMoveFilesTool } from './tools/move-files'
import { createCreateFoldersTool } from './tools/create-folders'
import { GoogleDriveService } from './services/google-drive'
import { Props } from './utils'

export class GDriveOrganizerMCP extends McpAgent<Env, {}, Props> {
  server = new McpServer({
    name: 'Google Drive Organizer MCP',
    version: '0.0.1',
  })

  private driveService!: GoogleDriveService

  async init() {
    console.log('[GDriveOrganizerMCP] Initializing with props:', {
      name: this.props.name,
      email: this.props.email,
      hasAccessToken: !!this.props.accessToken,
      hasRefreshToken: !!this.props.refreshToken,
      tokenExpiresAt: this.props.tokenExpiresAt,
      tokenLength: this.props.accessToken?.length,
    })

    // Initialize the drive service with all token data
    this.driveService = new GoogleDriveService(
      this.props.accessToken,
      this.props.refreshToken,
      this.env.GOOGLE_CLIENT_ID,
      this.env.GOOGLE_CLIENT_SECRET,
    )

    const tools = [
      createListDirectoryTool(this.driveService),
      createReadFileTool(this.driveService),
      createSearchFilesTool(this.driveService),
      createMoveFilesTool(this.driveService),
      createCreateFoldersTool(this.driveService),
    ]

    tools.forEach((tool) => {
      console.log('[GDriveOrganizerMCP] Registering tool:', tool.name)
      this.server.tool(tool.name, tool.description, tool.schema, tool.handler)
    })
  }
}

export default new OAuthProvider({
  apiRoute: '/sse',
  apiHandler: GDriveOrganizerMCP.mount('/sse') as any,
  defaultHandler: GoogleHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
})
