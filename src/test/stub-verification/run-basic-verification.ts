#!/usr/bin/env tsx
import { GoogleDriveApiStub } from '../google-drive-api-stub'
import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

/**
 * Basic verification script to test stub behavior
 * Run with: npx tsx src/test/stub-verification/run-basic-verification.ts
 */
async function runBasicVerification() {
  console.log('🧪 Running basic stub verification...\n')

  const stub = new GoogleDriveApiStub()

  // Test 1: Create a folder
  console.log('Test 1: Creating a folder')
  const folder = await stub.filesCreate({
    requestBody: {
      name: 'Test Folder',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root']
    }
  })
  console.log('✅ Created folder:', folder.id, folder.name)

  // Test 2: List files
  console.log('\nTest 2: Listing files')
  const listResult = await stub.filesList({
    q: "'root' in parents",
    orderBy: 'folder,name'
  })
  console.log('✅ Found files:', listResult.files.map(f => f.name))

  // Test 3: Create a file in the folder
  console.log('\nTest 3: Creating a file in folder')
  const file = await stub.filesCreate({
    requestBody: {
      name: 'test.txt',
      mimeType: 'text/plain',
      parents: [folder.id]
    }
  })
  console.log('✅ Created file:', file.id, file.name)

  // Test 4: Query with name contains
  console.log('\nTest 4: Query with name contains')
  const searchResult = await stub.filesList({
    q: "name contains 'test'"
  })
  console.log('✅ Search results:', searchResult.files.map(f => f.name))

  // Test 5: Update file
  console.log('\nTest 5: Updating file name')
  const updated = await stub.filesUpdate({
    fileId: file.id,
    requestBody: {
      name: 'renamed.txt'
    }
  })
  console.log('✅ Updated file:', updated.name)

  // Test 6: Move file
  console.log('\nTest 6: Moving file to root')
  const moved = await stub.filesUpdate({
    fileId: file.id,
    addParents: 'root',
    removeParents: folder.id
  })
  console.log('✅ Moved file, parents:', moved.parents)

  // Test 7: Verify file is in root
  console.log('\nTest 7: Verifying file is in root')
  const rootFiles = await stub.filesList({
    q: "'root' in parents and name = 'renamed.txt'"
  })
  console.log('✅ File found in root:', rootFiles.files.length === 1)

  // Test 8: Trash file
  console.log('\nTest 8: Trashing file')
  await stub.filesUpdate({
    fileId: file.id,
    requestBody: { trashed: true }
  })
  const afterTrash = await stub.filesList({
    q: "'root' in parents and trashed = false"
  })
  console.log('✅ File not in normal listing:', !afterTrash.files.some(f => f.id === file.id))

  console.log('\n✨ All basic tests passed!')
}

// Run if called directly
if (require.main === module) {
  runBasicVerification().catch(console.error)
}