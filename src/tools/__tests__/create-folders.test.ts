import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createCreateFoldersTool } from '../create-folders'
import { DriveService } from '../../types/drive'

// Mock the DriveService
const createMockDriveService = (): DriveService => ({
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  searchFiles: vi.fn(),
  moveFile: vi.fn(),
  moveFolder: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  renameFolder: vi.fn(),
  resolvePathToId: vi.fn(),
  resolveIdToPath: vi.fn(),
  buildDirectoryTree: vi.fn(),
  buildFileTree: vi.fn(),
})

describe('createFolders tool', () => {
  let mockDriveService: DriveService
  let tool: ReturnType<typeof createCreateFoldersTool>

  beforeEach(() => {
    mockDriveService = createMockDriveService()
    tool = createCreateFoldersTool(mockDriveService)
  })

  it('should create a single folder', async () => {
    // Mock path resolution - folder doesn't exist
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValueOnce(new Error('Path not found')) // /Documents doesn't exist
      .mockResolvedValueOnce('root') // / exists
      .mockResolvedValueOnce('created-folder-id') // After creation

    vi.mocked(mockDriveService.createFolder)
      .mockResolvedValueOnce({ id: 'created-folder-id' })

    const result = await tool.handler({
      paths: ['/Documents']
    })

    // Verify service calls
    expect(mockDriveService.createFolder).toHaveBeenCalledWith('Documents', 'root')

    // Parse and verify result
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toEqual({
      success: true,
      message: 'Successfully processed all 1 paths (1 created, 0 already existed)',
      summary: {
        totalPaths: 1,
        foldersCreated: 1,
        foldersExisted: 0,
        failures: 0
      },
      results: [
        {
          path: '/Documents',
          success: true,
          id: 'created-folder-id',
          created: true
        }
      ]
    })
  })

  it('should create multiple folders', async () => {
    // Mock resolutions
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValueOnce(new Error('Not found')) // /Folder1 doesn't exist
      .mockResolvedValueOnce('root') // / exists
      .mockRejectedValueOnce(new Error('Not found')) // /Folder2 doesn't exist
      .mockResolvedValueOnce('root') // / exists
      .mockRejectedValueOnce(new Error('Not found')) // /Folder3 doesn't exist
      .mockResolvedValueOnce('root') // / exists

    vi.mocked(mockDriveService.createFolder)
      .mockResolvedValueOnce({ id: 'folder1-id' })
      .mockResolvedValueOnce({ id: 'folder2-id' })
      .mockResolvedValueOnce({ id: 'folder3-id' })

    const result = await tool.handler({
      paths: ['/Folder1', '/Folder2', '/Folder3']
    })

    expect(mockDriveService.createFolder).toHaveBeenCalledTimes(3)
    
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersCreated).toBe(3)
    expect(parsed.results).toHaveLength(3)
    expect(parsed.results.every((r: any) => r.success && r.created)).toBe(true)
  })

  it('should create nested folders with parent creation', async () => {
    // This test is complex because we need to mock the parent creation flow
    // The tool will:
    // 1. Check if /Documents/Projects/2024 exists (no)
    // 2. Call ensureParentPath which checks /Documents (no), creates it
    // 3. Then checks /Documents/Projects (no), creates it
    // 4. Finally creates /Documents/Projects/2024
    
    const resolvePathCalls = [
      // Initial check for full path
      { path: '/Documents/Projects/2024', result: new Error('Not found') },
      // ensureParentPath checks
      { path: '/Documents', result: new Error('Not found') },
      { path: '/', result: 'root' },
      { path: '/Documents/Projects', result: new Error('Not found') },
      { path: '/Documents', result: 'documents-id' },
      // Final parent resolution
      { path: '/Documents/Projects', result: 'projects-id' }
    ]
    
    let callIndex = 0
    vi.mocked(mockDriveService.resolvePathToId)
      .mockImplementation(async (path) => {
        const call = resolvePathCalls[callIndex++]
        if (call.result instanceof Error) {
          throw call.result
        }
        return call.result
      })

    vi.mocked(mockDriveService.createFolder)
      .mockResolvedValueOnce({ id: 'documents-id' }) // Create Documents
      .mockResolvedValueOnce({ id: 'projects-id' }) // Create Projects
      .mockResolvedValueOnce({ id: '2024-id' }) // Create 2024

    const result = await tool.handler({
      paths: ['/Documents/Projects/2024']
    })

    // Should have created all three folders
    expect(mockDriveService.createFolder).toHaveBeenCalledTimes(3)
    expect(mockDriveService.createFolder).toHaveBeenCalledWith('Documents', 'root')
    expect(mockDriveService.createFolder).toHaveBeenCalledWith('Projects', 'documents-id')
    expect(mockDriveService.createFolder).toHaveBeenCalledWith('2024', 'projects-id')

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersCreated).toBe(1) // Only counts the requested folder, not parents
  })

  it('should skip existing folders by default', async () => {
    // Mock - folder already exists
    vi.mocked(mockDriveService.resolvePathToId)
      .mockResolvedValueOnce('existing-folder-id')

    const result = await tool.handler({
      paths: ['/ExistingFolder']
    })

    // Should not try to create
    expect(mockDriveService.createFolder).not.toHaveBeenCalled()

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersExisted).toBe(1)
    expect(parsed.summary.foldersCreated).toBe(0)
    expect(parsed.results[0]).toEqual({
      path: '/ExistingFolder',
      success: true,
      id: 'existing-folder-id',
      created: false
    })
  })

  it('should report error for existing folders when skipExisting is false', async () => {
    // Mock - folder already exists
    vi.mocked(mockDriveService.resolvePathToId)
      .mockResolvedValueOnce('existing-folder-id')

    const result = await tool.handler({
      paths: ['/ExistingFolder'],
      skipExisting: false
    })

    // Should not try to create
    expect(mockDriveService.createFolder).not.toHaveBeenCalled()

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false)
    expect(parsed.summary.failures).toBe(1)
    expect(parsed.results[0]).toEqual({
      path: '/ExistingFolder',
      success: false,
      error: 'Folder already exists',
      created: false
    })
  })

  it('should handle mixed success and failure', async () => {
    // Mock resolutions
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValueOnce(new Error('Not found')) // /Success doesn't exist
      .mockResolvedValueOnce('root')
      .mockRejectedValueOnce(new Error('Not found')) // /WillFail doesn't exist
      .mockResolvedValueOnce('root')
      .mockResolvedValueOnce('existing-id') // /AlreadyExists exists

    vi.mocked(mockDriveService.createFolder)
      .mockResolvedValueOnce({ id: 'success-id' })
      .mockRejectedValueOnce(new Error('Permission denied'))

    const result = await tool.handler({
      paths: ['/Success', '/WillFail', '/AlreadyExists']
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false) // Overall failure due to one error
    expect(parsed.summary).toEqual({
      totalPaths: 3,
      foldersCreated: 1,
      foldersExisted: 1,
      failures: 1
    })
    expect(parsed.results[1].error).toBe('Permission denied')
  })

  it('should handle empty paths array', async () => {
    await expect(
      tool.handler({ paths: [] })
    ).rejects.toThrow()
  })

  it('should normalize paths without leading slash', async () => {
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce('root')

    vi.mocked(mockDriveService.createFolder)
      .mockResolvedValueOnce({ id: 'folder-id' })

    const result = await tool.handler({
      paths: ['NoSlash'] // Missing leading slash
    })

    // Should normalize to /NoSlash
    expect(mockDriveService.resolvePathToId).toHaveBeenCalledWith('/NoSlash')
    
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.results[0].path).toBe('/NoSlash')
  })

  it('should handle service errors gracefully', async () => {
    vi.mocked(mockDriveService.resolvePathToId)
      .mockRejectedValue(new Error('Service unavailable'))

    const result = await tool.handler({
      paths: ['/TestFolder']
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false)
    expect(parsed.summary.failures).toBe(1)
    expect(parsed.results[0].error).toContain('Service unavailable')
  })

  it('should have correct metadata', () => {
    expect(tool.name).toBe('create_folders')
    expect(tool.description).toContain('Creates multiple folders in Google Drive')
    expect(tool.schema).toBeDefined()
    expect(tool.schema).toHaveProperty('paths')
    expect(tool.schema).toHaveProperty('skipExisting')
  })
})