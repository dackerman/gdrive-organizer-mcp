import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { getTestCredentials } from '../integration-setup'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Generates snapshots of real Google Drive API responses
 * These can be used to verify stub behavior matches real responses
 */
export class SnapshotGenerator {
  private client: GoogleDriveApiClient
  private snapshotDir: string

  constructor() {
    const credentials = getTestCredentials()
    this.client = new GoogleDriveApiClient(
      '',
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
    
    this.snapshotDir = join(__dirname, 'snapshots')
    if (!existsSync(this.snapshotDir)) {
      mkdirSync(this.snapshotDir, { recursive: true })
    }
  }

  /**
   * Generate snapshots for common API operations
   */
  async generateSnapshots() {
    console.log('Generating API response snapshots...')

    // Create a test folder
    const testFolder = await this.client.filesCreate({
      requestBody: {
        name: `snapshot-test-${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root']
      }
    })

    try {
      // Snapshot: Empty folder listing
      await this.saveSnapshot('empty-folder-list', {
        request: {
          method: 'filesList',
          params: { q: `'${testFolder.id}' in parents` }
        },
        response: await this.client.filesList({
          q: `'${testFolder.id}' in parents`
        })
      })

      // Create various file types
      const textFile = await this.client.filesCreate({
        requestBody: {
          name: 'sample.txt',
          mimeType: 'text/plain',
          parents: [testFolder.id]
        }
      })

      const folder = await this.client.filesCreate({
        requestBody: {
          name: 'subfolder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [testFolder.id]
        }
      })

      const googleDoc = await this.client.filesCreate({
        requestBody: {
          name: 'My Document',
          mimeType: 'application/vnd.google-apps.document',
          parents: [testFolder.id]
        }
      })

      // Snapshot: Folder with mixed content
      await this.saveSnapshot('mixed-content-list', {
        request: {
          method: 'filesList',
          params: { 
            q: `'${testFolder.id}' in parents`,
            orderBy: 'folder,name'
          }
        },
        response: await this.client.filesList({
          q: `'${testFolder.id}' in parents`,
          orderBy: 'folder,name'
        })
      })

      // Snapshot: Query with name contains
      await this.saveSnapshot('name-contains-query', {
        request: {
          method: 'filesList',
          params: { q: `name contains 'sample'` }
        },
        response: await this.client.filesList({
          q: `name contains 'sample'`
        })
      })

      // Snapshot: File metadata
      await this.saveSnapshot('file-metadata', {
        request: {
          method: 'filesGet',
          params: { 
            fileId: textFile.id,
            fields: 'id,name,mimeType,parents,createdTime,modifiedTime'
          }
        },
        response: await this.client.filesGet({
          fileId: textFile.id,
          fields: 'id,name,mimeType,parents,createdTime,modifiedTime'
        })
      })

      // Snapshot: Update file
      await this.saveSnapshot('file-update', {
        request: {
          method: 'filesUpdate',
          params: {
            fileId: textFile.id,
            requestBody: { name: 'renamed.txt' }
          }
        },
        response: await this.client.filesUpdate({
          fileId: textFile.id,
          requestBody: { name: 'renamed.txt' }
        })
      })

      // Snapshot: Move file
      await this.saveSnapshot('file-move', {
        request: {
          method: 'filesUpdate',
          params: {
            fileId: textFile.id,
            addParents: folder.id,
            removeParents: testFolder.id
          }
        },
        response: await this.client.filesUpdate({
          fileId: textFile.id,
          addParents: folder.id,
          removeParents: testFolder.id
        })
      })

      console.log('Snapshots generated successfully!')

    } finally {
      // Cleanup
      await this.client.filesDelete({ fileId: testFolder.id })
    }
  }

  private async saveSnapshot(name: string, data: any) {
    // Normalize data to remove variable values
    const normalized = this.normalizeSnapshot(data)
    
    const filename = join(this.snapshotDir, `${name}.json`)
    writeFileSync(filename, JSON.stringify(normalized, null, 2))
    console.log(`  ✓ ${name}`)
  }

  private normalizeSnapshot(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeSnapshot(item))
    }
    
    if (data && typeof data === 'object') {
      const normalized: any = {}
      
      for (const [key, value] of Object.entries(data)) {
        // Normalize variable fields
        if (key === 'id' && typeof value === 'string') {
          normalized[key] = '<FILE_ID>'
        } else if (key === 'createdTime' || key === 'modifiedTime') {
          normalized[key] = '<TIMESTAMP>'
        } else if (key === 'name' && value && (value as string).includes('snapshot-test-')) {
          normalized[key] = '<TEST_FOLDER_NAME>'
        } else {
          normalized[key] = this.normalizeSnapshot(value)
        }
      }
      
      return normalized
    }
    
    return data
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new SnapshotGenerator()
  generator.generateSnapshots().catch(console.error)
}