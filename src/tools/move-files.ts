import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for individual move operations
export const moveOperationSchema = z.object({
  from: z.string().min(1).describe(
    'Source path of the file or folder to move/rename. ' +
    'Must be an absolute path starting with "/" (e.g., "/Documents/old-name.txt"). ' +
    'The path is case-sensitive and must match exactly.'
  ),
  to: z.string().min(1).describe(
    'Destination path for the file or folder. ' +
    'Must be an absolute path starting with "/" (e.g., "/Archive/new-name.txt"). ' +
    'If moving to a different folder, the destination folder must exist. ' +
    'If renaming (same parent folder), only the filename changes.'
  )
})

// Define the schema for move_files parameters
export const moveFilesSchema = z.object({
  operations: z.array(moveOperationSchema).min(1).describe(
    'Array of move/rename operations to perform. ' +
    'Each operation moves or renames a single file or folder. ' +
    'Operations are processed sequentially in the order provided. ' +
    'If any operation fails, subsequent operations will still be attempted.'
  )
})

// Type inference from schemas
export type MoveOperation = z.infer<typeof moveOperationSchema>
export type MoveFilesParams = z.infer<typeof moveFilesSchema>

// Result types
export interface MoveFilesResult {
  success: boolean
  message: string
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    duration: string
  }
  results: Array<{
    operation: MoveOperation
    success: boolean
    error?: string
  }>
}

// Factory function to create the tool with injected dependencies
export function createMoveFilesTool(driveService: DriveService) {
  // The actual handler function
  async function moveFiles(params: MoveFilesParams): Promise<{ content: Array<{ type: 'text', text: string }> }> {
    console.log('[moveFiles tool] Called with:', {
      operationCount: params.operations.length
    })
    
    const startTime = Date.now()
    const results: Array<{ operation: MoveOperation, success: boolean, error?: string }> = []
    let successfulOperations = 0
    
    try {
      // Process each operation sequentially
      for (const operation of params.operations) {
        console.log('[moveFiles tool] Processing operation:', operation)
        
        try {
          // Determine if this is a move or rename operation
          const fromDir = operation.from.substring(0, operation.from.lastIndexOf('/')) || '/'
          const toDir = operation.to.substring(0, operation.to.lastIndexOf('/')) || '/'
          const isRename = fromDir === toDir
          
          // Resolve source path to ID
          let sourceId: string
          try {
            sourceId = await driveService.resolvePathToId(operation.from)
          } catch (error) {
            // If path resolution fails, provide a more helpful error message
            console.error('[moveFiles tool] Failed to resolve source path:', operation.from, error)
            throw new Error(`Source file/folder not found: ${operation.from}`)
          }
          
          if (isRename) {
            // This is a rename operation (same directory)
            const newName = operation.to.split('/').pop()!
            
            // Check if it's a file or folder
            const files = await driveService.listDirectory({ folderId: fromDir === '/' ? 'root' : await driveService.resolvePathToId(fromDir) })
            const sourceFile = files.files.find(f => f.id === sourceId)
            
            if (!sourceFile) {
              throw new Error(`Source file/folder not found: ${operation.from}`)
            }
            
            if (sourceFile.isFolder) {
              await driveService.renameFolder(sourceId, newName)
            } else {
              await driveService.renameFile(sourceId, newName)
            }
          } else {
            // This is a move operation (different directory)
            let destinationParentId: string
            try {
              destinationParentId = await driveService.resolvePathToId(toDir)
            } catch (error) {
              console.error('[moveFiles tool] Failed to resolve destination path:', toDir, error)
              throw new Error(`Destination folder not found: ${toDir}`)
            }
            
            // Check if it's a file or folder
            const files = await driveService.listDirectory({ folderId: fromDir === '/' ? 'root' : await driveService.resolvePathToId(fromDir) })
            const sourceFile = files.files.find(f => f.id === sourceId)
            
            if (!sourceFile) {
              throw new Error(`Source file/folder not found: ${operation.from}`)
            }
            
            if (sourceFile.isFolder) {
              await driveService.moveFolder(sourceId, destinationParentId)
            } else {
              await driveService.moveFile(sourceId, destinationParentId)
            }
            
            // If the name is also changing, rename it
            const newName = operation.to.split('/').pop()!
            if (newName !== sourceFile.name) {
              if (sourceFile.isFolder) {
                await driveService.renameFolder(sourceId, newName)
              } else {
                await driveService.renameFile(sourceId, newName)
              }
            }
          }
          
          results.push({ operation, success: true })
          successfulOperations++
          
        } catch (error) {
          console.error('[moveFiles tool] Operation failed:', error)
          results.push({
            operation,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
      
      const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
      const result: MoveFilesResult = {
        success: successfulOperations === params.operations.length,
        message: successfulOperations === params.operations.length
          ? `Successfully moved/renamed ${successfulOperations} items`
          : `Completed with ${results.filter(r => !r.success).length} failures out of ${params.operations.length} operations`,
        summary: {
          totalOperations: params.operations.length,
          successfulOperations,
          failedOperations: results.filter(r => !r.success).length,
          duration
        },
        results
      }
      
      console.log('[moveFiles tool] Completed:', result.summary)
      
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
      console.error('[moveFiles tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'move_files',
    description: 
      'Moves or renames files and folders in Google Drive. ' +
      'Supports batch operations for moving multiple items at once. ' +
      'Can move items between folders, rename them, or both in a single operation. ' +
      '\n\nOperation types:\n' +
      '- Move: Change parent folder (e.g., "/docs/file.txt" → "/archive/file.txt")\n' +
      '- Rename: Change name in same folder (e.g., "/docs/old.txt" → "/docs/new.txt")\n' +
      '- Move + Rename: Both (e.g., "/docs/old.txt" → "/archive/new.txt")\n' +
      '\nImportant notes:\n' +
      '- Destination folders must exist before moving items into them\n' +
      '- Cannot move items to Trash (use Google Drive UI for that)\n' +
      '- Moving shared items may affect sharing permissions\n' +
      '- Operations are atomic per item (each succeeds or fails independently)',
    schema: moveFilesSchema.shape,
    handler: moveFiles
  }
}