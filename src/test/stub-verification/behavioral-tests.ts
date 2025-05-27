import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

/**
 * Behavioral tests that define expected behavior for both real and stub APIs
 * These tests focus on behavior rather than exact response matching
 */
export const behavioralTests = {
  /**
   * Test: Creating a folder should make it findable by listing
   */
  async folderCreationAndListing(client: GoogleDriveApiClient, parentId: string) {
    const folderName = `test-folder-${Date.now()}`
    
    // Create folder
    const created = await client.filesCreate({
      requestBody: {
        name: folderName,
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: [parentId]
      }
    })

    // Should be able to find it
    const listResponse = await client.filesList({
      q: `'${parentId}' in parents and name = '${folderName}'`
    })

    return {
      created: created.id,
      found: listResponse.files.length === 1,
      foundId: listResponse.files[0]?.id
    }
  },

  /**
   * Test: Moving a file should update its parent
   */
  async fileMove(client: GoogleDriveApiClient, parentId: string) {
    // Create source and destination folders
    const sourceFolder = await client.filesCreate({
      requestBody: {
        name: 'source-folder',
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: [parentId]
      }
    })

    const destFolder = await client.filesCreate({
      requestBody: {
        name: 'dest-folder',
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: [parentId]
      }
    })

    // Create file in source
    const file = await client.filesCreate({
      requestBody: {
        name: 'movable-file.txt',
        mimeType: 'text/plain',
        parents: [sourceFolder.id]
      }
    })

    // Move file
    await client.filesUpdate({
      fileId: file.id,
      addParents: destFolder.id,
      removeParents: sourceFolder.id
    })

    // Check file is in destination
    const destFiles = await client.filesList({
      q: `'${destFolder.id}' in parents`
    })

    // Check file is NOT in source
    const sourceFiles = await client.filesList({
      q: `'${sourceFolder.id}' in parents`
    })

    return {
      inDestination: destFiles.files.some(f => f.id === file.id),
      notInSource: !sourceFiles.files.some(f => f.id === file.id),
      fileParents: (await client.filesGet({ 
        fileId: file.id, 
        fields: 'parents' 
      })).parents
    }
  },

  /**
   * Test: Query operators should filter correctly
   */
  async queryOperators(client: GoogleDriveApiClient, parentId: string) {
    // Create test files
    await client.filesCreate({
      requestBody: {
        name: 'alpha.txt',
        mimeType: 'text/plain',
        parents: [parentId]
      }
    })

    await client.filesCreate({
      requestBody: {
        name: 'beta.doc',
        mimeType: 'application/msword',
        parents: [parentId]
      }
    })

    await client.filesCreate({
      requestBody: {
        name: 'alphabet.txt',
        mimeType: 'text/plain',
        parents: [parentId]
      }
    })

    // Test different queries
    const containsAlpha = await client.filesList({
      q: `'${parentId}' in parents and name contains 'alpha'`
    })

    const exactName = await client.filesList({
      q: `'${parentId}' in parents and name = 'beta.doc'`
    })

    const mimeType = await client.filesList({
      q: `'${parentId}' in parents and mimeType = 'text/plain'`
    })

    return {
      containsAlpha: containsAlpha.files.map(f => f.name).sort(),
      exactName: exactName.files.map(f => f.name),
      textFiles: mimeType.files.map(f => f.name).sort()
    }
  },

  /**
   * Test: Trashed files should not appear in normal listings
   */
  async trashedBehavior(client: GoogleDriveApiClient, parentId: string) {
    // Create a file
    const file = await client.filesCreate({
      requestBody: {
        name: 'trash-test.txt',
        mimeType: 'text/plain',
        parents: [parentId]
      }
    })

    // List files (should include it)
    const beforeTrash = await client.filesList({
      q: `'${parentId}' in parents and trashed = false`
    })

    // Trash the file
    await client.filesUpdate({
      fileId: file.id,
      requestBody: { trashed: true }
    })

    // List files (should NOT include it)
    const afterTrash = await client.filesList({
      q: `'${parentId}' in parents and trashed = false`
    })

    // List trashed files (should include it)
    const trashedFiles = await client.filesList({
      q: `'${parentId}' in parents and trashed = true`
    })

    return {
      beforeCount: beforeTrash.files.length,
      afterCount: afterTrash.files.length,
      trashedCount: trashedFiles.files.length,
      fileWasTrashed: trashedFiles.files.some(f => f.id === file.id)
    }
  }
}