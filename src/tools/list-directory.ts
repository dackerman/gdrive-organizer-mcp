import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for list_directory parameters
export const listDirectorySchema = z.object({
  folderPath: z.string().optional().describe('Path to the folder (e.g., "/Documents/Projects"). Defaults to root folder.'),
  includeShared: z.boolean().optional().default(true).describe('Include files shared with you'),
  onlyDirectories: z.boolean().optional().default(false).describe('Only show directories/folders'),
  pageSize: z.number().min(1).max(100).optional().default(20).describe('Number of results per page'),
  pageToken: z.string().optional().describe('Token for fetching the next page of results')
})

// Type inference from the schema
export type ListDirectoryParams = z.infer<typeof listDirectorySchema>

// Factory function to create the tool with injected dependencies
export function createListDirectoryTool(driveService: DriveService) {
  // The actual handler function
  async function listDirectory(params: ListDirectoryParams) {
    console.log('[listDirectory tool] Called with params:', params)
    
    try {
      const result = await driveService.listDirectory(params)
      
      console.log('[listDirectory tool] Got result:', {
        fileCount: result.files.length,
        hasNextPage: !!result.nextPageToken,
        firstFile: result.files[0]?.name
      })

      // Format files for better LLM readability
      const formattedResult = {
        files: result.files.map(file => ({
          path: file.path,
          name: file.name,
          isDirectory: file.isFolder,
          isShared: file.isShared
        })),
        nextPageToken: result.nextPageToken,
        hasMore: !!result.nextPageToken
      }

      // Format response according to MCP spec
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(formattedResult, null, 2)
          }
        ]
      }
    } catch (error) {
      console.error('[listDirectory tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'list_directory',
    description: 'Lists files and folders in a Google Drive directory. Supports pagination to limit response size. Use folderPath (e.g., "/Documents") instead of folder IDs for easier navigation.',
    schema: listDirectorySchema.shape,
    handler: listDirectory
  }
}