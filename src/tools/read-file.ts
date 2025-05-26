import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for read_file parameters
export const readFileSchema = z.object({
  filePath: z.string().min(1),
  maxSize: z.number().min(1).max(10485760).optional(), // Max 10MB
  startOffset: z.number().min(0).optional(),
  endOffset: z.number().min(0).optional()
})

// Type inference from the schema
export type ReadFileParams = z.infer<typeof readFileSchema>

// Factory function to create the tool with injected dependencies
export function createReadFileTool(driveService: DriveService) {
  // The actual handler function
  async function readFile(params: ReadFileParams) {
    console.log('[readFile tool] Called with params:', params)
    
    try {
      // Resolve path to file ID
      const fileId = await driveService.resolvePathToId(params.filePath)
      console.log('[readFile tool] Resolved path to ID:', { 
        filePath: params.filePath, 
        fileId 
      })
      
      // Call the service with the resolved ID
      const result = await driveService.readFile({
        fileId,
        maxSize: params.maxSize,
        startOffset: params.startOffset,
        endOffset: params.endOffset
      })
      
      console.log('[readFile tool] Got result:', {
        mimeType: result.mimeType,
        size: result.size,
        truncated: result.truncated,
        encoding: result.encoding,
        contentLength: result.content.length
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
      console.error('[readFile tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'read_file',
    description: 'Reads file content from Google Drive using file path with optional pagination for large files',
    schema: readFileSchema.shape,
    handler: readFile
  }
}