import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { GoogleHandler } from './google-handler'
import { addTool } from './tools/math'
import { createListDirectoryTool } from './tools/list-directory'
import { GoogleDriveService } from './services/google-drive'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the MyMCP as this.props
type Props = {
  name: string
  email: string
  accessToken: string
}

export class MyMCP extends McpAgent<Env, {}, Props> {
  server = new McpServer({
    name: 'Google Drive Organizer MCP',
    version: '0.0.1',
  })

  private driveService!: GoogleDriveService

  async init() {
    // Initialize the drive service with the access token
    this.driveService = new GoogleDriveService(this.props.accessToken)

    // Keep the math tool for now
    this.server.tool(addTool.name, addTool.schema, addTool.handler)
    
    // Add the list_directory tool
    const listDirectoryTool = createListDirectoryTool(this.driveService)
    this.server.tool(
      listDirectoryTool.name,
      listDirectoryTool.schema,
      listDirectoryTool.handler
    )
  }
}

export default new OAuthProvider({
  apiRoute: '/sse',
  apiHandler: MyMCP.mount('/sse') as any,
  defaultHandler: GoogleHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
})
