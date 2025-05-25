import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for search_files parameters
export const searchFilesSchema = z.object({
  query: z.string().min(1),
  folderId: z.string().optional(),
  mimeType: z.string().optional(),
  namePattern: z.string().optional(),
  maxResults: z.number().min(1).max(1000).optional()
})

// Type inference from the schema
export type SearchFilesParams = z.infer<typeof searchFilesSchema>

// Factory function to create the tool with injected dependencies
export function createSearchFilesTool(driveService: DriveService) {
  // The actual handler function
  async function searchFiles(params: SearchFilesParams) {
    console.log('[searchFiles tool] Called with params:', params)
    
    try {
      const result = await driveService.searchFiles(params)
      
      console.log('[searchFiles tool] Got result:', {
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
      console.error('[searchFiles tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'search_files',
    description: 'Search for files across Google Drive by name, content, type, or location',
    schema: searchFilesSchema.shape,
    handler: searchFiles
  }
}