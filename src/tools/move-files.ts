import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for individual move operations
export const moveOperationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
})

// Define the schema for move_files parameters
export const moveFilesSchema = z.object({
  operations: z.array(moveOperationSchema).min(1)
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
          const sourceId = await driveService.resolvePathToId(operation.from)
          
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
            const destinationParentId = await driveService.resolvePathToId(toDir)
            
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
    description: 'Moves or renames files and folders using path-based operations. Each operation specifies a from and to path.',
    schema: moveFilesSchema.shape,
    handler: moveFiles
  }
}