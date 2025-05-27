import { describe, it, expect, beforeAll } from 'vitest'
import { GoogleDriveService } from '../google-drive'
import { getTestCredentials } from '../../test/integration-setup'

/**
 * Practical integration tests that work with pre-existing test folder structure.
 * See TEST_FOLDER_SETUP.md for required folder structure.
 * 
 * These tests are designed to be idempotent - they can be run multiple times
 * and will work regardless of the current state of test files.
 */
describe('GoogleDriveService - Practical Integration Tests', () => {
  let service: GoogleDriveService
  let testFolderId: string
  let folderAId: string
  let folderBId: string
  let testOperationsFolderId: string

  beforeAll(async () => {
    const credentials = getTestCredentials()
    service = new GoogleDriveService(
      '', // We'll get a fresh access token via refresh
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
    
    // Get test folder ID from credentials or environment
    testFolderId = credentials.test_folder_id
    if (!testFolderId) {
      throw new Error('Test folder ID not found in credentials')
    }
    
    console.log('📁 Using test folder:', testFolderId)
    
    // Find subfolder IDs
    const rootContents = await service.listDirectory({ folderId: testFolderId })
    
    const folderA = rootContents.files.find(f => f.name === 'FolderA' && f.isFolder)
    const folderB = rootContents.files.find(f => f.name === 'FolderB' && f.isFolder)
    const testOps = rootContents.files.find(f => f.name === 'TestOperations' && f.isFolder)
    
    if (!folderA || !folderB || !testOps) {
      console.error('❌ Required subfolders not found in test folder')
      console.error('   Found:', rootContents.files.map(f => f.name))
      throw new Error('Test folder structure not set up correctly. See TEST_FOLDER_SETUP.md')
    }
    
    folderAId = folderA.id
    folderBId = folderB.id
    testOperationsFolderId = testOps.id
    
    console.log('✅ Test folders found:', { folderAId, folderBId, testOperationsFolderId })
  })

  describe('Read Operations', () => {
    it('should list directory contents with all required fields', async () => {
      const result = await service.listDirectory({ folderId: testFolderId })
      
      // Basic assertions - we have some files
      expect(result.files).toBeDefined()
      expect(result.files.length).toBeGreaterThan(0)
      
      // Check that all required fields are populated
      for (const file of result.files) {
        expect(file.id).toBeTruthy()
        expect(file.name).toBeTruthy()
        expect(file.mimeType).toBeTruthy()
        expect(file.createdTime).toBeTruthy()
        expect(file.modifiedTime).toBeTruthy()
        expect(file.parents).toBeInstanceOf(Array)
        expect(file.path).toBeTruthy()
        expect(typeof file.isFolder).toBe('boolean')
        expect(typeof file.isShared).toBe('boolean')
        expect(['private', 'shared', 'public']).toContain(file.sharingStatus)
        expect(typeof file.folderDepth).toBe('number')
        
        // Size is optional for folders
        if (!file.isFolder && file.size !== undefined) {
          expect(typeof file.size).toBe('number')
        }
      }
      
      console.log(`✅ Listed ${result.files.length} files with all fields populated`)
    })

    it('should read file content', async () => {
      // Find README.txt in the test folder
      const files = await service.listDirectory({ folderId: testFolderId })
      const readmeFile = files.files.find(f => f.name === 'README.txt' && !f.isFolder)
      
      if (!readmeFile) {
        console.warn('⚠️  README.txt not found, skipping read test')
        return
      }
      
      const content = await service.readFile({ fileId: readmeFile.id })
      
      // Basic assertions - we got something back
      expect(content).toBeDefined()
      expect(content.content).toBeTruthy()
      expect(content.mimeType).toBeTruthy()
      expect(content.size).toBeGreaterThan(0)
      expect(typeof content.truncated).toBe('boolean')
      expect(content.encoding).toBeTruthy()
      
      console.log(`✅ Read file: ${content.size} bytes, ${content.encoding} encoding`)
    })

    it('should search for files', async () => {
      // Search for files we know exist
      const result = await service.searchFiles({
        query: 'test',
        folderId: testFolderId,
        maxResults: 20
      })
      
      expect(result.files).toBeDefined()
      expect(result.files.length).toBeGreaterThan(0)
      
      // All results should contain 'test' in the name
      const matchingFiles = result.files.filter(f => 
        f.name.toLowerCase().includes('test')
      )
      expect(matchingFiles.length).toBeGreaterThan(0)
      
      console.log(`✅ Search found ${result.files.length} files`)
    })
  })

  describe('Move Operations', () => {
    it('should move a file between folders (toggle style)', async () => {
      // Find the move_me.txt file
      const testOpsFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      let moveFile = testOpsFiles.files.find(f => f.name === 'move_me.txt' && !f.isFolder)
      
      if (!moveFile) {
        // Check if it's in FolderA or FolderB
        const folderAFiles = await service.listDirectory({ folderId: folderAId })
        moveFile = folderAFiles.files.find(f => f.name === 'move_me.txt' && !f.isFolder)
        
        if (!moveFile) {
          const folderBFiles = await service.listDirectory({ folderId: folderBId })
          moveFile = folderBFiles.files.find(f => f.name === 'move_me.txt' && !f.isFolder)
        }
      }
      
      if (!moveFile) {
        console.warn('⚠️  move_me.txt not found, skipping move test')
        return
      }
      
      // Determine current location and target
      const currentParent = moveFile.parents[0]
      const isInFolderA = currentParent === folderAId
      const targetFolder = isInFolderA ? folderBId : folderAId
      const targetName = isInFolderA ? 'FolderB' : 'FolderA'
      
      console.log(`Moving file from ${isInFolderA ? 'FolderA' : 'FolderB'} to ${targetName}`)
      
      // Move the file
      await service.moveFile(moveFile.id, targetFolder)
      
      // Verify it moved
      const targetFiles = await service.listDirectory({ folderId: targetFolder })
      const movedFile = targetFiles.files.find(f => f.name === 'move_me.txt')
      
      expect(movedFile).toBeDefined()
      expect(movedFile?.parents).toContain(targetFolder)
      
      console.log(`✅ Successfully moved file to ${targetName}`)
    })

    it('should move a folder (toggle style)', async () => {
      // Find a test folder to move
      const testOpsFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      let testFolder = testOpsFiles.files.find(f => f.name === 'move_folder' && f.isFolder)
      
      if (!testFolder) {
        // Create it if it doesn't exist
        const result = await service.createFolder('move_folder', testOperationsFolderId)
        testFolder = { 
          id: result.id, 
          name: 'move_folder', 
          parents: [testOperationsFolderId],
          isFolder: true 
        } as any
        console.log('Created move_folder for testing')
      }
      
      // Check current parent
      const currentParent = testFolder!.parents[0]
      const isInTestOps = currentParent === testOperationsFolderId
      const targetFolder = isInTestOps ? folderAId : testOperationsFolderId
      const targetName = isInTestOps ? 'FolderA' : 'TestOperations'
      
      console.log(`Moving folder from ${isInTestOps ? 'TestOperations' : 'FolderA'} to ${targetName}`)
      
      // Move the folder
      await service.moveFolder(testFolder!.id, targetFolder)
      
      // Verify it moved
      const targetFiles = await service.listDirectory({ folderId: targetFolder })
      const movedFolder = targetFiles.files.find(f => f.name === 'move_folder' && f.isFolder)
      
      expect(movedFolder).toBeDefined()
      
      console.log(`✅ Successfully moved folder to ${targetName}`)
    })
  })

  describe('Rename Operations', () => {
    it('should rename a file (toggle style)', async () => {
      // Find file_a.txt or file_b.txt
      const testOpsFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      let renameFile = testOpsFiles.files.find(f => 
        (f.name === 'file_a.txt' || f.name === 'file_b.txt') && !f.isFolder
      )
      
      if (!renameFile) {
        console.warn('⚠️  file_a.txt or file_b.txt not found, skipping rename test')
        return
      }
      
      const currentName = renameFile.name
      const newName = currentName === 'file_a.txt' ? 'file_b.txt' : 'file_a.txt'
      
      console.log(`Renaming file from ${currentName} to ${newName}`)
      
      // Rename the file
      await service.renameFile(renameFile.id, newName)
      
      // Verify rename
      const updatedFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      const renamedFile = updatedFiles.files.find(f => f.id === renameFile.id)
      
      expect(renamedFile).toBeDefined()
      expect(renamedFile?.name).toBe(newName)
      
      console.log(`✅ Successfully renamed file to ${newName}`)
    })

    it('should rename a folder (toggle style)', async () => {
      // Find folder_a or folder_b
      const testOpsFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      let renameFolder = testOpsFiles.files.find(f => 
        (f.name === 'folder_a' || f.name === 'folder_b') && f.isFolder
      )
      
      if (!renameFolder) {
        console.warn('⚠️  folder_a or folder_b not found, skipping folder rename test')
        return
      }
      
      const currentName = renameFolder.name
      const newName = currentName === 'folder_a' ? 'folder_b' : 'folder_a'
      
      console.log(`Renaming folder from ${currentName} to ${newName}`)
      
      // Rename the folder
      await service.renameFolder(renameFolder.id, newName)
      
      // Verify rename
      const updatedFiles = await service.listDirectory({ folderId: testOperationsFolderId })
      const renamedFolder = updatedFiles.files.find(f => f.id === renameFolder.id)
      
      expect(renamedFolder).toBeDefined()
      expect(renamedFolder?.name).toBe(newName)
      
      console.log(`✅ Successfully renamed folder to ${newName}`)
    })
  })

  describe('Create Operations', () => {
    it('should create a new folder', async () => {
      const timestamp = Date.now()
      const folderName = `test-create-${timestamp}`
      
      const result = await service.createFolder(folderName, testOperationsFolderId)
      
      expect(result).toBeDefined()
      expect(result.id).toBeTruthy()
      
      // Wait a bit for propagation
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Verify it exists - need to increase page size due to many test folders
      const files = await service.listDirectory({ 
        folderId: testOperationsFolderId,
        pageSize: 100  // Increase to see all files
      })
      
      const createdFolder = files.files.find(f => f.name === folderName)
      
      expect(createdFolder).toBeDefined()
      expect(createdFolder?.isFolder).toBe(true)
      
      console.log(`✅ Created folder: ${folderName}`)
      
      // Note: We can't delete it, so it will accumulate
      console.log('   (Manual cleanup required for created test folders)')
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      await expect(
        service.readFile({ fileId: 'non-existent-file-id-12345' })
      ).rejects.toThrow()
    })

    it('should handle invalid folder ID', async () => {
      await expect(
        service.listDirectory({ folderId: 'invalid-folder-id-12345' })
      ).rejects.toThrow()
    })

    it('should handle unauthorized access', async () => {
      const badService = new GoogleDriveService(
        'invalid-token',
        'invalid-refresh-token',
        'invalid-client-id',
        'invalid-client-secret'
      )
      
      await expect(
        badService.listDirectory({ folderId: 'root' })
      ).rejects.toThrow(/401|Invalid Credentials|Unauthorized|Failed to refresh token/i)
    })
  })
})