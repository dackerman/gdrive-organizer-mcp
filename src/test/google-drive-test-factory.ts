import { GoogleDriveApiStub } from './google-drive-api-stub'
import { GoogleDriveAdapter } from '../services/google-drive-adapter'
import { GOOGLE_DRIVE_MIME_TYPES } from '../types/google-drive-api'

/**
 * Factory for creating test instances with common test data
 */
export class GoogleDriveTestFactory {
  /**
   * Create a test instance with a common folder structure
   */
  static createWithTestData(): {
    stub: GoogleDriveApiStub
    service: GoogleDriveAdapter
  } {
    const stub = new GoogleDriveApiStub()
    const service = new GoogleDriveAdapter('test-token')
    
    // Override the private apiClient property
    ;(service as any).apiClient = stub

    // Add common test folder structure
    const documents = stub.addTestFile({
      id: 'documents-folder',
      name: 'Documents',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const projects = stub.addTestFile({
      id: 'projects-folder',
      name: 'Projects',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    const photos = stub.addTestFile({
      id: 'photos-folder',
      name: 'Photos',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: ['root'],
    })

    // Add some files in Documents
    stub.addTestFile({
      id: 'test-doc-1',
      name: 'test-file.txt',
      mimeType: 'text/plain',
      parents: [documents.id],
      size: '1024',
    })

    stub.addTestFile({
      id: 'test-doc-2',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      parents: [documents.id],
      size: '2048576',
    })

    // Add subfolder in Documents
    const workFolder = stub.addTestFile({
      id: 'work-folder',
      name: 'Work',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      parents: [documents.id],
    })

    stub.addTestFile({
      id: 'work-doc-1',
      name: 'presentation.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      parents: [workFolder.id],
      size: '5242880',
    })

    // Add some shared files
    stub.addTestFile({
      id: 'shared-doc-1',
      name: 'shared-document.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      parents: [documents.id],
      shared: true,
      ownedByMe: true, // We own this file but have shared it
      permissions: [
        {
          id: 'perm-1',
          type: 'user',
          role: 'writer',
          emailAddress: 'john@example.com',
          displayName: 'John Doe',
        }
      ],
    })

    // Add a Google Docs file
    stub.addTestFile({
      id: 'google-doc-1',
      name: 'Meeting Notes',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.DOCUMENT,
      parents: [workFolder.id],
    })

    // Add a Google Sheets file
    stub.addTestFile({
      id: 'google-sheet-1',
      name: 'Budget 2024',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET,
      parents: [documents.id],
    })

    return { stub, service }
  }

  /**
   * Create a minimal test instance
   */
  static createMinimal(): {
    stub: GoogleDriveApiStub
    service: GoogleDriveAdapter
  } {
    const stub = new GoogleDriveApiStub()
    const service = new GoogleDriveAdapter('test-token')
    
    // Override the private apiClient property
    ;(service as any).apiClient = stub

    return { stub, service }
  }

  /**
   * Create test instance with deeply nested folders
   */
  static createWithDeepStructure(): {
    stub: GoogleDriveApiStub
    service: GoogleDriveAdapter
  } {
    const stub = new GoogleDriveApiStub()
    const service = new GoogleDriveAdapter('test-token')
    
    // Override the private apiClient property
    ;(service as any).apiClient = stub

    // Create deep folder structure
    let currentParentId = 'root'
    const depth = 5
    
    for (let i = 1; i <= depth; i++) {
      const folder = stub.addTestFile({
        id: `level-${i}-folder`,
        name: `Level${i}`,
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: [currentParentId],
      })
      
      // Add some files at each level
      stub.addTestFile({
        name: `file-at-level-${i}.txt`,
        mimeType: 'text/plain',
        parents: [folder.id],
      })
      
      currentParentId = folder.id
    }

    return { stub, service }
  }

  /**
   * Create test instance with various file types
   */
  static createWithVariousFileTypes(): {
    stub: GoogleDriveApiStub
    service: GoogleDriveAdapter
  } {
    const stub = new GoogleDriveApiStub()
    const service = new GoogleDriveAdapter('test-token')
    
    // Override the private apiClient property
    ;(service as any).apiClient = stub

    const fileTypes = [
      { name: 'document.pdf', mimeType: 'application/pdf' },
      { name: 'image.jpg', mimeType: 'image/jpeg' },
      { name: 'video.mp4', mimeType: 'video/mp4' },
      { name: 'spreadsheet.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'presentation.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      { name: 'archive.zip', mimeType: 'application/zip' },
      { name: 'code.js', mimeType: 'text/javascript' },
      { name: 'data.json', mimeType: 'application/json' },
      { name: 'style.css', mimeType: 'text/css' },
      { name: 'page.html', mimeType: 'text/html' },
    ]

    fileTypes.forEach((file, index) => {
      stub.addTestFile({
        id: `file-${index}`,
        name: file.name,
        mimeType: file.mimeType,
        parents: ['root'],
        size: String(1024 * (index + 1)),
      })
    })

    return { stub, service }
  }
}