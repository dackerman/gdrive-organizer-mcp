import { describe, it, expect, vi } from 'vitest'
import { createSearchFilesTool } from '../search-files'
import { DriveService, SearchFilesResult } from '../../types/drive'

describe('searchFiles tool', () => {
  it('should call DriveService with correct parameters', async () => {
    // Mock DriveService
    const mockResult: SearchFilesResult = {
      files: [
        {
          id: '123',
          name: 'report.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          createdTime: '2025-01-15T10:00:00Z',
          modifiedTime: '2025-01-15T11:00:00Z',
          parents: ['root'],
          path: '/report.pdf',
          isFolder: false,
          isShared: false,
          sharingStatus: 'private',
          folderDepth: 0
        },
        {
          id: '456',
          name: 'presentation.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          size: 5120,
          createdTime: '2025-01-10T10:00:00Z',
          modifiedTime: '2025-01-12T10:00:00Z',
          parents: ['documents-folder'],
          path: '/Documents/presentation.pptx',
          isFolder: false,
          isShared: true,
          sharingStatus: 'shared',
          folderDepth: 1
        }
      ]
    }

    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn().mockResolvedValue(mockResult)
    }

    // Create tool with mocked service
    const tool = createSearchFilesTool(mockDriveService)

    // Test the handler
    const result = await tool.handler({
      query: 'report',
      maxResults: 50
    })

    // Verify service was called correctly
    expect(mockDriveService.searchFiles).toHaveBeenCalledWith({
      query: 'report',
      maxResults: 50
    })

    // Verify response format
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockResult, null, 2)
        }
      ]
    })
  })

  it('should handle all search parameters', async () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn().mockResolvedValue({ files: [] })
    }

    const tool = createSearchFilesTool(mockDriveService)

    await tool.handler({
      query: 'budget',
      folderId: 'finance-folder-id',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      namePattern: '^budget_\\d{4}',
      maxResults: 100
    })

    expect(mockDriveService.searchFiles).toHaveBeenCalledWith({
      query: 'budget',
      folderId: 'finance-folder-id',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      namePattern: '^budget_\\d{4}',
      maxResults: 100
    })
  })

  it('should handle empty results', async () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn().mockResolvedValue({ files: [] })
    }

    const tool = createSearchFilesTool(mockDriveService)

    const result = await tool.handler({
      query: 'nonexistent'
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.files).toEqual([])
  })

  it('should handle errors', async () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn().mockRejectedValue(new Error('Search failed'))
    }

    const tool = createSearchFilesTool(mockDriveService)

    await expect(tool.handler({
      query: 'test'
    })).rejects.toThrow('Search failed')
  })

  it('should have correct metadata', () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn()
    }

    const tool = createSearchFilesTool(mockDriveService)

    expect(tool.name).toBe('search_files')
    expect(tool.description).toBe('Search for files across Google Drive by name, content, type, or location')
    expect(tool.schema).toBeDefined()
  })
})