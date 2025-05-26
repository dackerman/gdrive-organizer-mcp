import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for create_folders parameters
export const createFoldersSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).describe(
    'Array of folder paths to create. ' +
    'Paths must be absolute (starting with "/"). ' +
    'Parent directories will be created automatically if they don\'t exist. ' +
    'Examples: ["/Documents/Projects/2024", "/Archive/Old Files", "/Temp"]'
  ),
  
  skipExisting: z.boolean().optional().describe(
    'If true (default), silently skip folders that already exist. ' +
    'If false, report existing folders as errors.'
  )
})

// Type inference from the schema
export type CreateFoldersParams = z.infer<typeof createFoldersSchema>

// Result types
export interface CreateFolderResult {
  path: string
  success: boolean
  id?: string
  error?: string
  created: boolean // false if folder already existed
}

export interface CreateFoldersResult {
  success: boolean
  message: string
  summary: {
    totalPaths: number
    foldersCreated: number
    foldersExisted: number
    failures: number
  }
  results: CreateFolderResult[]
}

// Factory function to create the tool with injected dependencies
export function createCreateFoldersTool(driveService: DriveService) {
  // Helper to ensure parent directories exist
  async function ensureParentPath(path: string): Promise<void> {
    const parts = path.split('/').filter(p => p)
    let currentPath = ''
    
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i]
      
      try {
        // Try to resolve the path - if it fails, the folder doesn't exist
        await driveService.resolvePathToId(currentPath)
      } catch (error) {
        // Parent doesn't exist, we need to create it
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/'
        const parentId = await driveService.resolvePathToId(parentPath)
        const folderName = parts[i]
        
        await driveService.createFolder(folderName, parentId)
        console.log(`[createFolders tool] Created parent directory: ${currentPath}`)
      }
    }
  }
  
  // The actual handler function
  async function createFolders(params: CreateFoldersParams): Promise<{ content: Array<{ type: 'text', text: string }> }> {
    // Validate parameters
    const validated = createFoldersSchema.parse(params)
    const skipExisting = validated.skipExisting ?? true // Default to true
    
    console.log('[createFolders tool] Called with:', {
      pathCount: validated.paths.length,
      skipExisting
    })
    
    const results: CreateFolderResult[] = []
    let foldersCreated = 0
    let foldersExisted = 0
    let failures = 0
    
    // Process each path
    for (const path of validated.paths) {
      console.log(`[createFolders tool] Processing path: ${path}`)
      
      try {
        // Normalize path
        const normalizedPath = path.startsWith('/') ? path : '/' + path
        
        // Check if folder already exists
        let exists = false
        let existingId: string | undefined
        
        try {
          existingId = await driveService.resolvePathToId(normalizedPath)
          exists = true
        } catch (error) {
          // Folder doesn't exist, which is what we want
        }
        
        if (exists) {
          if (skipExisting) {
            results.push({
              path: normalizedPath,
              success: true,
              id: existingId,
              created: false
            })
            foldersExisted++
            console.log(`[createFolders tool] Folder already exists: ${normalizedPath}`)
          } else {
            results.push({
              path: normalizedPath,
              success: false,
              error: 'Folder already exists',
              created: false
            })
            failures++
          }
          continue
        }
        
        // Ensure parent directories exist
        await ensureParentPath(normalizedPath)
        
        // Create the folder
        const folderName = normalizedPath.split('/').filter(p => p).pop()!
        const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) || '/'
        const parentId = await driveService.resolvePathToId(parentPath)
        
        const result = await driveService.createFolder(folderName, parentId)
        
        results.push({
          path: normalizedPath,
          success: true,
          id: result.id,
          created: true
        })
        foldersCreated++
        
        console.log(`[createFolders tool] Created folder: ${normalizedPath} (${result.id})`)
        
      } catch (error) {
        console.error(`[createFolders tool] Error creating ${path}:`, error)
        results.push({
          path: path.startsWith('/') ? path : '/' + path,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          created: false
        })
        failures++
      }
    }
    
    // Build summary
    const overallSuccess = failures === 0
    const message = overallSuccess
      ? `Successfully processed all ${validated.paths.length} paths (${foldersCreated} created, ${foldersExisted} already existed)`
      : `Completed with ${failures} failures out of ${validated.paths.length} paths`
    
    const result: CreateFoldersResult = {
      success: overallSuccess,
      message,
      summary: {
        totalPaths: validated.paths.length,
        foldersCreated,
        foldersExisted,
        failures
      },
      results
    }
    
    console.log('[createFolders tool] Completed:', result.summary)
    
    // Format response according to MCP spec
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }
      ]
    }
  }

  // Return the tool definition
  return {
    name: 'create_folders',
    description: 
      'Creates multiple folders in Google Drive from a list of paths. ' +
      'Automatically creates parent directories if they don\'t exist. ' +
      'Handles existing folders gracefully based on the skipExisting parameter. ' +
      '\n\nUse cases:\n' +
      '- Set up project folder structures\n' +
      '- Create directory hierarchies in bulk\n' +
      '- Organize files by creating multiple folders at once\n' +
      '\n\nExamples:\n' +
      '1. Create project structure: ["/Projects/2024/Q1", "/Projects/2024/Q2"]\n' +
      '2. Create archive folders: ["/Archive/2023/Documents", "/Archive/2023/Photos"]\n' +
      '3. Create single folder with parents: ["/Documents/Work/Reports/2024/January"]',
    schema: createFoldersSchema.shape,
    handler: createFolders
  }
}