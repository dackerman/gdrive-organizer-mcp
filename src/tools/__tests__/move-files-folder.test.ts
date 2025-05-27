import { describe, it, expect, beforeEach } from 'vitest'
import { createMoveFilesTool } from '../move-files'
import { DriveService } from '../../types/drive'
import { GoogleDriveTestFactory } from '../../test/google-drive-test-factory'
import { GoogleDriveApiStub } from '../../test/google-drive-api-stub'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

describe('moveFiles tool - folder operations', () => {
  let driveService: DriveService
  let apiStub: GoogleDriveApiStub
  let tool: ReturnType<typeof createMoveFilesTool>

  beforeEach(() => {
    const { stub, service } = GoogleDriveTestFactory.createMinimal()
    apiStub = stub
    driveService = service
    tool = createMoveFilesTool(driveService)
  })

  it('should handle folder names with spaces', async () => {
    // Add a folder with spaces in the name
    const folder = apiStub.addTestFile({
      id: 'random-files-folder',
      name: 'Random files',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    // Create destination parent folder
    const housingCentral = apiStub.addTestFile({
      id: 'housing-central',
      name: 'Housing Central',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      operations: [
        {
          from: '/Random files',
          to: '/Housing Central/Random files',
        },
      ],
    })

    const content = JSON.parse(result.content[0].text)

    expect(content.success).toBe(true)
    expect(content.summary.successfulOperations).toBe(1)

    // Verify the folder was moved
    const movedFolder = apiStub.getAllFiles().find((f) => f.id === folder.id)
    expect(movedFolder?.parents).toEqual([housingCentral.id])
  })

  it('should handle non-existent source folder', async () => {
    const result = await tool.handler({
      operations: [
        {
          from: '/Non-existent folder',
          to: '/Some destination',
        },
      ],
    })

    const content = JSON.parse(result.content[0].text)

    expect(content.success).toBe(false)
    expect(content.results[0].error).toBe('Source file/folder not found: /Non-existent folder')
  })

  it('should successfully move a folder', async () => {
    // Create source folder
    const sourceFolder = apiStub.addTestFile({
      id: 'source-folder',
      name: 'My Documents',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    // Add some files in the folder
    apiStub.addTestFile({
      name: 'file1.txt',
      mimeType: 'text/plain',
      parents: [sourceFolder.id],
    })

    apiStub.addTestFile({
      name: 'file2.txt',
      mimeType: 'text/plain',
      parents: [sourceFolder.id],
    })

    // Create destination folder
    const destFolder = apiStub.addTestFile({
      id: 'dest-folder',
      name: 'Archive',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      operations: [
        {
          from: '/My Documents',
          to: '/Archive/My Documents',
        },
      ],
    })

    const content = JSON.parse(result.content[0].text)

    expect(content.success).toBe(true)
    expect(content.summary.successfulOperations).toBe(1)

    // Verify the folder was moved
    const movedFolder = apiStub.getAllFiles().find((f) => f.id === sourceFolder.id)
    expect(movedFolder?.parents).toEqual([destFolder.id])

    // Verify files still belong to the moved folder
    const filesInFolder = apiStub.getAllFiles().filter((f) => f.parents?.[0] === sourceFolder.id)
    expect(filesInFolder).toHaveLength(2)
  })

  it('should handle special characters in folder names', async () => {
    // Test with folders that don't have apostrophes
    // (apostrophes in Google Drive queries need special escaping)
    const testCases = [
      { name: 'Test & folder', safeName: 'test-ampersand' },
      { name: 'Test (folder)', safeName: 'test-parens' },
      { name: 'Test - folder', safeName: 'test-dash' },
      { name: 'Test @ folder', safeName: 'test-at' },
    ]

    // Create destination folder
    const destFolder = apiStub.addTestFile({
      id: 'dest-folder',
      name: 'Dest',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    for (const testCase of testCases) {
      // Create folder with special characters
      const folder = apiStub.addTestFile({
        id: `${testCase.safeName}-id`,
        name: testCase.name,
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: ['root'],
      })

      const result = await tool.handler({
        operations: [
          {
            from: `/${testCase.name}`,
            to: `/Dest/${testCase.name}`,
          },
        ],
      })

      const content = JSON.parse(result.content[0].text)

      expect(content.success).toBe(true)
      expect(content.summary.successfulOperations).toBe(1)

      // Verify the folder was moved
      const movedFolder = apiStub.getAllFiles().find((f) => f.id === folder.id)
      expect(movedFolder?.parents).toEqual([destFolder.id])
    }
  })

  it('should handle moving to non-existent destination', async () => {
    // Create source folder
    const sourceFolder = apiStub.addTestFile({
      id: 'source-folder',
      name: 'Source',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      operations: [
        {
          from: '/Source',
          to: '/NonExistent/Source',
        },
      ],
    })

    const content = JSON.parse(result.content[0].text)

    expect(content.success).toBe(false)
    expect(content.results[0].error).toContain('Destination folder not found')
  })

  it('should handle multiple folder moves', async () => {
    // Create folders
    const folder1 = apiStub.addTestFile({
      id: 'folder1',
      name: 'Folder1',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const folder2 = apiStub.addTestFile({
      id: 'folder2',
      name: 'Folder2',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const destFolder = apiStub.addTestFile({
      id: 'archive',
      name: 'Archive',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const result = await tool.handler({
      operations: [
        {
          from: '/Folder1',
          to: '/Archive/Folder1',
        },
        {
          from: '/Folder2',
          to: '/Archive/Folder2',
        },
      ],
    })

    const content = JSON.parse(result.content[0].text)

    expect(content.success).toBe(true)
    expect(content.summary.successfulOperations).toBe(2)

    // Verify both folders were moved
    const movedFolder1 = apiStub.getAllFiles().find((f) => f.id === folder1.id)
    const movedFolder2 = apiStub.getAllFiles().find((f) => f.id === folder2.id)
    expect(movedFolder1?.parents).toEqual([destFolder.id])
    expect(movedFolder2?.parents).toEqual([destFolder.id])
  })
})
