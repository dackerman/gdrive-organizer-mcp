import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { GoogleDriveApiStub } from '../google-drive-api-stub'
import { getTestCredentials } from '../integration-setup'

/**
 * Test harness that runs the same operations against both real and stub APIs
 */
export class ApiComparisonTestHarness {
  private realClient: GoogleDriveApiClient
  private stubClient: GoogleDriveApiStub
  private testFolderId!: string

  constructor() {
    // Initialize stub
    this.stubClient = new GoogleDriveApiStub()
    
    // Initialize real client
    const credentials = getTestCredentials()
    this.realClient = new GoogleDriveApiClient(
      '', // Will be refreshed
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
  }

  /**
   * Initialize both APIs to the same state
   */
  async initialize() {
    // Create a test folder in real API
    const testFolder = await this.realClient.filesCreate({
      requestBody: {
        name: `stub-verification-${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root']
      }
    })
    this.testFolderId = testFolder.id

    // Mirror the test folder in stub
    this.stubClient.addTestFile({
      id: this.testFolderId,
      name: testFolder.name,
      mimeType: testFolder.mimeType,
      parents: testFolder.parents || ['root']
    })

    // List all files in the test folder (should be empty)
    const realFiles = await this.realClient.filesList({
      q: `'${this.testFolderId}' in parents`,
      fields: 'files(id,name,mimeType,parents)'
    })

    // Sync any existing files to stub
    for (const file of realFiles.files) {
      this.stubClient.addTestFile(file)
    }
  }

  /**
   * Run an operation against both APIs and compare results
   */
  async runComparison<T>(
    operation: (client: GoogleDriveApiClient) => Promise<T>,
    options: {
      normalize?: (result: T) => any
      expectExactMatch?: boolean
    } = {}
  ): Promise<{
    real: T
    stub: T
    matches: boolean
    differences?: any
  }> {
    const [realResult, stubResult] = await Promise.all([
      operation(this.realClient),
      operation(this.stubClient)
    ])

    const normalize = options.normalize || ((x) => x)
    const normalizedReal = normalize(realResult)
    const normalizedStub = normalize(stubResult)

    const matches = options.expectExactMatch
      ? JSON.stringify(normalizedReal) === JSON.stringify(normalizedStub)
      : this.behaviorallyEquivalent(normalizedReal, normalizedStub)

    return {
      real: realResult,
      stub: stubResult,
      matches,
      differences: matches ? undefined : {
        real: normalizedReal,
        stub: normalizedStub
      }
    }
  }

  /**
   * Check if results are behaviorally equivalent (not necessarily identical)
   */
  private behaviorallyEquivalent(real: any, stub: any): boolean {
    // Implement flexible comparison that ignores:
    // - Different IDs (stub uses sequential IDs)
    // - Timestamps (stub uses current time)
    // - Extra fields that don't affect behavior
    
    if (Array.isArray(real) && Array.isArray(stub)) {
      if (real.length !== stub.length) return false
      return real.every((item, i) => this.behaviorallyEquivalent(item, stub[i]))
    }

    if (typeof real === 'object' && typeof stub === 'object') {
      // Compare essential fields only
      const essentialFields = ['name', 'mimeType', 'parents', 'trashed']
      for (const field of essentialFields) {
        if (field in real || field in stub) {
          if (!this.behaviorallyEquivalent(real[field], stub[field])) {
            return false
          }
        }
      }
      return true
    }

    return real === stub
  }

  /**
   * Cleanup test data
   */
  async cleanup() {
    // Delete test folder from real API
    if (this.testFolderId) {
      await this.realClient.filesDelete({ fileId: this.testFolderId })
    }
    
    // Reset stub
    this.stubClient.reset()
  }
}