import { describe, it, expect, beforeEach } from 'vitest'
import { createCreateFoldersTool } from '../create-folders'
import { DriveService } from '../../types/drive'
import { GoogleDriveTestFactory } from '../../test/google-drive-test-factory'
import { GoogleDriveApiStub } from '../../test/google-drive-api-stub'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

describe('createFolders tool', () => {
  let driveService: DriveService
  let apiStub: GoogleDriveApiStub
  let tool: ReturnType<typeof createCreateFoldersTool>

  beforeEach(() => {
    const { stub, service } = GoogleDriveTestFactory.createMinimal()
    apiStub = stub
    driveService = service
    tool = createCreateFoldersTool(driveService)
  })

  it('should create a single folder', async () => {
    // The folder doesn't exist initially, so the stub will create it
    const result = await tool.handler({
      paths: ['/Documents'],
    })

    // Parse and verify result
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toEqual({
      success: true,
      message: 'Successfully processed all 1 paths (1 created, 0 already existed)',
      summary: {
        totalPaths: 1,
        foldersCreated: 1,
        foldersExisted: 0,
        failures: 0,
      },
      results: [
        {
          path: '/Documents',
          success: true,
          id: expect.stringMatching(/^file-\d+$/),
          created: true,
        },
      ],
    })

    // Verify the folder was actually created in the stub
    const allFiles = apiStub.getAllFiles()
    const documentsFolder = allFiles.find((f) => f.name === 'Documents' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)
    expect(documentsFolder).toBeDefined()
    expect(documentsFolder?.parents).toEqual(['root'])
  })

  it('should create multiple folders', async () => {
    const result = await tool.handler({
      paths: ['/Folder1', '/Folder2', '/Folder3'],
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersCreated).toBe(3)
    expect(parsed.results).toHaveLength(3)
    expect(parsed.results.every((r: any) => r.success && r.created)).toBe(true)

    // Verify all folders were created in the stub
    const allFiles = apiStub.getAllFiles()
    const createdFolders = allFiles.filter(
      (f) => ['Folder1', 'Folder2', 'Folder3'].includes(f.name) && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER,
    )
    expect(createdFolders).toHaveLength(3)
    expect(createdFolders.every((f) => f.parents?.[0] === 'root')).toBe(true)
  })

  it('should create nested folders with parent creation', async () => {
    // The tool will automatically create parent folders as needed
    const result = await tool.handler({
      paths: ['/Documents/Projects/2024'],
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersCreated).toBe(1) // Only counts the requested folder, not parents

    // Verify the entire folder structure was created
    const allFiles = apiStub.getAllFiles()

    const documentsFolder = allFiles.find((f) => f.name === 'Documents' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)
    expect(documentsFolder).toBeDefined()
    expect(documentsFolder?.parents).toEqual(['root'])

    const projectsFolder = allFiles.find((f) => f.name === 'Projects' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)
    expect(projectsFolder).toBeDefined()
    expect(projectsFolder?.parents).toEqual([documentsFolder!.id])

    const yearFolder = allFiles.find((f) => f.name === '2024' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)
    expect(yearFolder).toBeDefined()
    expect(yearFolder?.parents).toEqual([projectsFolder!.id])
  })

  it('should skip existing folders by default', async () => {
    // Create a folder first
    const existingFolder = apiStub.addTestFile({
      name: 'ExistingFolder',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      paths: ['/ExistingFolder'],
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.summary.foldersExisted).toBe(1)
    expect(parsed.summary.foldersCreated).toBe(0)
    expect(parsed.results[0]).toEqual({
      path: '/ExistingFolder',
      success: true,
      id: existingFolder.id,
      created: false,
    })

    // Verify no new folders were created
    const allFiles = apiStub.getAllFiles()
    const foldersWithName = allFiles.filter((f) => f.name === 'ExistingFolder')
    expect(foldersWithName).toHaveLength(1)
  })

  it('should report error for existing folders when skipExisting is false', async () => {
    // Create a folder first
    apiStub.addTestFile({
      name: 'ExistingFolder',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      paths: ['/ExistingFolder'],
      skipExisting: false,
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false)
    expect(parsed.summary.failures).toBe(1)
    expect(parsed.results[0]).toEqual({
      path: '/ExistingFolder',
      success: false,
      error: 'Folder already exists',
      created: false,
    })
  })

  it('should handle mixed success and failure', async () => {
    // Create an existing folder
    apiStub.addTestFile({
      name: 'AlreadyExists',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    // Override filesCreate to simulate a failure for one folder
    const originalFilesCreate = apiStub.filesCreate.bind(apiStub)
    let createCallCount = 0
    apiStub.filesCreate = async (params) => {
      createCallCount++
      if (createCallCount === 2 && params.requestBody.name === 'WillFail') {
        throw new Error('Permission denied')
      }
      return originalFilesCreate(params)
    }

    const result = await tool.handler({
      paths: ['/Success', '/WillFail', '/AlreadyExists'],
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false) // Overall failure due to one error
    expect(parsed.summary).toEqual({
      totalPaths: 3,
      foldersCreated: 1,
      foldersExisted: 1,
      failures: 1,
    })
    expect(parsed.results[1].error).toBe('Permission denied')
  })

  it('should handle empty paths array', async () => {
    await expect(tool.handler({ paths: [] })).rejects.toThrow()
  })

  it('should normalize paths without leading slash', async () => {
    const result = await tool.handler({
      paths: ['NoSlash'], // Missing leading slash
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.results[0].path).toBe('/NoSlash')

    // Verify the folder was created with normalized path
    const allFiles = apiStub.getAllFiles()
    const folder = allFiles.find((f) => f.name === 'NoSlash' && f.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER)
    expect(folder).toBeDefined()
  })

  it('should handle service errors gracefully', async () => {
    // Override filesCreate to simulate a service error when creating the folder
    apiStub.filesCreate = async () => {
      throw new Error('Service unavailable')
    }

    const result = await tool.handler({
      paths: ['/TestFolder'],
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
