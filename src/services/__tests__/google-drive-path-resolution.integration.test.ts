import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GoogleDriveService } from '../google-drive'
import { getTestCredentials } from '../../test/integration-setup'
import { TestCleanupManager, createTestFolderName } from '../../test/test-cleanup'

describe('GoogleDriveService Path Resolution Integration Tests', () => {
  let service: GoogleDriveService
  let cleanup: TestCleanupManager
  let testRootFolderId: string
  const testRootFolderName = createTestFolderName('path-resolution')

  beforeAll(async () => {
    const credentials = getTestCredentials()
    service = new GoogleDriveService(
      '', // We'll get a fresh access token via refresh
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
    cleanup = new TestCleanupManager(service)
    
    // Create test root folder
    const result = await service.createFolder(testRootFolderName, 'root')
    testRootFolderId = result.id
    cleanup.track({ id: testRootFolderId, name: testRootFolderName, type: 'folder' })
  })

  afterAll(async () => {
    await cleanup.cleanup()
  })

  describe('resolvePathToId with special characters', () => {
    it('should resolve paths with spaces', async () => {
      const folderName = 'Random files'
      const folder = await service.createFolder(folderName, testRootFolderId)
      cleanup.track({ id: folder.id, name: folderName, type: 'folder' })
      
      // Test path resolution
      const resolvedId = await service.resolvePathToId(`/${testRootFolderName}/${folderName}`)
      expect(resolvedId).toBe(folder.id)
    })

    it('should resolve paths with apostrophes', async () => {
      const folderName = "Test's folder"
      const folder = await service.createFolder(folderName, testRootFolderId)
      cleanup.track({ id: folder.id, name: folderName, type: 'folder' })
      
      // Test path resolution
      const resolvedId = await service.resolvePathToId(`/${testRootFolderName}/${folderName}`)
      expect(resolvedId).toBe(folder.id)
    })

    it('should resolve paths with ampersands', async () => {
      const folderName = 'Test & folder'
      const folder = await service.createFolder(folderName, testRootFolderId)
      cleanup.track({ id: folder.id, name: folderName, type: 'folder' })
      
      // Test path resolution
      const resolvedId = await service.resolvePathToId(`/${testRootFolderName}/${folderName}`)
      expect(resolvedId).toBe(folder.id)
    })

    it('should resolve paths with parentheses', async () => {
      const folderName = 'Test (folder)'
      const folder = await service.createFolder(folderName, testRootFolderId)
      cleanup.track({ id: folder.id, name: folderName, type: 'folder' })
      
      // Test path resolution
      const resolvedId = await service.resolvePathToId(`/${testRootFolderName}/${folderName}`)
      expect(resolvedId).toBe(folder.id)
    })

    it('should resolve paths with hyphens', async () => {
      const folderName = 'Test - folder'
      const folder = await service.createFolder(folderName, testRootFolderId)
      cleanup.track({ id: folder.id, name: folderName, type: 'folder' })
      
      // Test path resolution
      const resolvedId = await service.resolvePathToId(`/${testRootFolderName}/${folderName}`)
      expect(resolvedId).toBe(folder.id)
    })
  })

  describe('moveFolder with special characters', () => {
    it('should move folders with special characters in names', async () => {
      // Create source folders
      const sourceFolder = await service.createFolder('Random files', testRootFolderId)
      cleanup.track({ id: sourceFolder.id, name: 'Random files', type: 'folder' })
      
      const destParent = await service.createFolder('Housing Central', testRootFolderId)
      cleanup.track({ id: destParent.id, name: 'Housing Central', type: 'folder' })
      
      // Move the folder
      await service.moveFolder(sourceFolder.id, destParent.id)
      
      // Verify it moved
      const destContents = await service.listDirectory({ folderId: destParent.id })
      const movedFolder = destContents.files.find(f => f.id === sourceFolder.id)
      expect(movedFolder).toBeDefined()
      expect(movedFolder?.name).toBe('Random files')
      
      // Verify it's not in the original location
      const sourceContents = await service.listDirectory({ folderId: testRootFolderId })
      const notInSource = sourceContents.files.find(f => f.id === sourceFolder.id)
      expect(notInSource).toBeUndefined()
    })
  })
})