import { describe, it, expect } from 'vitest'
import { runAgainstBoth } from './adapter-factory'
import { createCreateFoldersTool } from '../../tools/create-folders'
import { createListDirectoryTool, listDirectorySchema } from '../../tools/list-directory'
import { createMoveFilesTool } from '../../tools/move-files'

/**
 * Example of running existing integration tests against both real and stub APIs
 * This helps verify the stub behaves like the real API in actual tool usage
 */
describe('Integration Test Comparison', () => {
  describe('create_folders tool', () => {
    it('should create folders consistently', async () => {
      const testFolderName = `test-comparison-${Date.now()}`
      
      const result = await runAgainstBoth(async (adapter) => {
        const tool = createCreateFoldersTool(adapter)
        
        // Create a folder
        const createResult = await tool.handler({
          paths: [`/${testFolderName}/subfolder1`, `/${testFolderName}/subfolder2`]
        })
        
        const parsed = JSON.parse(createResult.content[0].text)
        
        // List to verify
        const listTool = createListDirectoryTool(adapter)
        const listParams = listDirectorySchema.parse({
          folderPath: `/${testFolderName}`
        })
        const listResult = await listTool.handler(listParams)
        
        const listParsed = JSON.parse(listResult.content[0].text)
        
        // Cleanup (for real API)
        try {
          const rootId = await adapter.resolvePathToId(`/${testFolderName}`)
          await (adapter as any).apiClient.filesDelete({ fileId: rootId })
        } catch {}
        
        return {
          created: parsed.summary.foldersCreated,
          listedCount: listParsed.files.length,
          folderNames: listParsed.files.map((f: any) => f.name).sort()
        }
      })
      
      expect(result.matched).toBe(true)
      expect(result.real).toEqual({
        created: 2,
        listedCount: 2,
        folderNames: ['subfolder1', 'subfolder2']
      })
    })
  })

  describe('move_files tool', () => {
    it('should move files consistently', async () => {
      const testFolderName = `test-move-${Date.now()}`
      
      const result = await runAgainstBoth(async (adapter) => {
        // Setup: Create folders and a file
        const createTool = createCreateFoldersTool(adapter)
        await createTool.handler({
          paths: [
            `/${testFolderName}/source`,
            `/${testFolderName}/destination`
          ]
        })
        
        // Create a file in source (using the adapter directly)
        const sourceId = await adapter.resolvePathToId(`/${testFolderName}/source`)
        await adapter.createFolder('test-file.txt', sourceId)
        
        // Move the file
        const moveTool = createMoveFilesTool(adapter)
        const moveResult = await moveTool.handler({
          operations: [{
            from: `/${testFolderName}/source/test-file.txt`,
            to: `/${testFolderName}/destination/test-file.txt`
          }]
        })
        
        const moveParsed = JSON.parse(moveResult.content[0].text)
        
        // Verify file is in destination
        const listTool = createListDirectoryTool(adapter)
        const destListParams = listDirectorySchema.parse({
          folderPath: `/${testFolderName}/destination`
        })
        const destList = await listTool.handler(destListParams)
        const destParsed = JSON.parse(destList.content[0].text)
        
        // Verify file is NOT in source
        const sourceListParams = listDirectorySchema.parse({
          folderPath: `/${testFolderName}/source`
        })
        const sourceList = await listTool.handler(sourceListParams)
        const sourceParsed = JSON.parse(sourceList.content[0].text)
        
        // Cleanup
        try {
          const rootId = await adapter.resolvePathToId(`/${testFolderName}`)
          await (adapter as any).apiClient.filesDelete({ fileId: rootId })
        } catch {}
        
        return {
          moveSuccess: moveParsed.success,
          inDestination: destParsed.files.some((f: any) => f.name === 'test-file.txt'),
          inSource: sourceParsed.files.some((f: any) => f.name === 'test-file.txt')
        }
      })
      
      expect(result.matched).toBe(true)
      expect(result.real).toEqual({
        moveSuccess: true,
        inDestination: true,
        inSource: false
      })
    })
  })
})