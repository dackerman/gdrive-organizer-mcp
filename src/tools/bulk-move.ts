import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define operation type enum
export const OperationType = z.enum([
  'move_file',
  'move_folder',
  'create_folder',
  'rename_file',
  'rename_folder'
])

// Define the operation schema
export const operationSchema = z.object({
  type: OperationType,
  sourceId: z.string().optional(),
  sourcePath: z.string(),
  destinationParentId: z.string().optional(),
  destinationPath: z.string(),
  newName: z.string().optional(),
  reason: z.string()
})

// Define the schema for bulk_move parameters
export const bulkMoveSchema = z.object({
  planName: z.string(),
  planDescription: z.string(),
  operations: z.array(operationSchema)
})

// Type inference from schemas
export type OperationType = z.infer<typeof OperationType>
export type Operation = z.infer<typeof operationSchema>
export type BulkMoveParams = z.infer<typeof bulkMoveSchema>

// Result types
export interface BulkMoveResult {
  success: boolean
  message: string
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    skippedOperations: number
    duration: string
  }
  failures?: Array<{
    operation: Operation
    error: string
  }>
}

// Factory function to create the tool with injected dependencies
export function createBulkMoveTool(driveService: DriveService) {
  // The actual handler function
  async function bulkMove(params: BulkMoveParams): Promise<{ content: Array<{ type: 'text', text: string }> }> {
    console.log('[bulkMove tool] Called with:', {
      planName: params.planName,
      operationCount: params.operations.length
    })
    
    const startTime = Date.now()
    const failures: Array<{ operation: Operation, error: string }> = []
    let successfulOperations = 0
    let skippedOperations = 0
    
    try {
      // Process each operation sequentially
      for (const operation of params.operations) {
        console.log('[bulkMove tool] Processing operation:', {
          type: operation.type,
          sourcePath: operation.sourcePath,
          destinationPath: operation.destinationPath
        })
        
        try {
          switch (operation.type) {
            case 'move_file':
              if (!operation.sourceId || !operation.destinationParentId) {
                throw new Error('move_file requires sourceId and destinationParentId')
              }
              await driveService.moveFile(operation.sourceId, operation.destinationParentId)
              successfulOperations++
              break
              
            case 'move_folder':
              if (!operation.sourceId || !operation.destinationParentId) {
                throw new Error('move_folder requires sourceId and destinationParentId')
              }
              await driveService.moveFolder(operation.sourceId, operation.destinationParentId)
              successfulOperations++
              break
              
            case 'create_folder':
              if (!operation.newName || !operation.destinationParentId) {
                throw new Error('create_folder requires newName and destinationParentId')
              }
              await driveService.createFolder(operation.newName, operation.destinationParentId)
              successfulOperations++
              break
              
            case 'rename_file':
              if (!operation.sourceId || !operation.newName) {
                throw new Error('rename_file requires sourceId and newName')
              }
              await driveService.renameFile(operation.sourceId, operation.newName)
              successfulOperations++
              break
              
            case 'rename_folder':
              if (!operation.sourceId || !operation.newName) {
                throw new Error('rename_folder requires sourceId and newName')
              }
              await driveService.renameFolder(operation.sourceId, operation.newName)
              successfulOperations++
              break
              
            default:
              // TypeScript exhaustiveness check
              const _exhaustive: never = operation.type
              throw new Error(`Unknown operation type: ${operation.type}`)
          }
        } catch (error) {
          console.error('[bulkMove tool] Operation failed:', error)
          failures.push({
            operation,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
      
      const duration = `${Math.round((Date.now() - startTime) / 1000)}s`
      const result: BulkMoveResult = {
        success: failures.length === 0,
        message: failures.length === 0 
          ? `Successfully executed plan: ${params.planName}`
          : `Completed plan with ${failures.length} failures: ${params.planName}`,
        summary: {
          totalOperations: params.operations.length,
          successfulOperations,
          failedOperations: failures.length,
          skippedOperations,
          duration
        },
        ...(failures.length > 0 && { failures })
      }
      
      console.log('[bulkMove tool] Completed:', result.summary)
      
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
      console.error('[bulkMove tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'bulk_move',
    description: 'Executes a pre-defined organization plan synchronously',
    schema: bulkMoveSchema.shape,
    handler: bulkMove
  }
}