import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for list_directory parameters
export const listDirectorySchema = z.object({
  folderId: z.string().optional(),
  includeShared: z.boolean().optional(),
  maxResults: z.number().min(1).max(1000).optional()
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
        firstFile: result.files[0]?.name
      })

      // Format response according to MCP spec
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
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
    description: 'Lists files and folders in a specified Google Drive directory',
    schema: listDirectorySchema.shape,
    handler: listDirectory
  }
}