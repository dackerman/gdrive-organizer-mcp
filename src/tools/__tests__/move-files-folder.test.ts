import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMoveFilesTool } from '../move-files'
import { DriveService } from '../../types/drive'

describe('moveFiles tool - folder operations', () => {
  let mockDriveService: DriveService
  let tool: ReturnType<typeof createMoveFilesTool>

  beforeEach(() => {
    // Create a mock drive service
    mockDriveService = {
      resolvePathToId: vi.fn(),
      resolveIdToPath: vi.fn(),
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn(),
      moveFile: vi.fn(),
      moveFolder: vi.fn(),
      createFolder: vi.fn(),
      renameFile: vi.fn(),
      renameFolder: vi.fn(),
      buildDirectoryTree: vi.fn(),
      buildFileTree: vi.fn(),
    }

    tool = createMoveFilesTool(mockDriveService)
  })

  it('should handle folder names with spaces', async () => {
    const folderPath = '/Random files'
    const destinationPath = '/Housing Central/Random files'
    
    // Mock the resolvePathToId to simulate the error
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValueOnce(new Error(`Path not found: ${folderPath}`))
    
    const result = await tool.handler({
      operations: [{
        from: folderPath,
        to: destinationPath
      }]
    })

    const content = JSON.parse(result.content[0].text)
    
    expect(content.success).toBe(false)
    expect(content.results[0].error).toBe('Source file/folder not found: /Random files')
  })

  it('should successfully move a folder when path resolution works', async () => {
    const folderId = 'folder-123'
    const destinationParentId = 'dest-parent-123'
    
    // Mock successful path resolution
    vi.mocked(mockDriveService.resolvePathToId)
      .mockResolvedValueOnce(folderId) // source path
      .mockResolvedValueOnce(destinationParentId) // destination parent
      .mockResolvedValueOnce('root') // source parent (root) for listDirectory
    
    // Mock directory listing to identify it as a folder
    vi.mocked(mockDriveService.listDirectory).mockResolvedValue({
      files: [{
        id: folderId,
        name: 'Random files',
        mimeType: 'application/vnd.google-apps.folder',
        path: '/Random files',
        isFolder: true,
        isShared: false,
        sharingStatus: 'private',
        folderDepth: 0,
        parents: ['root'],
        createdTime: '',
        modifiedTime: ''
      }],
      nextPageToken: undefined
    })
    
    // Mock successful folder move
    vi.mocked(mockDriveService.moveFolder).mockResolvedValue()
    
    const result = await tool.handler({
      operations: [{
        from: '/Random files',
        to: '/Housing Central/Random files'
      }]
    })

    const content = JSON.parse(result.content[0].text)
    
    expect(content.success).toBe(true)
    expect(content.summary.successfulOperations).toBe(1)
    expect(mockDriveService.moveFolder).toHaveBeenCalledWith(folderId, destinationParentId)
  })

  it('should handle special characters in folder names', async () => {
    const testCases = [
      { from: "/Test's folder", to: "/Dest/Test's folder" },
      { from: '/Test & folder', to: '/Dest/Test & folder' },
      { from: '/Test (folder)', to: '/Dest/Test (folder)' },
      { from: '/Test - folder', to: '/Dest/Test - folder' }
    ]

    for (const testCase of testCases) {
      // Reset mocks
      vi.clearAllMocks()
      
      // Mock path resolution to fail with special characters
      vi.mocked(mockDriveService.resolvePathToId)
        .mockRejectedValueOnce(new Error(`Path not found: ${testCase.from}`))
      
      const result = await tool.handler({
        operations: [testCase]
      })

      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(false)
      expect(content.results[0].error).toBe(`Source file/folder not found: ${testCase.from}`)
    }
  })
})