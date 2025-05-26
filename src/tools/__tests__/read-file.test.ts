import { describe, it, expect, vi } from 'vitest'
import { createReadFileTool } from '../read-file'
import { ReadFileResult } from '../../types/drive'
import { createMockDriveService } from './test-utils'

describe('readFile tool', () => {
  it('should call DriveService with correct parameters', async () => {
    // Mock DriveService
    const mockResult: ReadFileResult = {
      content: 'Hello, World!',
      mimeType: 'text/plain',
      size: 13,
      truncated: false,
      encoding: 'utf-8'
    }

    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.readFile).mockResolvedValue(mockResult)

    // Create tool with mocked service
    const tool = createReadFileTool(mockDriveService)

    // Mock path resolution
    vi.mocked(mockDriveService.resolvePathToId).mockResolvedValue('test-file-id')

    // Test the handler
    const result = await tool.handler({
      filePath: '/Documents/test.txt',
      maxSize: 1024
    })

    // Verify path resolution was called
    expect(mockDriveService.resolvePathToId).toHaveBeenCalledWith('/Documents/test.txt')
    
    // Verify service was called correctly with resolved ID
    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'test-file-id',
      maxSize: 1024,
      startOffset: undefined,
      endOffset: undefined
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

  it('should handle pagination parameters', async () => {
    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.readFile).mockResolvedValue({
      content: 'Partial content',
      mimeType: 'text/plain',
      size: 15,
      truncated: true,
      encoding: 'utf-8'
    })

    const tool = createReadFileTool(mockDriveService)

    // Mock path resolution
    vi.mocked(mockDriveService.resolvePathToId).mockResolvedValue('test-file-id')

    await tool.handler({
      filePath: '/Documents/large-file.txt',
      startOffset: 100,
      endOffset: 200
    })

    expect(mockDriveService.resolvePathToId).toHaveBeenCalledWith('/Documents/large-file.txt')
    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'test-file-id',
      startOffset: 100,
      endOffset: 200,
      maxSize: undefined
    })
  })

  it('should handle binary files', async () => {
    const mockResult: ReadFileResult = {
      content: 'SGVsbG8gV29ybGQh', // Base64 encoded "Hello World!"
      mimeType: 'application/pdf',
      size: 12,
      truncated: false,
      encoding: 'base64'
    }

    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.readFile).mockResolvedValue(mockResult)

    const tool = createReadFileTool(mockDriveService)

    // Mock path resolution
    vi.mocked(mockDriveService.resolvePathToId).mockResolvedValue('binary-file-id')

    const result = await tool.handler({
      filePath: '/Documents/report.pdf'
    })

    expect(mockDriveService.resolvePathToId).toHaveBeenCalledWith('/Documents/report.pdf')
    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'binary-file-id',
      maxSize: undefined,
      startOffset: undefined,
      endOffset: undefined
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.encoding).toBe('base64')
    expect(parsed.mimeType).toBe('application/pdf')
  })

  it('should handle errors', async () => {
    const mockDriveService = createMockDriveService()
    vi.mocked(mockDriveService.resolvePathToId).mockRejectedValue(new Error('File not found'))

    const tool = createReadFileTool(mockDriveService)

    await expect(tool.handler({
      filePath: '/nonexistent/file.txt'
    })).rejects.toThrow('File not found')
  })

  it('should have correct metadata', () => {
    const mockDriveService = createMockDriveService()

    const tool = createReadFileTool(mockDriveService)

    expect(tool.name).toBe('read_file')
    expect(tool.description).toBe('Reads file content from Google Drive using file path with optional pagination for large files')
    expect(tool.schema).toBeDefined()
  })
})