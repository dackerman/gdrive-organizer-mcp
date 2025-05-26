import { z } from 'zod'
import { DriveService } from '../types/drive'

// Available fields that can be returned for each file
const AVAILABLE_FIELDS = [
  'id',
  'name',
  'path',
  'mimeType',
  'size',
  'createdTime',
  'modifiedTime',
  'parents',
  'isFolder',
  'isDirectory', // alias for isFolder
  'isShared',
  'sharingStatus',
  'folderDepth'
] as const

// Define the schema for list_directory parameters
export const listDirectorySchema = z.object({
  folderPath: z.string().optional().describe(
    'Path to the folder (e.g., "/Documents/Projects"). Defaults to root folder. ' +
    'Use "/" for root, or paths like "/Documents", "/Documents/Work", etc.'
  ),
  
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe(
    'Array of fields to include in the response for each file. ' +
    'Available fields: ' + AVAILABLE_FIELDS.join(', ') + '. ' +
    'Defaults to ["path", "name", "isDirectory", "isShared"]. ' +
    'Use minimal fields to reduce token usage. Examples: ' +
    '- ["name", "isDirectory"] for simple listing ' +
    '- ["name", "mimeType", "size", "modifiedTime"] for detailed file info ' +
    '- ["path", "isShared", "sharingStatus"] for sharing info'
  ),
  
  query: z.string().optional().describe(
    'Google Drive search query to filter results. This uses the Google Drive query syntax. Examples:\n' +
    '- name contains \'report\' - files with "report" in the name\n' +
    '- mimeType = \'application/pdf\' - only PDF files\n' +
    '- modifiedTime > \'2024-01-01\' - files modified after Jan 1, 2024\n' +
    '- \'me\' in owners - files owned by you\n' +
    '- sharedWithMe - files shared with you\n' +
    '- starred - starred files\n' +
    '- trashed = false - exclude trashed files (applied by default)\n' +
    'Combine with "and", "or", "not". See https://developers.google.com/drive/api/guides/search-files'
  ),
  
  includeShared: z.boolean().optional().default(true).describe(
    'Include files shared with you. Set to false to only show files you own.'
  ),
  
  onlyDirectories: z.boolean().optional().default(false).describe(
    'Only return directories/folders, excluding files.'
  ),
  
  pageSize: z.number().min(1).max(100).optional().default(20).describe(
    'Number of results per page (1-100). Use smaller values to reduce response size.'
  ),
  
  pageToken: z.string().optional().describe(
    'Token from previous response to fetch the next page of results.'
  )
})

// Type inference from the schema
export type ListDirectoryParams = z.infer<typeof listDirectorySchema>

// Factory function to create the tool with injected dependencies
export function createListDirectoryTool(driveService: DriveService) {
  // The actual handler function
  async function listDirectory(params: ListDirectoryParams) {
    console.log('[listDirectory tool] Called with params:', params)
    
    try {
      // Default fields if not specified
      const requestedFields = params.fields || ['path', 'name', 'isDirectory', 'isShared']
      
      const result = await driveService.listDirectory({
        folderPath: params.folderPath,
        query: params.query,
        includeShared: params.includeShared,
        onlyDirectories: params.onlyDirectories,
        pageSize: params.pageSize,
        pageToken: params.pageToken
      })
      
      console.log('[listDirectory tool] Got result:', {
        fileCount: result.files.length,
        hasNextPage: !!result.nextPageToken,
        firstFile: result.files[0]?.name
      })

      // Build dynamic file objects based on requested fields
      const formattedFiles = result.files.map(file => {
        const fileData: any = {}
        
        requestedFields.forEach(field => {
          switch (field) {
            case 'id':
              fileData.id = file.id
              break
            case 'name':
              fileData.name = file.name
              break
            case 'path':
              fileData.path = file.path
              break
            case 'mimeType':
              fileData.mimeType = file.mimeType
              break
            case 'size':
              if (file.size !== undefined) fileData.size = file.size
              break
            case 'createdTime':
              fileData.createdTime = file.createdTime
              break
            case 'modifiedTime':
              fileData.modifiedTime = file.modifiedTime
              break
            case 'parents':
              fileData.parents = file.parents
              break
            case 'isFolder':
            case 'isDirectory':
              fileData.isDirectory = file.isFolder
              break
            case 'isShared':
              fileData.isShared = file.isShared
              break
            case 'sharingStatus':
              fileData.sharingStatus = file.sharingStatus
              break
            case 'folderDepth':
              fileData.folderDepth = file.folderDepth
              break
          }
        })
        
        return fileData
      })

      // Format response
      const formattedResult = {
        files: formattedFiles,
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
    description: 
      'Lists files and folders in a Google Drive directory with flexible field selection and powerful search capabilities.\n\n' +
      'Key features:\n' +
      '- Path-based navigation: Use paths like "/" or "/Documents/Projects"\n' +
      '- Field selection: Choose only the fields you need to minimize tokens\n' +
      '- Search queries: Use Google Drive\'s query syntax for powerful filtering\n' +
      '- Pagination: Handle large directories efficiently\n\n' +
      'Common use cases:\n' +
      '1. Simple listing: list_directory(folderPath="/", fields=["name", "isDirectory"])\n' +
      '2. Find PDFs: list_directory(query="mimeType = \'application/pdf\'")\n' +
      '3. Recent files: list_directory(query="modifiedTime > \'2024-01-01\'")\n' +
      '4. Shared files: list_directory(query="sharedWithMe", fields=["name", "sharingStatus"])',
    schema: listDirectorySchema.shape,
    handler: listDirectory
  }
}