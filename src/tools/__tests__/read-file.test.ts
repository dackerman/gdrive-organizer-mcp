import { describe, it, expect, vi } from 'vitest'
import { createReadFileTool } from '../read-file'
import { DriveService, ReadFileResult } from '../../types/drive'

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

    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn().mockResolvedValue(mockResult),
      searchFiles: vi.fn()
    }

    // Create tool with mocked service
    const tool = createReadFileTool(mockDriveService)

    // Test the handler
    const result = await tool.handler({
      fileId: 'test-file-id',
      maxSize: 1024
    })

    // Verify service was called correctly
    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'test-file-id',
      maxSize: 1024
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
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn().mockResolvedValue({
        content: 'Partial content',
        mimeType: 'text/plain',
        size: 15,
        truncated: true,
        encoding: 'utf-8'
      }),
      searchFiles: vi.fn()
    }

    const tool = createReadFileTool(mockDriveService)

    await tool.handler({
      fileId: 'test-file-id',
      startOffset: 100,
      endOffset: 200
    })

    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'test-file-id',
      startOffset: 100,
      endOffset: 200
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

    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn().mockResolvedValue(mockResult),
      searchFiles: vi.fn()
    }

    const tool = createReadFileTool(mockDriveService)

    const result = await tool.handler({
      fileId: 'binary-file-id'
    })

    expect(mockDriveService.readFile).toHaveBeenCalledWith({
      fileId: 'binary-file-id'
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.encoding).toBe('base64')
    expect(parsed.mimeType).toBe('application/pdf')
  })

  it('should handle errors', async () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn().mockRejectedValue(new Error('File not found')),
      searchFiles: vi.fn()
    }

    const tool = createReadFileTool(mockDriveService)

    await expect(tool.handler({
      fileId: 'non-existent-file'
    })).rejects.toThrow('File not found')
  })

  it('should have correct metadata', () => {
    const mockDriveService: DriveService = {
      listDirectory: vi.fn(),
      readFile: vi.fn(),
      searchFiles: vi.fn()
    }

    const tool = createReadFileTool(mockDriveService)

    expect(tool.name).toBe('read_file')
    expect(tool.description).toBe('Reads file content from Google Drive with optional pagination for large files')
    expect(tool.schema).toBeDefined()
  })
})