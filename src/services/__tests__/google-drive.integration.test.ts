import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GoogleDriveService } from '../google-drive'
import { getTestCredentials, setTestFolderId } from '../../test/integration-setup'

describe('GoogleDriveService Integration Tests', () => {
  let service: GoogleDriveService
  let testFolderId: string
  let testFileId: string
  const testFolderName = `test-gdrive-organizer-${Date.now()}`

  beforeAll(async () => {
    const credentials = getTestCredentials()
    service = new GoogleDriveService(
      '', // We'll get a fresh access token via refresh
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret,
    )
  })

  afterAll(async () => {
    // Cleanup: Delete test folder and all contents
    if (testFolderId) {
      try {
        // Note: In a real implementation, we'd need a deleteFile method
        console.log('🧹 Cleanup: Would delete test folder:', testFolderId)
      } catch (error) {
        console.error('Failed to cleanup test folder:', error)
      }
    }
  })

  describe('listDirectory', () => {
    it('should list files in root directory', async () => {
      const result = await service.listDirectory({
        folderId: 'root',
        pageSize: 10,
      })

      expect(result).toBeDefined()
      expect(result.files).toBeInstanceOf(Array)

      // Log some info about what we found
      console.log(`Found ${result.files.length} files in root`)
      if (result.files.length > 0) {
        console.log('First file:', {
          name: result.files[0].name,
          type: result.files[0].mimeType,
          path: result.files[0].path,
        })
      }
    })

    it('should respect pageSize parameter', async () => {
      const result = await service.listDirectory({
        folderId: 'root',
        pageSize: 2,
      })

      expect(result.files.length).toBeLessThanOrEqual(2)
    })

    it('should handle non-existent folder gracefully', async () => {
      await expect(
        service.listDirectory({
          folderId: 'non-existent-folder-id-123456',
        }),
      ).rejects.toThrow()
    })
  })

  describe('createFolder', () => {
    it('should create a new folder in root', { timeout: 10000 }, async () => {
      const result = await service.createFolder(testFolderName, 'root')

      expect(result).toBeDefined()
      expect(result.id).toBeTruthy()

      testFolderId = result.id
      setTestFolderId(testFolderId)

      console.log(`✅ Created test folder: ${testFolderName} (${testFolderId})`)

      // Verify the folder was created by searching for it directly
      // Using search instead of listing to avoid pagination issues
      const searchResult = await service.searchFiles({
        query: testFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        maxResults: 10,
      })

      const createdFolder = searchResult.files.find((f) => f.id === testFolderId)

      expect(createdFolder).toBeDefined()
      expect(createdFolder?.name).toBe(testFolderName)
      expect(createdFolder?.isFolder).toBe(true)
    })

    it('should create a subfolder', async () => {
      const subfolderName = 'test-subfolder'
      const result = await service.createFolder(subfolderName, testFolderId)

      expect(result).toBeDefined()
      expect(result.id).toBeTruthy()

      // Verify the subfolder exists in parent
      const listResult = await service.listDirectory({
        folderId: testFolderId,
      })

      const subfolder = listResult.files.find((f) => f.name === subfolderName)
      expect(subfolder).toBeDefined()
      expect(subfolder?.isFolder).toBe(true)
    })
  })

  describe('searchFiles', () => {
    it('should find files by name', async () => {
      const result = await service.searchFiles({
        query: testFolderName,
        maxResults: 10,
      })

      expect(result).toBeDefined()
      expect(result.files).toBeInstanceOf(Array)

      const foundFolder = result.files.find((f) => f.name === testFolderName)
      expect(foundFolder).toBeDefined()
      expect(foundFolder?.id).toBe(testFolderId)
    })

    it('should filter by mime type', { timeout: 10000 }, async () => {
      const result = await service.searchFiles({
        query: '',
        mimeType: 'application/vnd.google-apps.folder',
        maxResults: 10,
      })

      expect(result.files).toBeInstanceOf(Array)

      // All results should be folders
      for (const file of result.files) {
        expect(file.mimeType).toBe('application/vnd.google-apps.folder')
        expect(file.isFolder).toBe(true)
      }
    })

    it('should search within specific folder', async () => {
      const result = await service.searchFiles({
        query: 'subfolder',
        folderId: testFolderId,
        maxResults: 10,
      })

      // All results should have testFolderId as parent
      for (const file of result.files) {
        expect(file.parents).toContain(testFolderId)
      }
    })
  })

  describe('file operations', () => {
    let testTextFileId: string
    const testFileName = 'test-file.txt'

    // Note: We can't create files directly with the current API,
    // so these tests assume files exist or skip actual file operations

    it('should rename a folder', async () => {
      // Create a folder to rename
      const folderToRename = await service.createFolder('folder-to-rename', testFolderId)

      const newName = 'renamed-folder'
      await service.renameFolder(folderToRename.id, newName)

      // Verify rename
      const listResult = await service.listDirectory({
        folderId: testFolderId,
      })

      const renamedFolder = listResult.files.find((f) => f.id === folderToRename.id)
      expect(renamedFolder?.name).toBe(newName)
    })

    it('should move a folder', async () => {
      // Create source and destination folders
      const sourceFolder = await service.createFolder('move-source', testFolderId)
      const destFolder = await service.createFolder('move-destination', testFolderId)

      // Create a folder to move
      const folderToMove = await service.createFolder('folder-to-move', sourceFolder.id)

      // Move the folder
      await service.moveFolder(folderToMove.id, destFolder.id)

      // Verify move
      const destContents = await service.listDirectory({
        folderId: destFolder.id,
      })

      const movedFolder = destContents.files.find((f) => f.id === folderToMove.id)
      expect(movedFolder).toBeDefined()
      expect(movedFolder?.parents).toContain(destFolder.id)
    })
  })

  describe('error handling', () => {
    it('should handle invalid access token', async () => {
      const invalidService = new GoogleDriveService(
        'invalid-token-123',
        'invalid-refresh-token',
        'invalid-client-id',
        'invalid-client-secret',
      )

      await expect(invalidService.listDirectory({ folderId: 'root' })).rejects.toThrow(
        /401|Invalid Credentials|Unauthorized|Failed to refresh token/i,
      )
    })

    it('should handle API errors gracefully', async () => {
      // Try to access a file that doesn't exist
      await expect(
        service.readFile({
          fileId: 'non-existent-file-id-xyz123',
          maxSize: 1000,
        }),
      ).rejects.toThrow()
    })
  })
})
