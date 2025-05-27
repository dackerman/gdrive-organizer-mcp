import { GoogleDriveService } from '../services/google-drive'

/**
 * Utility for cleaning up test data from Google Drive
 *
 * Since we don't have a delete method in GoogleDriveService yet,
 * this provides guidance on manual cleanup
 */

export interface TestResource {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId?: string
}

export class TestCleanupManager {
  private resources: TestResource[] = []

  constructor(private service: GoogleDriveService) {}

  /**
   * Track a resource for cleanup
   */
  track(resource: TestResource): void {
    this.resources.push(resource)
  }

  /**
   * Get cleanup instructions
   */
  getCleanupInstructions(): string[] {
    const instructions: string[] = [
      '🧹 Manual cleanup required:',
      '',
      'Please delete the following test resources from your Google Drive:',
      '',
    ]

    // Group by parent for easier navigation
    const byParent = new Map<string, TestResource[]>()

    for (const resource of this.resources) {
      const parentId = resource.parentId || 'root'
      if (!byParent.has(parentId)) {
        byParent.set(parentId, [])
      }
      byParent.get(parentId)!.push(resource)
    }

    // Generate instructions
    for (const [parentId, resources] of byParent) {
      if (parentId === 'root') {
        instructions.push('In My Drive root:')
      } else {
        const parent = this.resources.find((r) => r.id === parentId)
        instructions.push(`In folder "${parent?.name || parentId}":`)
      }

      for (const resource of resources) {
        instructions.push(`  - ${resource.type}: ${resource.name} (${resource.id})`)
      }
      instructions.push('')
    }

    instructions.push('Tip: Search for folders starting with "test-" to find all test data')

    return instructions
  }

  /**
   * Log cleanup instructions to console
   */
  logCleanupInstructions(): void {
    const instructions = this.getCleanupInstructions()
    console.log(instructions.join('\n'))
  }

  /**
   * Future: Actually delete resources when we have a delete method
   */
  async cleanup(): Promise<void> {
    console.warn('⚠️  Automatic cleanup not yet implemented')
    console.warn('    GoogleDriveService needs a deleteFile/deleteFolder method')
    this.logCleanupInstructions()
  }
}

/**
 * Helper to create test folder names with timestamp
 */
export function createTestFolderName(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `test-${prefix}-${timestamp}`
}

/**
 * Helper to find and list all test folders
 */
export async function findTestFolders(
  service: GoogleDriveService,
  pattern = 'test-',
): Promise<{ id: string; name: string; createdTime: string }[]> {
  const result = await service.searchFiles({
    query: pattern,
    mimeType: 'application/vnd.google-apps.folder',
    maxResults: 100,
  })

  return result.files
    .filter((f) => f.name.startsWith(pattern))
    .map((f) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
    }))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
}
