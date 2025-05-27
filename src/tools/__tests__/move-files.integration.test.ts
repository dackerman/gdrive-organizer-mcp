import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GoogleDriveService } from '../../services/google-drive'
import { getTestCredentials } from '../../test/integration-setup'
import { TestCleanupManager, createTestFolderName } from '../../test/test-cleanup'
import { createMoveFilesTool } from '../move-files'

describe('moveFiles tool - Integration Tests', () => {
  let service: GoogleDriveService
  let cleanup: TestCleanupManager
  let testRootFolderId: string
  let tool: ReturnType<typeof createMoveFilesTool>
  const testRootFolderName = createTestFolderName('move-files-tool')

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
    
    // Create the move_files tool with the real service
    tool = createMoveFilesTool(service)
  })

  afterAll(async () => {
    await cleanup.cleanup()
  })

  describe('folder operations', () => {
    it('should move folders with spaces in names', async () => {
      // Create test folders
      const sourceFolder = await service.createFolder('Random files', testRootFolderId)
      cleanup.track({ id: sourceFolder.id, name: 'Random files', type: 'folder' })
      
      const destParent = await service.createFolder('Housing Central', testRootFolderId)
      cleanup.track({ id: destParent.id, name: 'Housing Central', type: 'folder' })
      
      // Move using the tool
      const result = await tool.handler({
        operations: [{
          from: `/${testRootFolderName}/Random files`,
          to: `/${testRootFolderName}/Housing Central/Random files`
        }]
      })
      
      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(true)
      expect(content.summary.successfulOperations).toBe(1)
      expect(content.summary.failedOperations).toBe(0)
      
      // Verify the folder moved
      const destContents = await service.listDirectory({ folderId: destParent.id })
      const movedFolder = destContents.files.find(f => f.name === 'Random files')
      expect(movedFolder).toBeDefined()
    })

    it('should handle the exact bug report scenario', async () => {
      // Recreate the exact scenario from the bug report
      // Create "Random files" in root
      const randomFilesFolder = await service.createFolder('Random files', 'root')
      cleanup.track({ id: randomFilesFolder.id, name: 'Random files', type: 'folder' })
      
      // Create "Housing Central" in root
      const housingCentralFolder = await service.createFolder('Housing Central', 'root')
      cleanup.track({ id: housingCentralFolder.id, name: 'Housing Central', type: 'folder' })
      
      // Try to move "Random files" into "Housing Central"
      const result = await tool.handler({
        operations: [{
          from: '/Random files',
          to: '/Housing Central/Random files'
        }]
      })
      
      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(true)
      expect(content.summary.successfulOperations).toBe(1)
      expect(content.results[0].success).toBe(true)
      expect(content.results[0].error).toBeUndefined()
      
      // Verify the folder moved
      const destContents = await service.listDirectory({ folderId: housingCentralFolder.id })
      const movedFolder = destContents.files.find(f => f.name === 'Random files')
      expect(movedFolder).toBeDefined()
      expect(movedFolder?.id).toBe(randomFilesFolder.id)
    })

    it('should move multiple folders in one operation', async () => {
      // Create source folders
      const folder1 = await service.createFolder('Folder 1', testRootFolderId)
      cleanup.track({ id: folder1.id, name: 'Folder 1', type: 'folder' })
      
      const folder2 = await service.createFolder('Folder 2', testRootFolderId)
      cleanup.track({ id: folder2.id, name: 'Folder 2', type: 'folder' })
      
      const destParent = await service.createFolder('Archive', testRootFolderId)
      cleanup.track({ id: destParent.id, name: 'Archive', type: 'folder' })
      
      // Move both folders
      const result = await tool.handler({
        operations: [
          {
            from: `/${testRootFolderName}/Folder 1`,
            to: `/${testRootFolderName}/Archive/Folder 1`
          },
          {
            from: `/${testRootFolderName}/Folder 2`,
            to: `/${testRootFolderName}/Archive/Folder 2`
          }
        ]
      })
      
      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(true)
      expect(content.summary.successfulOperations).toBe(2)
      expect(content.summary.failedOperations).toBe(0)
    })

    it('should rename folders', async () => {
      const folder = await service.createFolder('Old Name', testRootFolderId)
      cleanup.track({ id: folder.id, name: 'Old Name', type: 'folder' })
      
      const result = await tool.handler({
        operations: [{
          from: `/${testRootFolderName}/Old Name`,
          to: `/${testRootFolderName}/New Name`
        }]
      })
      
      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(true)
      
      // Verify the rename
      const contents = await service.listDirectory({ folderId: testRootFolderId })
      const renamedFolder = contents.files.find(f => f.id === folder.id)
      expect(renamedFolder?.name).toBe('New Name')
    })

    it('should provide helpful error when destination folder does not exist', async () => {
      const folder = await service.createFolder('Test Folder', testRootFolderId)
      cleanup.track({ id: folder.id, name: 'Test Folder', type: 'folder' })
      
      const result = await tool.handler({
        operations: [{
          from: `/${testRootFolderName}/Test Folder`,
          to: `/${testRootFolderName}/NonExistent/Test Folder`
        }]
      })
      
      const content = JSON.parse(result.content[0].text)
      
      expect(content.success).toBe(false)
      expect(content.results[0].error).toContain('Destination folder not found')
    })
  })
})