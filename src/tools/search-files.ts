import { z } from 'zod'
import { DriveService } from '../types/drive'
import { createMCPTextResponse } from '../mcp-utils'

// Define the schema for search_files parameters
export const searchFilesSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Search query for finding files. Can be:\n' +
        '1. Simple text search: searches file names and content\n' +
        '2. Google Drive query syntax for advanced searches:\n' +
        '   - name contains \'report\' - files with "report" in name\n' +
        '   - fullText contains \'budget\' - files containing "budget" in content\n' +
        "   - mimeType = 'application/pdf' - only PDF files\n" +
        "   - modifiedTime > '2024-01-01' - recently modified files\n" +
        "   - 'user@example.com' in owners - files owned by specific user\n" +
        '   - sharedWithMe - files shared with you\n' +
        '   - starred - starred files\n' +
        'See https://developers.google.com/drive/api/guides/search-files for full syntax',
    ),

  folderId: z.string().optional().describe('Limit search to a specific folder ID. Leave empty to search entire Drive.'),

  mimeType: z
    .string()
    .optional()
    .describe(
      'Filter by MIME type. Common types:\n' +
        '- application/pdf - PDF files\n' +
        '- application/vnd.google-apps.document - Google Docs\n' +
        '- application/vnd.google-apps.spreadsheet - Google Sheets\n' +
        '- application/vnd.google-apps.folder - Folders\n' +
        '- image/jpeg, image/png - Images\n' +
        '- text/plain - Text files',
    ),

  namePattern: z
    .string()
    .optional()
    .describe(
      'Regular expression pattern to match file names. Examples:\n' +
        '- ^report - files starting with "report"\n' +
        '- \\.pdf$ - files ending with .pdf\n' +
        '- \\d{4} - files containing 4 digits',
    ),

  maxResults: z.number().min(1).max(1000).optional().default(50).describe('Maximum number of results to return (1-1000). Default: 50'),
})

// Type inference from the schema
export type SearchFilesParams = z.infer<typeof searchFilesSchema>

// Factory function to create the tool with injected dependencies
export function createSearchFilesTool(driveService: DriveService) {
  // The actual handler function
  async function searchFiles(params: SearchFilesParams) {
    console.log('[searchFiles tool] Called with params:', params)

    try {
      const result = await driveService.searchFiles({
        ...params,
        maxResults: params.maxResults || 50,
      })

      console.log('[searchFiles tool] Got result:', {
        fileCount: result.files.length,
        firstFile: result.files[0]?.name,
      })

      // Format response with essential fields for search results
      const formattedResult = {
        files: result.files.map((file) => ({
          id: file.id,
          name: file.name,
          path: file.path,
          mimeType: file.mimeType,
          size: file.size,
          modifiedTime: file.modifiedTime,
          isFolder: file.isFolder,
          isShared: file.isShared,
        })),
        totalResults: result.files.length,
      }

      // Format response according to MCP spec
      return createMCPTextResponse(formattedResult)
    } catch (error) {
      console.error('[searchFiles tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'search_files',
    description:
      'Search for files across your entire Google Drive or within specific folders.\n\n' +
      "This tool is optimized for finding files when you don't know their exact location.\n" +
      'For listing files in a known folder, use list_directory instead.\n\n' +
      'Key features:\n' +
      '- Full-text search: Search file names and content\n' +
      '- Advanced queries: Use Google Drive query syntax for precise filtering\n' +
      '- Pattern matching: Use regex to match file names\n' +
      '- Type filtering: Search for specific file types\n\n' +
      'Common searches:\n' +
      '1. Find all PDFs: search_files(mimeType="application/pdf")\n' +
      '2. Find by content: search_files(query="fullText contains \'meeting notes\'")\n' +
      '3. Recent files: search_files(query="modifiedTime > \'2024-01-01\'")\n' +
      '4. Shared files: search_files(query="sharedWithMe")',
    schema: searchFilesSchema.shape,
    handler: searchFiles,
  }
}
