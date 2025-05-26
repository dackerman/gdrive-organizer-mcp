import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleHandler } from './google-handler'
import { createListDirectoryTool } from './tools/list-directory'
import { createReadFileTool } from './tools/read-file'
import { createSearchFilesTool } from './tools/search-files'
import { createShowDirectoryTreeTool } from './tools/show-directory-tree'
import { createShowFileTreeTool } from './tools/show-file-tree'
import { createMoveFilesTool } from './tools/move-files'
import { GoogleDriveService } from './services/google-drive'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the GDriveOrganizerMCP as this.props
type Props = {
  name: string
  email: string
  accessToken: string
}

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
      tokenLength: this.props.accessToken?.length
    })

    // Initialize the drive service with the access token
    this.driveService = new GoogleDriveService(this.props.accessToken)

    const tools = [
      createListDirectoryTool(this.driveService),
      createReadFileTool(this.driveService),
      createSearchFilesTool(this.driveService),
      createShowDirectoryTreeTool(this.driveService),
      createShowFileTreeTool(this.driveService),
      createMoveFilesTool(this.driveService)
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
