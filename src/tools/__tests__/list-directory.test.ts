import { describe, it, expect, vi } from 'vitest'
import { createListDirectoryTool } from '../list-directory'
import { ListDirectoryResult } from '../../types/drive'
import { createMockDriveService } from './test-utils'

describe('listDirectory tool', () => {
  it('should call DriveService with correct parameters', async () => {
    // Mock DriveService
    const mockResult: ListDirectoryResult = {
      files: [
        {
          id: '123',
          name: 'test-file.txt',
          mimeType: 'text/plain',
          size: 1024,
          createdTime: '2025-01-15T10:00:00Z',
          modifiedTime: '2025-01-15T11:00:00Z',
          parents: ['root'],
          path: '/test-file.txt',
          isFolder: false,
          isShared: false,
          sharingStatus: 'private',
          folderDepth: 0
        },
        {
          id: '456',
          name: 'Documents',
          mimeType: 'application/vnd.google-apps.folder',
          createdTime: '2025-01-10T10:00:00Z',
          modifiedTime: '2025-01-10T10:00:00Z',
          parents: ['root'],
          path: '/Documents',
          isFolder: true,
          isShared: false,
          sharingStatus: 'private',
          folderDepth: 0
        }
      ]
    }

    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.listDirectory).mockResolvedValue(mockResult)

    // Create tool with mocked service
    const tool = createListDirectoryTool(mockDriveService)

    // Test the handler
    const result = await tool.handler(
      { folderPath: '/test-folder', pageSize: 50 }
    )

    // Verify service was called correctly
    expect(mockDriveService.listDirectory).toHaveBeenCalledWith({
      folderPath: '/test-folder',
      pageSize: 50
    })

    // Verify response format
    const expectedFormattedResult = {
      files: [
        {
          path: '/test-file.txt',
          name: 'test-file.txt',
          isDirectory: false,
          isShared: false
        },
        {
          path: '/Documents',
          name: 'Documents',
          isDirectory: true,
          isShared: false
        }
      ],
      nextPageToken: undefined,
      hasMore: false
    }
    
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(expectedFormattedResult, null, 2)
        }
      ]
    })
  })

  it('should use default values when parameters are not provided', async () => {
    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.listDirectory).mockResolvedValue({ files: [], nextPageToken: undefined })

    const tool = createListDirectoryTool(mockDriveService)

    await tool.handler({})

    expect(mockDriveService.listDirectory).toHaveBeenCalledWith({})
  })

  it('should have correct metadata', () => {
    const mockDriveService = createMockDriveService()

    const tool = createListDirectoryTool(mockDriveService)

    expect(tool.name).toBe('list_directory')
    expect(tool.description).toBe('Lists files and folders in a Google Drive directory. Supports pagination to limit response size. Use folderPath (e.g., "/Documents") instead of folder IDs for easier navigation.')
    expect(tool.schema).toBeDefined()
  })
})