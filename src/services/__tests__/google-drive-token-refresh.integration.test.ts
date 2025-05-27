import { describe, it, expect, beforeAll } from 'vitest'
import { GoogleDriveService } from '../google-drive'
import { GoogleDriveApiClient } from '../google-drive-api-client'
import { getTestCredentials } from '../../test/integration-setup'

describe('GoogleDriveService Token Refresh Integration Tests', () => {
  let credentials: ReturnType<typeof getTestCredentials>

  beforeAll(() => {
    credentials = getTestCredentials()
  })

  describe('Token Refresh', () => {
    it('should successfully refresh token when starting with empty access token', async () => {
      // Start with empty access token to force refresh
      const service = new GoogleDriveService(
        '', // Empty access token
        credentials.refresh_token,
        credentials.client_id,
        credentials.client_secret,
      )

      // This should trigger a token refresh
      const result = await service.listDirectory({
        folderId: 'root',
        pageSize: 1,
      })

      expect(result).toBeDefined()
      expect(result.files).toBeInstanceOf(Array)
    })

    it('should handle expired token by refreshing automatically', async () => {
      // Create a service with an invalid/expired token
      const service = new GoogleDriveService(
        'invalid-expired-token-12345',
        credentials.refresh_token,
        credentials.client_id,
        credentials.client_secret,
      )

      // This should get a 401 and then refresh automatically
      const result = await service.listDirectory({
        folderId: 'root',
        pageSize: 1,
      })

      expect(result).toBeDefined()
      expect(result.files).toBeInstanceOf(Array)
    })

    it('should refresh token proactively when close to expiration', async () => {
      // Create API client directly to test token expiration logic
      const apiClient = new GoogleDriveApiClient('test-token', credentials.refresh_token, credentials.client_id, credentials.client_secret)

      // Set token to expire in 4 minutes (less than the 5-minute threshold)
      // @ts-ignore - accessing private property for testing
      apiClient.tokenExpiresAt = Date.now() + 4 * 60 * 1000

      // This should trigger proactive refresh
      const response = await apiClient.filesList({
        q: "'root' in parents",
        pageSize: 1,
      })

      expect(response).toBeDefined()
      expect(response.files).toBeInstanceOf(Array)
    })

    it('should fail gracefully when refresh token is missing', async () => {
      const service = new GoogleDriveService(
        'invalid-token',
        undefined, // No refresh token
        credentials.client_id,
        credentials.client_secret,
      )

      await expect(
        service.listDirectory({
          folderId: 'root',
          pageSize: 1,
        }),
      ).rejects.toThrow()
    })

    it('should fail gracefully when client credentials are missing', async () => {
      const service = new GoogleDriveService(
        'invalid-token',
        credentials.refresh_token,
        undefined, // No client ID
        undefined, // No client secret
      )

      await expect(
        service.listDirectory({
          folderId: 'root',
          pageSize: 1,
        }),
      ).rejects.toThrow('Cannot refresh token')
    })

    it('should perform multiple operations after token refresh', async () => {
      // Start with empty token to force refresh
      const service = new GoogleDriveService('', credentials.refresh_token, credentials.client_id, credentials.client_secret)

      // First operation - triggers refresh
      const result1 = await service.listDirectory({
        folderId: 'root',
        pageSize: 1,
      })
      expect(result1.files).toBeInstanceOf(Array)

      // Second operation - should use refreshed token
      const result2 = await service.searchFiles({
        query: 'test',
        maxResults: 1,
      })
      expect(result2.files).toBeInstanceOf(Array)

      // Third operation - should still work
      const testFolderName = `test-refresh-${Date.now()}`
      const result3 = await service.createFolder(testFolderName, 'root')
      expect(result3.id).toBeTruthy()

      // Cleanup - in real implementation would delete the folder
      console.log('Created test folder:', result3.id)
    })
  })
})
