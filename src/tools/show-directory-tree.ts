import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for show_directory_tree parameters
export const showDirectoryTreeSchema = z.object({
  rootPath: z.string().optional().default('/'),
  maxDepth: z.number().min(1).max(5).optional().default(3)
})

// Type inference from the schema
export type ShowDirectoryTreeParams = z.infer<typeof showDirectoryTreeSchema>

// Factory function to create the tool with injected dependencies
export function createShowDirectoryTreeTool(driveService: DriveService) {
  // The actual handler function
  async function showDirectoryTree(params: ShowDirectoryTreeParams) {
    console.log('[showDirectoryTree tool] Called with params:', params)
    
    try {
      const directories = await driveService.buildDirectoryTree(params.rootPath, params.maxDepth)
      
      console.log('[showDirectoryTree tool] Found directories:', {
        count: directories.length,
        rootPath: params.rootPath,
        maxDepth: params.maxDepth
      })

      // Format the response with a nice tree-like structure
      const formattedTree = formatDirectoryTree(directories)

      // Format response according to MCP spec
      return {
        content: [
          {
            type: 'text' as const,
            text: formattedTree
          }
        ]
      }
    } catch (error) {
      console.error('[showDirectoryTree tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'show_directory_tree',
    description: 'Shows a tree of all directory paths starting from a given root path',
    schema: showDirectoryTreeSchema.shape,
    handler: showDirectoryTree
  }
}

/**
 * Format directory paths into a nice tree structure
 */
function formatDirectoryTree(directories: string[]): string {
  if (directories.length === 0) {
    return 'No directories found.'
  }

  const sortedDirs = [...directories].sort()

  return sortedDirs.join('\n')
}