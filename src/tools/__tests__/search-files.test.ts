import { describe, it, expect, beforeEach } from 'vitest'
import { createSearchFilesTool } from '../search-files'
import { DriveService } from '../../types/drive'
import { GoogleDriveTestFactory } from '../../test/google-drive-test-factory'
import { GoogleDriveApiStub } from '../../test/google-drive-api-stub'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

describe('searchFiles tool', () => {
  let driveService: DriveService
  let apiStub: GoogleDriveApiStub
  let tool: ReturnType<typeof createSearchFilesTool>

  beforeEach(() => {
    const { stub, service } = GoogleDriveTestFactory.createWithTestData()
    apiStub = stub
    driveService = service
    tool = createSearchFilesTool(driveService)
  })

  it('should search for files by query', async () => {
    // Add some test files with specific names
    apiStub.addTestFile({
      id: 'report-2024',
      name: 'Annual Report 2024.pdf',
      mimeType: 'application/pdf',
      parents: ['documents-folder'],
      size: '2048576',
    })

    apiStub.addTestFile({
      id: 'report-2023',
      name: 'Annual Report 2023.pdf',
      mimeType: 'application/pdf',
      parents: ['documents-folder'],
      size: '1048576',
    })

    // Search for "report"
    const result = await tool.handler({
      query: 'report',
      maxResults: 50,
    })

    // Verify response format
    const parsedContent = JSON.parse(result.content[0].text)

    // Should find at least the files we added plus the existing report.pdf
    const reportFiles = parsedContent.files.filter((f: any) => f.name.toLowerCase().includes('report'))
    expect(reportFiles.length).toBeGreaterThanOrEqual(3)

    // Verify the structure of returned files
    const annualReport = parsedContent.files.find((f: any) => f.name === 'Annual Report 2024.pdf')
    expect(annualReport).toBeDefined()
    expect(annualReport).toMatchObject({
      id: 'report-2024',
      name: 'Annual Report 2024.pdf',
      path: expect.stringContaining('Annual Report 2024.pdf'),
      mimeType: 'application/pdf',
      size: 2048576,
      isFolder: false,
    })

    expect(parsedContent.totalResults).toBeGreaterThanOrEqual(3)
  })

  it('should handle search with folder filter', async () => {
    // Get the Documents folder ID
    const documentsFolder = apiStub.getAllFiles().find((f) => f.name === 'Documents' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)

    // Add a file outside Documents with unique name
    apiStub.addTestFile({
      id: 'root-expenses',
      name: 'expenses.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: ['root'],
    })

    // Add a file inside Documents with unique name
    apiStub.addTestFile({
      id: 'docs-expenses',
      name: 'expenses-2024.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: [documentsFolder!.id],
    })

    // Search within Documents folder only
    const result = await tool.handler({
      query: 'expenses',
      folderId: documentsFolder!.id,
      maxResults: 100,
    })

    const parsed = JSON.parse(result.content[0].text)

    // Should only find the expenses file in Documents
    expect(parsed.files).toHaveLength(1)
    expect(parsed.files[0].name).toBe('expenses-2024.xlsx')
  })

  it('should handle search with mimeType filter', async () => {
    // Add various file types
    apiStub.addTestFile({
      name: 'test-doc.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      parents: ['root'],
    })

    apiStub.addTestFile({
      name: 'test-sheet.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: ['root'],
    })

    apiStub.addTestFile({
      name: 'test-google-sheet',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET,
      parents: ['root'],
    })

    // Search for Google Sheets only
    const result = await tool.handler({
      query: 'test',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET,
      maxResults: 100,
    })

    const parsed = JSON.parse(result.content[0].text)

    // Should only find Google Sheets
    expect(parsed.files.every((f: any) => f.mimeType === GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET)).toBe(true)
    expect(parsed.files.some((f: any) => f.name === 'test-google-sheet')).toBe(true)
  })

  it('should handle search with name pattern', async () => {
    // Add files with pattern
    for (let year = 2020; year <= 2024; year++) {
      apiStub.addTestFile({
        name: `budget_${year}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        parents: ['root'],
      })
    }

    // Add a file that doesn't match the pattern
    apiStub.addTestFile({
      name: 'budget-draft.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parents: ['root'],
    })

    const result = await tool.handler({
      query: 'budget',
      namePattern: '^budget_\\d{4}',
      maxResults: 100,
    })

    const parsed = JSON.parse(result.content[0].text)

    // Should only find files matching the pattern
    expect(parsed.files).toHaveLength(5)
    expect(parsed.files.every((f: any) => /^budget_\d{4}\.xlsx$/.test(f.name))).toBe(true)
  })

  it('should handle empty results', async () => {
    const result = await tool.handler({
      query: 'nonexistent-file-name-that-should-not-exist',
      maxResults: 50,
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.files).toEqual([])
    expect(parsed.totalResults).toBe(0)
  })

  it('should handle search errors', async () => {
    // Override searchFiles to simulate an error
    const originalFilesList = apiStub.filesList.bind(apiStub)
    apiStub.filesList = async () => {
      throw new Error('Search failed')
    }

    await expect(
      tool.handler({
        query: 'test',
        maxResults: 50,
      }),
    ).rejects.toThrow('Search failed')
  })

  it('should respect maxResults limit', async () => {
    // Add many files
    for (let i = 1; i <= 20; i++) {
      apiStub.addTestFile({
        name: `document-${i}.txt`,
        mimeType: 'text/plain',
        parents: ['root'],
      })
    }

    const result = await tool.handler({
      query: 'document',
      maxResults: 5,
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.files.length).toBeLessThanOrEqual(5)
  })

  it('should have correct metadata', () => {
    expect(tool.name).toBe('search_files')
    expect(tool.description).toContain('Search for files across your entire Google Drive')
    expect(tool.schema).toBeDefined()

    // Verify schema properties
    expect(tool.schema).toHaveProperty('query')
    expect(tool.schema).toHaveProperty('folderId')
    expect(tool.schema).toHaveProperty('mimeType')
    expect(tool.schema).toHaveProperty('namePattern')
    expect(tool.schema).toHaveProperty('maxResults')
  })
})
