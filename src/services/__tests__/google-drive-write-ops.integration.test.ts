import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { GoogleDriveService } from '../google-drive'
import { getTestCredentials } from '../../test/integration-setup'

/**
 * Integration tests for Google Drive write operations (create, move, rename)
 * These tests create real folders/files in a test Google Drive account
 */
describe('GoogleDriveService Write Operations', () => {
  let service: GoogleDriveService
  let testRootFolderId: string
  const timestamp = Date.now()
  const testRootFolderName = `test-bulk-ops-${timestamp}`
  
  // Track all created resources for cleanup
  const createdResources: Array<{ id: string, name: string, type: 'file' | 'folder' }> = []

  beforeAll(async () => {
    const credentials = getTestCredentials()
    service = new GoogleDriveService(
      '', // We'll get a fresh access token via refresh
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
    
    // Create a root test folder for all our operations
    const rootFolder = await service.createFolder(testRootFolderName, 'root')
    testRootFolderId = rootFolder.id
    createdResources.push({ id: testRootFolderId, name: testRootFolderName, type: 'folder' })
    
    console.log(`✅ Test root folder created: ${testRootFolderId}`)
  })

  afterAll(async () => {
    // Cleanup all created resources
    console.log(`🧹 Cleaning up ${createdResources.length} test resources...`)
    
    // Note: We'd need a delete method in the service
    // For now, just log what we would delete
    for (const resource of createdResources) {
      console.log(`  Would delete ${resource.type}: ${resource.name} (${resource.id})`)
    }
    
    console.log('⚠️  Manual cleanup required: Please delete the test folders from your Google Drive')
    console.log(`   Look for folders starting with: test-bulk-ops-${timestamp}`)
  })

  describe('createFolder', () => {
    it('should create folders with correct parent', async () => {
      const folderName = 'create-test-folder'
      const result = await service.createFolder(folderName, testRootFolderId)
      
      expect(result.id).toBeTruthy()
      createdResources.push({ id: result.id, name: folderName, type: 'folder' })
      
      // Verify it exists in the parent
      const listResult = await service.listDirectory({ folderId: testRootFolderId })
      const created = listResult.files.find(f => f.id === result.id)
      
      expect(created).toBeDefined()
      expect(created?.name).toBe(folderName)
      expect(created?.parents).toContain(testRootFolderId)
      expect(created?.isFolder).toBe(true)
    })

    it('should create nested folder structure', async () => {
      const level1 = await service.createFolder('level1', testRootFolderId)
      createdResources.push({ id: level1.id, name: 'level1', type: 'folder' })
      
      const level2 = await service.createFolder('level2', level1.id)
      createdResources.push({ id: level2.id, name: 'level2', type: 'folder' })
      
      const level3 = await service.createFolder('level3', level2.id)
      createdResources.push({ id: level3.id, name: 'level3', type: 'folder' })
      
      // Verify nested structure
      const l2Contents = await service.listDirectory({ folderId: level2.id })
      const l3Folder = l2Contents.files.find(f => f.id === level3.id)
      
      expect(l3Folder).toBeDefined()
      expect(l3Folder?.parents).toContain(level2.id)
    })
  })

  describe('renameFolder', () => {
    it('should rename a folder', async () => {
      // Create a folder to rename
      const originalName = 'folder-before-rename'
      const newName = 'folder-after-rename'
      
      const folder = await service.createFolder(originalName, testRootFolderId)
      createdResources.push({ id: folder.id, name: newName, type: 'folder' })
      
      // Rename it
      await service.renameFolder(folder.id, newName)
      
      // Verify the rename
      const listResult = await service.listDirectory({ folderId: testRootFolderId })
      const renamed = listResult.files.find(f => f.id === folder.id)
      
      expect(renamed).toBeDefined()
      expect(renamed?.name).toBe(newName)
      expect(renamed?.id).toBe(folder.id) // ID should not change
    })

    it('should handle special characters in folder names', async () => {
      // Test a few key special character scenarios instead of all
      const specialNames = [
        'folder with spaces',
        'folder-with-dashes',
        'folder (with) parentheses'
      ]
      
      // Create all folders first
      const folders = await Promise.all(
        specialNames.map(async (_, index) => 
          service.createFolder(`temp-folder-${index}`, testRootFolderId)
        )
      )
      
      // Track created resources
      folders.forEach((folder, index) => {
        createdResources.push({ id: folder.id, name: specialNames[index], type: 'folder' })
      })
      
      // Rename all folders in parallel
      await Promise.all(
        folders.map((folder, index) => 
          service.renameFolder(folder.id, specialNames[index])
        )
      )
      
      // Verify all at once
      const listResult = await service.listDirectory({ folderId: testRootFolderId })
      
      folders.forEach((folder, index) => {
        const renamed = listResult.files.find(f => f.id === folder.id)
        expect(renamed?.name).toBe(specialNames[index])
      })
    }, 15000) // Increase timeout to 15s
  })

  describe('moveFolder', () => {
    it('should move a folder to a different parent', async () => {
      // Create source and destination folders
      const sourceFolder = await service.createFolder('move-source', testRootFolderId)
      const destFolder = await service.createFolder('move-destination', testRootFolderId)
      createdResources.push(
        { id: sourceFolder.id, name: 'move-source', type: 'folder' },
        { id: destFolder.id, name: 'move-destination', type: 'folder' }
      )
      
      // Create a folder to move
      const folderToMove = await service.createFolder('folder-to-move', sourceFolder.id)
      createdResources.push({ id: folderToMove.id, name: 'folder-to-move', type: 'folder' })
      
      // Verify it's in the source
      const beforeMove = await service.listDirectory({ folderId: sourceFolder.id })
      expect(beforeMove.files.some(f => f.id === folderToMove.id)).toBe(true)
      
      // Move it
      await service.moveFolder(folderToMove.id, destFolder.id)
      
      // Verify it's no longer in source
      const sourceAfterMove = await service.listDirectory({ folderId: sourceFolder.id })
      expect(sourceAfterMove.files.some(f => f.id === folderToMove.id)).toBe(false)
      
      // Verify it's in destination
      const destAfterMove = await service.listDirectory({ folderId: destFolder.id })
      const movedFolder = destAfterMove.files.find(f => f.id === folderToMove.id)
      expect(movedFolder).toBeDefined()
      expect(movedFolder?.parents).toContain(destFolder.id)
    })

    it('should move folder with contents', async () => {
      // Create a folder with subfolders
      const parentFolder = await service.createFolder('parent-with-contents', testRootFolderId)
      const childFolder1 = await service.createFolder('child1', parentFolder.id)
      const childFolder2 = await service.createFolder('child2', parentFolder.id)
      const grandchildFolder = await service.createFolder('grandchild', childFolder1.id)
      
      createdResources.push(
        { id: parentFolder.id, name: 'parent-with-contents', type: 'folder' },
        { id: childFolder1.id, name: 'child1', type: 'folder' },
        { id: childFolder2.id, name: 'child2', type: 'folder' },
        { id: grandchildFolder.id, name: 'grandchild', type: 'folder' }
      )
      
      // Create destination
      const destination = await service.createFolder('new-parent', testRootFolderId)
      createdResources.push({ id: destination.id, name: 'new-parent', type: 'folder' })
      
      // Move the parent folder
      await service.moveFolder(parentFolder.id, destination.id)
      
      // Verify the entire structure moved
      const movedContents = await service.listDirectory({ folderId: parentFolder.id })
      expect(movedContents.files.length).toBe(2) // child1 and child2
      
      const movedChild1Contents = await service.listDirectory({ folderId: childFolder1.id })
      expect(movedChild1Contents.files.some(f => f.id === grandchildFolder.id)).toBe(true)
    }, 10000)
  })

  describe('bulk operations scenario', () => {
    it('should handle a realistic bulk move scenario', async () => {
      // Create base folders in parallel
      const [docsFolder, projectsFolder, miscFolder] = await Promise.all([
        service.createFolder('Documents', testRootFolderId),
        service.createFolder('Projects', testRootFolderId),
        service.createFolder('Miscellaneous', testRootFolderId)
      ])
      
      createdResources.push(
        { id: docsFolder.id, name: 'Documents', type: 'folder' },
        { id: projectsFolder.id, name: 'Projects', type: 'folder' },
        { id: miscFolder.id, name: 'Miscellaneous', type: 'folder' }
      )
      
      // Create project folders in parallel
      const [project1, project2] = await Promise.all([
        service.createFolder('Project-Alpha', miscFolder.id),
        service.createFolder('Project-Beta', docsFolder.id)
      ])
      
      createdResources.push(
        { id: project1.id, name: 'Project-Alpha', type: 'folder' },
        { id: project2.id, name: 'Project-Beta', type: 'folder' }
      )
      
      // Move both projects to Projects folder in parallel
      await Promise.all([
        service.moveFolder(project1.id, projectsFolder.id),
        service.moveFolder(project2.id, projectsFolder.id)
      ])
      
      // Rename both in parallel
      await Promise.all([
        service.renameFolder(project1.id, '2024-Project-Alpha'),
        service.renameFolder(project2.id, '2024-Project-Beta')
      ])
      
      // Verify final structure
      const projectsContents = await service.listDirectory({ folderId: projectsFolder.id })
      expect(projectsContents.files.length).toBe(2)
      
      const projectNames = projectsContents.files.map(f => f.name).sort()
      expect(projectNames).toEqual([
        '2024-Project-Alpha',
        '2024-Project-Beta'
      ])
      
      // Verify old locations are empty
      const miscContents = await service.listDirectory({ folderId: miscFolder.id })
      expect(miscContents.files.length).toBe(0)
    }, 15000) // Increase timeout to 15s
  })

  describe('error handling', () => {
    it('should fail when moving to non-existent parent', async () => {
      const folder = await service.createFolder('orphan-folder', testRootFolderId)
      createdResources.push({ id: folder.id, name: 'orphan-folder', type: 'folder' })
      
      await expect(
        service.moveFolder(folder.id, 'non-existent-parent-id')
      ).rejects.toThrow()
    })

    it('should fail when renaming non-existent folder', async () => {
      await expect(
        service.renameFolder('non-existent-folder-id', 'new-name')
      ).rejects.toThrow()
    })

    it('should fail when creating folder with invalid parent', async () => {
      await expect(
        service.createFolder('orphan', 'invalid-parent-id')
      ).rejects.toThrow()
    })
  })
})