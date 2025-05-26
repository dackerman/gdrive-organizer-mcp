import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createShowDirectoryTreeTool, showDirectoryTreeSchema } from '../show-directory-tree'
import { DriveService } from '../../types/drive'

// Mock DriveService
const mockDriveService: DriveService = {
  listDirectory: vi.fn(),
  searchFiles: vi.fn(),
  readFile: vi.fn(),
  moveFile: vi.fn(),
  moveFiles: vi.fn(),
  renameFile: vi.fn(),
  renameFolder: vi.fn(),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  uploadFile: vi.fn(),
  exportFile: vi.fn(),
  copyFile: vi.fn(),
  shareFile: vi.fn(),
  getFileMetadata: vi.fn(),
  updateFileMetadata: vi.fn(),
  resolvePathToId: vi.fn(),
  resolveIdToPath: vi.fn(),
  buildDirectoryTree: vi.fn(),
  buildFileTree: vi.fn(),
}

describe('showDirectoryTree tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return flat list of all directories at multiple depth levels', async () => {
    // Mock buildDirectoryTree to return multiple levels of directories
    vi.mocked(mockDriveService.buildDirectoryTree).mockResolvedValue([
      '/',
      '/Documents',
      '/Documents/Work',
      '/Documents/Work/Projects',
      '/Documents/Personal',
      '/Photos',
      '/Photos/2023',
      '/Photos/2023/Summer',
      '/Photos/2024',
      '/Videos'
    ])

    const tool = createShowDirectoryTreeTool(mockDriveService)
    const result = await tool.handler({ rootPath: '/', maxDepth: 3 })

    // Verify the service was called with correct parameters
    expect(mockDriveService.buildDirectoryTree).toHaveBeenCalledWith('/', 3)

    // Verify the output is a flat list of paths
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toBe(
      `/
/Documents
/Documents/Personal
/Documents/Work
/Documents/Work/Projects
/Photos
/Photos/2023
/Photos/2023/Summer
/Photos/2024
/Videos`
    )
  })

  it('should handle single level directory tree', async () => {
    // Mock buildDirectoryTree to return only root level directories
    vi.mocked(mockDriveService.buildDirectoryTree).mockResolvedValue([
      '/',
      '/Documents',
      '/Photos',
      '/Videos'
    ])

    const tool = createShowDirectoryTreeTool(mockDriveService)
    const result = await tool.handler({ rootPath: '/', maxDepth: 1 })

    expect(mockDriveService.buildDirectoryTree).toHaveBeenCalledWith('/', 1)
    expect(result.content[0].text).toBe(
      `/
/Documents
/Photos
/Videos`
    )
  })

  it('should handle subdirectory as root', async () => {
    // Mock buildDirectoryTree to return directories under /Documents
    vi.mocked(mockDriveService.buildDirectoryTree).mockResolvedValue([
      '/Documents',
      '/Documents/Work',
      '/Documents/Work/Projects',
      '/Documents/Work/Projects/ProjectA',
      '/Documents/Work/Projects/ProjectB',
      '/Documents/Personal',
      '/Documents/Personal/Finance',
      '/Documents/Personal/Health'
    ])

    const tool = createShowDirectoryTreeTool(mockDriveService)
    const result = await tool.handler({ rootPath: '/Documents', maxDepth: 3 })

    expect(mockDriveService.buildDirectoryTree).toHaveBeenCalledWith('/Documents', 3)
    expect(result.content[0].text).toBe(
      `/Documents
/Documents/Personal
/Documents/Personal/Finance
/Documents/Personal/Health
/Documents/Work
/Documents/Work/Projects
/Documents/Work/Projects/ProjectA
/Documents/Work/Projects/ProjectB`
    )
  })

  it('should handle empty directory tree', async () => {
    vi.mocked(mockDriveService.buildDirectoryTree).mockResolvedValue([])

    const tool = createShowDirectoryTreeTool(mockDriveService)
    const result = await tool.handler({ rootPath: '/EmptyFolder', maxDepth: 2 })

    expect(result.content[0].text).toBe('No directories found.')
  })

  it('should use default parameters', async () => {
    vi.mocked(mockDriveService.buildDirectoryTree).mockResolvedValue(['/'])

    const tool = createShowDirectoryTreeTool(mockDriveService)
    // Pass the empty object through the schema to get defaults
    const params = showDirectoryTreeSchema.parse({})
    const result = await tool.handler(params)

    expect(mockDriveService.buildDirectoryTree).toHaveBeenCalledWith('/', 3)
  })

  it('should propagate errors from DriveService', async () => {
    vi.mocked(mockDriveService.buildDirectoryTree).mockRejectedValue(
      new Error('API Error')
    )

    const tool = createShowDirectoryTreeTool(mockDriveService)
    
    await expect(tool.handler({ rootPath: '/', maxDepth: 2 })).rejects.toThrow('API Error')
  })
})