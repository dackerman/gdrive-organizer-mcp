import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ApiComparisonTestHarness } from './test-harness'
import { behavioralTests } from './behavioral-tests'

describe('GoogleDriveApiStub Behavioral Verification', () => {
  let harness: ApiComparisonTestHarness

  beforeAll(async () => {
    harness = new ApiComparisonTestHarness()
    await harness.initialize()
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  describe('Behavioral Consistency', () => {
    it('should handle folder creation and listing consistently', async () => {
      const result = await harness.runComparison(
        async (client) => behavioralTests.folderCreationAndListing(
          client, 
          (harness as any).testFolderId
        ),
        {
          normalize: (result) => ({
            found: result.found,
            idMatches: result.created === result.foundId
          })
        }
      )

      expect(result.matches).toBe(true)
      expect(result.real.found).toBe(true)
      expect(result.real.created).toBe(result.real.foundId)
    })

    it('should handle file moves consistently', async () => {
      const result = await harness.runComparison(
        async (client) => behavioralTests.fileMove(
          client,
          (harness as any).testFolderId
        ),
        {
          normalize: (result) => ({
            inDestination: result.inDestination,
            notInSource: result.notInSource,
            parentCount: result.fileParents?.length
          })
        }
      )

      expect(result.matches).toBe(true)
      expect(result.real.inDestination).toBe(true)
      expect(result.real.notInSource).toBe(true)
    })

    it('should handle query operators consistently', async () => {
      const result = await harness.runComparison(
        async (client) => behavioralTests.queryOperators(
          client,
          (harness as any).testFolderId
        )
      )

      expect(result.matches).toBe(true)
      
      // Verify expected results
      expect(result.real.containsAlpha).toEqual(['alpha.txt', 'alphabet.txt'])
      expect(result.real.exactName).toEqual(['beta.doc'])
      expect(result.real.textFiles).toEqual(['alpha.txt', 'alphabet.txt'])
    })

    it('should handle trashed files consistently', async () => {
      const result = await harness.runComparison(
        async (client) => behavioralTests.trashedBehavior(
          client,
          (harness as any).testFolderId
        ),
        {
          normalize: (result) => ({
            fileDisappearedFromNormalList: result.beforeCount > result.afterCount,
            fileAppearedInTrashedList: result.trashedCount > 0 && result.fileWasTrashed
          })
        }
      )

      expect(result.matches).toBe(true)
      expect(result.real).toMatchObject({
        fileDisappearedFromNormalList: true,
        fileAppearedInTrashedList: true
      })
    })
  })
})