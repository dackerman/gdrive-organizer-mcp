import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for read_file parameters
export const readFileSchema = z.object({
  filePath: z.string().min(1).describe(
    'The path to the file in Google Drive. ' +
    'Can be an absolute path (e.g., "/My Documents/report.pdf") or ' +
    'a relative path from the current directory. ' +
    'Use forward slashes (/) as path separators. ' +
    'The path is case-sensitive and must match exactly.'
  ),
  maxSize: z.number().min(1).max(10485760).optional().describe(
    'Maximum size of content to read in bytes. ' +
    'Default is 10MB (10485760 bytes). ' +
    'If the file is larger than this limit, the content will be truncated and the "truncated" flag will be set to true. ' +
    'Use this to prevent overwhelming the context with large files.'
  ),
  startOffset: z.number().min(0).optional().describe(
    'Starting byte offset for reading the file (0-based). ' +
    'Use this along with endOffset to read a specific portion of a large file. ' +
    'Example: startOffset=1000 starts reading from the 1001st byte.'
  ),
  endOffset: z.number().min(0).optional().describe(
    'Ending byte offset for reading the file (exclusive). ' +
    'Use this along with startOffset to read a specific portion of a large file. ' +
    'Example: endOffset=2000 stops reading at the 2000th byte (reads bytes 0-1999). ' +
    'If not specified, reads until maxSize or end of file.'
  )
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
    description: 
      'Reads the content of a file from Google Drive. ' +
      'Supports text files, documents, spreadsheets, and other readable formats. ' +
      'For binary files, returns base64-encoded content. ' +
      'Large files can be read in chunks using offset parameters. ' +
      '\n\nCommon use cases:\n' +
      '- Read text files, code, configuration files\n' +
      '- Read Google Docs/Sheets (exported as plain text)\n' +
      '- Read portions of large log files using offsets\n' +
      '\nNote: Cannot read Google Drive folders. Use list_directory to explore folder contents.',
    schema: readFileSchema.shape,
    handler: readFile
  }
}