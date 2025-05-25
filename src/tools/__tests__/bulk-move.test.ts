import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBulkMoveTool } from '../bulk-move'
import { DriveService } from '../../types/drive'

// Mock DriveService
const createMockDriveService = (): DriveService => ({
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  searchFiles: vi.fn(),
  moveFile: vi.fn(),
  moveFolder: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  renameFolder: vi.fn()
})

describe('createBulkMoveTool', () => {
  let mockDriveService: DriveService
  let bulkMoveTool: ReturnType<typeof createBulkMoveTool>

  beforeEach(() => {
    mockDriveService = createMockDriveService()
    bulkMoveTool = createBulkMoveTool(mockDriveService)
  })

  it('should have correct name and description', () => {
    expect(bulkMoveTool.name).toBe('bulk_move')
    expect(bulkMoveTool.description).toBe('Executes a pre-defined organization plan synchronously')
  })

  it('should have correct schema', () => {
    expect(bulkMoveTool.schema).toMatchObject({
      planName: expect.any(Object),
      planDescription: expect.any(Object),
      operations: expect.any(Object)
    })
  })

  describe('handler', () => {
    it('should successfully execute a plan with all operations succeeding', async () => {
      const params = {
        planName: 'Test Plan',
        planDescription: 'Testing bulk move operations',
        operations: [
          {
            type: 'move_file' as const,
            sourceId: 'file1',
            sourcePath: '/old/file.txt',
            destinationParentId: 'folder1',
            destinationPath: '/new/file.txt',
            reason: 'Organizing files'
          },
          {
            type: 'create_folder' as const,
            sourcePath: '/new/subfolder',
            destinationParentId: 'folder1',
            destinationPath: '/new/subfolder',
            newName: 'subfolder',
            reason: 'Creating structure'
          }
        ]
      }

      vi.mocked(mockDriveService.moveFile).mockResolvedValueOnce(undefined)
      vi.mocked(mockDriveService.createFolder).mockResolvedValueOnce({ id: 'newfolder1' })

      const result = await bulkMoveTool.handler(params)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult).toMatchObject({
        success: true,
        message: 'Successfully executed plan: Test Plan',
        summary: {
          totalOperations: 2,
          successfulOperations: 2,
          failedOperations: 0,
          skippedOperations: 0,
          duration: expect.stringMatching(/^\d+s$/)
        }
      })
      expect(parsedResult.failures).toBeUndefined()

      expect(mockDriveService.moveFile).toHaveBeenCalledWith('file1', 'folder1')
      expect(mockDriveService.createFolder).toHaveBeenCalledWith('subfolder', 'folder1')
    })

    it('should handle mixed success and failure', async () => {
      const params = {
        planName: 'Mixed Results Plan',
        planDescription: 'Some operations will fail',
        operations: [
          {
            type: 'move_file' as const,
            sourceId: 'file1',
            sourcePath: '/file1.txt',
            destinationParentId: 'folder1',
            destinationPath: '/folder/file1.txt',
            reason: 'Move file 1'
          },
          {
            type: 'move_file' as const,
            sourceId: 'file2',
            sourcePath: '/file2.txt',
            destinationParentId: 'folder2',
            destinationPath: '/folder/file2.txt',
            reason: 'Move file 2'
          },
          {
            type: 'rename_file' as const,
            sourceId: 'file3',
            sourcePath: '/file3.txt',
            destinationPath: '/newname.txt',
            newName: 'newname.txt',
            reason: 'Rename file'
          }
        ]
      }

      vi.mocked(mockDriveService.moveFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File not found'))
      vi.mocked(mockDriveService.renameFile).mockResolvedValueOnce(undefined)

      const result = await bulkMoveTool.handler(params)
      const parsedResult = JSON.parse(result.content[0].text)

      expect(parsedResult).toMatchObject({
        success: false,
        message: 'Completed plan with 1 failures: Mixed Results Plan',
        summary: {
          totalOperations: 3,
          successfulOperations: 2,
          failedOperations: 1,
          skippedOperations: 0
        },
        failures: [
          {
            operation: expect.objectContaining({
              type: 'move_file',
              sourceId: 'file2'
            }),
            error: 'File not found'
          }
        ]
      })
    })

    it('should validate required fields for each operation type', async () => {
      const testCases = [
        {
          operation: {
            type: 'move_file' as const,
            sourcePath: '/file.txt',
            destinationPath: '/new/file.txt',
            reason: 'Missing sourceId and destinationParentId'
          },
          expectedError: 'move_file requires sourceId and destinationParentId'
        },
        {
          operation: {
            type: 'create_folder' as const,
            sourcePath: '/folder',
            destinationPath: '/parent/folder',
            reason: 'Missing newName and destinationParentId'
          },
          expectedError: 'create_folder requires newName and destinationParentId'
        },
        {
          operation: {
            type: 'rename_file' as const,
            sourcePath: '/file.txt',
            destinationPath: '/renamed.txt',
            reason: 'Missing sourceId and newName'
          },
          expectedError: 'rename_file requires sourceId and newName'
        }
      ]

      for (const { operation, expectedError } of testCases) {
        const params = {
          planName: 'Validation Test',
          planDescription: 'Testing field validation',
          operations: [operation]
        }

        const result = await bulkMoveTool.handler(params)
        const parsedResult = JSON.parse(result.content[0].text)

        expect(parsedResult.success).toBe(false)
        expect(parsedResult.failures).toHaveLength(1)
        expect(parsedResult.failures[0].error).toBe(expectedError)
      }
    })

    it('should handle all operation types correctly', async () => {
      const params = {
        planName: 'All Operations',
        planDescription: 'Testing all operation types',
        operations: [
          {
            type: 'move_file' as const,
            sourceId: 'file1',
            sourcePath: '/file.txt',
            destinationParentId: 'folder1',
            destinationPath: '/folder/file.txt',
            reason: 'Move file'
          },
          {
            type: 'move_folder' as const,
            sourceId: 'folder2',
            sourcePath: '/oldfolder',
            destinationParentId: 'folder3',
            destinationPath: '/parent/oldfolder',
            reason: 'Move folder'
          },
          {
            type: 'create_folder' as const,
            sourcePath: '/newfolder',
            destinationParentId: 'root',
            destinationPath: '/newfolder',
            newName: 'newfolder',
            reason: 'Create folder'
          },
          {
            type: 'rename_file' as const,
            sourceId: 'file2',
            sourcePath: '/oldname.txt',
            destinationPath: '/newname.txt',
            newName: 'newname.txt',
            reason: 'Rename file'
          },
          {
            type: 'rename_folder' as const,
            sourceId: 'folder4',
            sourcePath: '/oldFolderName',
            destinationPath: '/newFolderName',
            newName: 'newFolderName',
            reason: 'Rename folder'
          }
        ]
      }

      // Mock all operations to succeed
      vi.mocked(mockDriveService.moveFile).mockResolvedValue(undefined)
      vi.mocked(mockDriveService.moveFolder).mockResolvedValue(undefined)
      vi.mocked(mockDriveService.createFolder).mockResolvedValue({ id: 'newfolder1' })
      vi.mocked(mockDriveService.renameFile).mockResolvedValue(undefined)
      vi.mocked(mockDriveService.renameFolder).mockResolvedValue(undefined)

      const result = await bulkMoveTool.handler(params)
      const parsedResult = JSON.parse(result.content[0].text)

      expect(parsedResult.success).toBe(true)
      expect(parsedResult.summary.successfulOperations).toBe(5)
      expect(parsedResult.summary.failedOperations).toBe(0)

      // Verify all methods were called
      expect(mockDriveService.moveFile).toHaveBeenCalledWith('file1', 'folder1')
      expect(mockDriveService.moveFolder).toHaveBeenCalledWith('folder2', 'folder3')
      expect(mockDriveService.createFolder).toHaveBeenCalledWith('newfolder', 'root')
      expect(mockDriveService.renameFile).toHaveBeenCalledWith('file2', 'newname.txt')
      expect(mockDriveService.renameFolder).toHaveBeenCalledWith('folder4', 'newFolderName')
    })

    it('should continue processing after failures', async () => {
      const params = {
        planName: 'Continue After Failure',
        planDescription: 'Should process all operations even if some fail',
        operations: [
          {
            type: 'move_file' as const,
            sourceId: 'file1',
            sourcePath: '/file1.txt',
            destinationParentId: 'folder1',
            destinationPath: '/folder/file1.txt',
            reason: 'First operation - will succeed'
          },
          {
            type: 'move_file' as const,
            sourceId: 'file2',
            sourcePath: '/file2.txt',
            destinationParentId: 'folder2',
            destinationPath: '/folder/file2.txt',
            reason: 'Second operation - will fail'
          },
          {
            type: 'move_file' as const,
            sourceId: 'file3',
            sourcePath: '/file3.txt',
            destinationParentId: 'folder3',
            destinationPath: '/folder/file3.txt',
            reason: 'Third operation - should still execute'
          }
        ]
      }

      vi.mocked(mockDriveService.moveFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(undefined)

      const result = await bulkMoveTool.handler(params)
      const parsedResult = JSON.parse(result.content[0].text)

      expect(parsedResult.summary.successfulOperations).toBe(2)
      expect(parsedResult.summary.failedOperations).toBe(1)
      expect(mockDriveService.moveFile).toHaveBeenCalledTimes(3)
    })

    it('should measure execution time correctly', async () => {
      const params = {
        planName: 'Timing Test',
        planDescription: 'Test duration measurement',
        operations: [
          {
            type: 'create_folder' as const,
            sourcePath: '/folder',
            destinationParentId: 'root',
            destinationPath: '/folder',
            newName: 'folder',
            reason: 'Test timing'
          }
        ]
      }

      // Add a delay to the mock
      vi.mocked(mockDriveService.createFolder).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id: 'folder1' }
      })

      const result = await bulkMoveTool.handler(params)
      const parsedResult = JSON.parse(result.content[0].text)

      expect(parsedResult.summary.duration).toMatch(/^\d+s$/)
    })
  })
})