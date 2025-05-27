import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ApiComparisonTestHarness } from './test-harness'
import { GOOGLE_DRIVE_MIME_TYPES } from '../../types/google-drive-api'

describe('GoogleDriveApiStub Verification', () => {
  let harness: ApiComparisonTestHarness

  beforeAll(async () => {
    harness = new ApiComparisonTestHarness()
    await harness.initialize()
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  describe('Files API', () => {
    it('should handle filesCreate consistently', async () => {
      const result = await harness.runComparison(
        async (client) => {
          return client.filesCreate({
            requestBody: {
              name: 'test-document.txt',
              mimeType: 'text/plain',
              parents: [(harness as any).testFolderId]
            }
          })
        },
        {
          normalize: (file) => ({
            name: file.name,
            mimeType: file.mimeType,
            parents: file.parents,
            hasId: !!file.id
          })
        }
      )

      expect(result.matches).toBe(true)
    })

    it('should handle filesList consistently', async () => {
      // First create some files
      await harness.runComparison(async (client) => {
        await client.filesCreate({
          requestBody: {
            name: 'file1.txt',
            mimeType: 'text/plain',
            parents: [(harness as any).testFolderId]
          }
        })
        await client.filesCreate({
          requestBody: {
            name: 'file2.txt',
            mimeType: 'text/plain',
            parents: [(harness as any).testFolderId]
          }
        })
        await client.filesCreate({
          requestBody: {
            name: 'folder1',
            mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
            parents: [(harness as any).testFolderId]
          }
        })
      })

      // Now test listing
      const result = await harness.runComparison(
        async (client) => {
          return client.filesList({
            q: `'${(harness as any).testFolderId}' in parents and trashed = false`,
            orderBy: 'folder,name',
            fields: 'files(name,mimeType)'
          })
        },
        {
          normalize: (response) => ({
            fileCount: response.files.length,
            files: response.files.map(f => ({
              name: f.name,
              mimeType: f.mimeType
            })).sort((a, b) => {
              // Sort folders first, then by name
              if (a.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER && b.mimeType !== GOOGLE_DRIVE_MIME_TYPES.FOLDER) return -1
              if (a.mimeType !== GOOGLE_DRIVE_MIME_TYPES.FOLDER && b.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER) return 1
              return a.name.localeCompare(b.name)
            })
          })
        }
      )

      expect(result.matches).toBe(true)
      if (!result.matches) {
        console.log('Differences:', result.differences)
      }
    })

    it('should handle query operators consistently', async () => {
      // Test various query patterns
      const queries = [
        `name contains 'file'`,
        `mimeType = 'text/plain'`,
        `name = 'file1.txt'`,
        `mimeType = '${GOOGLE_DRIVE_MIME_TYPES.FOLDER}'`
      ]

      for (const query of queries) {
        const result = await harness.runComparison(
          async (client) => {
            return client.filesList({
              q: `'${(harness as any).testFolderId}' in parents and ${query}`,
              fields: 'files(name,mimeType)'
            })
          },
          {
            normalize: (response) => ({
              query,
              count: response.files.length,
              names: response.files.map(f => f.name).sort()
            })
          }
        )

        expect(result.matches).toBe(true)
        if (!result.matches) {
          console.log(`Query "${query}" produced different results:`, result.differences)
        }
      }
    })

    it('should handle filesUpdate consistently', async () => {
      // Create a file to update
      const createResult = await harness.runComparison(
        async (client) => {
          return client.filesCreate({
            requestBody: {
              name: 'update-test.txt',
              mimeType: 'text/plain',
              parents: [(harness as any).testFolderId]
            }
          })
        }
      )

      const fileId = (createResult.real as any).id
      // Sync the ID to stub for consistency
      const stubFile = (harness as any).stubClient.getAllFiles().find((f: any) => f.name === 'update-test.txt')
      if (stubFile) {
        stubFile.id = fileId
      }

      // Test update
      const result = await harness.runComparison(
        async (client) => {
          return client.filesUpdate({
            fileId,
            requestBody: {
              name: 'updated-name.txt'
            }
          })
        },
        {
          normalize: (file) => ({
            name: file.name,
            mimeType: file.mimeType,
            parents: file.parents
          })
        }
      )

      expect(result.matches).toBe(true)
    })

    it('should handle pagination consistently', async () => {
      // Create many files to trigger pagination
      const fileCount = 15
      await harness.runComparison(async (client) => {
        for (let i = 1; i <= fileCount; i++) {
          await client.filesCreate({
            requestBody: {
              name: `page-test-${i.toString().padStart(2, '0')}.txt`,
              mimeType: 'text/plain',
              parents: [(harness as any).testFolderId]
            }
          })
        }
      })

      // Test pagination
      const pageSize = 5
      const result = await harness.runComparison(
        async (client) => {
          const allFiles = []
          let pageToken: string | undefined

          do {
            const response = await client.filesList({
              q: `'${(harness as any).testFolderId}' in parents and name contains 'page-test'`,
              pageSize,
              pageToken,
              orderBy: 'name',
              fields: 'files(name),nextPageToken'
            })
            
            allFiles.push(...response.files)
            pageToken = response.nextPageToken
          } while (pageToken)

          return allFiles
        },
        {
          normalize: (files) => ({
            totalCount: files.length,
            names: files.map((f: any) => f.name).sort()
          })
        }
      )

      expect(result.matches).toBe(true)
      expect((result.real as any).length).toBe(fileCount)
    })
  })
})