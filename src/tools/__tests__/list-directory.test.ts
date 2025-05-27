import { describe, it, expect, beforeEach } from 'vitest'
import { createListDirectoryTool } from '../list-directory'
import { GoogleDriveTestFactory } from '../../test/google-drive-test-factory'
import { GoogleDriveApiStub } from '../../test/google-drive-api-stub'
import { GoogleDriveAdapter } from '../../services/google-drive-adapter'

describe('listDirectory tool', () => {
  let stub: GoogleDriveApiStub
  let service: GoogleDriveAdapter
  let tool: any

  beforeEach(() => {
    // Create fresh instances for each test
    const testSetup = GoogleDriveTestFactory.createWithTestData()
    stub = testSetup.stub
    service = testSetup.service
    tool = createListDirectoryTool(service)
  })

  it('should list files in root directory', async () => {
    // Execute the tool
    const result = await tool.handler({
      folderPath: '/',
      pageSize: 50
    })

    // Verify the API was called correctly
    expect(stub.apiCalls).toHaveLength(1)
    expect(stub.apiCalls[0]).toEqual({
      method: 'filesList',
      params: expect.objectContaining({
        q: "'root' in parents and trashed = false",
        pageSize: 50,
      })
    })

    // Parse the result
    const content = JSON.parse(result.content[0].text)
    
    // Verify the response structure
    expect(content).toHaveProperty('files')
    expect(content).toHaveProperty('hasMore')
    // nextPageToken is optional - only present when there are more results
    if (content.hasMore) {
      expect(content).toHaveProperty('nextPageToken')
    }
    
    // Verify we got the expected folders
    const folderNames = content.files
      .filter((f: any) => f.isDirectory)
      .map((f: any) => f.name)
      .sort()
    
    expect(folderNames).toEqual(['Documents', 'Photos', 'Projects'])
  })

  it('should list files in a subdirectory', async () => {
    // Execute the tool for /Documents
    const result = await tool.handler({
      folderPath: '/Documents',
      pageSize: 10
    })

    // Parse the result
    const content = JSON.parse(result.content[0].text)
    
    // Verify we got files from Documents folder
    const fileNames = content.files.map((f: any) => f.name).sort()
    expect(fileNames).toContain('test-file.txt')
    expect(fileNames).toContain('report.pdf')
    expect(fileNames).toContain('Work') // subfolder
    
    // Verify paths are correct
    const testFile = content.files.find((f: any) => f.name === 'test-file.txt')
    expect(testFile.path).toBe('/Documents/test-file.txt')
  })

  it('should support pagination', async () => {
    // Add more files to trigger pagination
    for (let i = 1; i <= 25; i++) {
      stub.addTestFile({
        id: `test-file-${i}`,
        name: `file-${i}.txt`,
        mimeType: 'text/plain',
        parents: ['root'],
      })
    }

    // Get first page
    const firstPage = await tool.handler({
      folderPath: '/',
      pageSize: 10
    })

    const firstContent = JSON.parse(firstPage.content[0].text)
    expect(firstContent.files).toHaveLength(10)
    expect(firstContent.hasMore).toBe(true)
    expect(firstContent.nextPageToken).toBeDefined()

    // Get second page
    const secondPage = await tool.handler({
      folderPath: '/',
      pageSize: 10,
      pageToken: firstContent.nextPageToken
    })

    const secondContent = JSON.parse(secondPage.content[0].text)
    expect(secondContent.files).toHaveLength(10)
    
    // Verify no duplicate files between pages
    const firstIds = firstContent.files.map((f: any) => f.name)
    const secondIds = secondContent.files.map((f: any) => f.name)
    const intersection = firstIds.filter((id: string) => secondIds.includes(id))
    expect(intersection).toHaveLength(0)
  })

  it('should filter by onlyDirectories', async () => {
    const result = await tool.handler({
      folderPath: '/',
      onlyDirectories: true,
      pageSize: 50
    })

    const content = JSON.parse(result.content[0].text)
    
    // All results should be directories
    expect(content.files.every((f: any) => f.isDirectory)).toBe(true)
    
    // Should only have the 3 folders we created
    expect(content.files).toHaveLength(3)
    expect(content.files.map((f: any) => f.name).sort()).toEqual([
      'Documents', 'Photos', 'Projects'
    ])
  })

  it('should handle includeShared parameter', async () => {
    // Add a shared file that we don't own
    stub.addTestFile({
      id: 'external-shared-file',
      name: 'external-shared.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      parents: ['root'],
      shared: true,
      ownedByMe: false,
    })

    // List Documents folder without shared files
    const withoutShared = await tool.handler({
      folderPath: '/Documents',
      includeShared: false,
      pageSize: 50
    })

    // Find the actual listDirectory call (after path resolution)
    const listCall = stub.apiCalls.find(call => 
      call.method === 'filesList' && call.params.q?.includes('in parents') && !call.params.q?.includes('name =')
    )
    expect(listCall).toBeDefined()
    expect(listCall?.params.q).toContain('sharedWithMe = false')

    const content = JSON.parse(withoutShared.content[0].text)
    
    // The stub should filter out files that are shared by others when sharedWithMe = false
    const fileNames = content.files.map((f: any) => f.name)
    expect(fileNames).not.toContain('external-shared.docx')
    
    // But it should still include files we own that we've shared
    expect(fileNames).toContain('shared-document.docx') // This is owned by us
  })

  it('should handle path resolution errors gracefully', async () => {
    // Try to list a non-existent path
    await expect(
      tool.handler({
        folderPath: '/NonExistent/Path'
      })
    ).rejects.toThrow('Path not found')
  })

  it('should handle empty directories', async () => {
    // Create an empty folder
    stub.addTestFile({
      id: 'empty-folder',
      name: 'EmptyFolder',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    })

    const result = await tool.handler({
      folderPath: '/EmptyFolder',
      pageSize: 50
    })

    const content = JSON.parse(result.content[0].text)
    
    expect(content.files).toHaveLength(0)
    expect(content.hasMore).toBe(false)
    expect(content.nextPageToken).toBeUndefined()
  })

  it('should use default values when parameters are not provided', async () => {
    const result = await tool.handler({})

    // Verify defaults were applied
    expect(stub.apiCalls[0].params).toMatchObject({
      q: "'root' in parents and trashed = false",
      pageSize: 20, // default page size
    })

    const content = JSON.parse(result.content[0].text)
    expect(content.files).toBeDefined()
  })

  it('should have correct metadata', () => {
    expect(tool.name).toBe('list_directory')
    expect(tool.description).toContain('Lists files and folders in a Google Drive directory')
    expect(tool.schema).toBeDefined()
    
    // Verify schema properties
    expect(tool.schema).toHaveProperty('folderPath')
    expect(tool.schema).toHaveProperty('includeShared')
    expect(tool.schema).toHaveProperty('onlyDirectories')
    expect(tool.schema).toHaveProperty('pageSize')
    expect(tool.schema).toHaveProperty('pageToken')
    expect(tool.schema).toHaveProperty('fields')
    expect(tool.schema).toHaveProperty('query')
  })
})