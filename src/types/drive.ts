export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: number
  createdTime: string
  modifiedTime: string
  parents: string[]
  path: string
  isFolder: boolean
  isShared: boolean
  sharingStatus: 'private' | 'shared' | 'public'
  folderDepth: number
}

export interface ListDirectoryResult {
  files: DriveFile[]
  nextPageToken?: string
  totalResults?: number
}

export interface ReadFileResult {
  content: string
  mimeType: string
  size: number
  truncated: boolean
  encoding: string
}

export interface SearchFilesResult {
  files: DriveFile[]
}

export interface DriveService {
  listDirectory(params: {
    folderPath?: string
    folderId?: string
    query?: string
    includeShared?: boolean
    onlyDirectories?: boolean
    pageSize?: number
    pageToken?: string
  }): Promise<ListDirectoryResult>

  readFile(params: {
    fileId: string
    maxSize?: number
    startOffset?: number
    endOffset?: number
  }): Promise<ReadFileResult>

  searchFiles(params: {
    query: string
    folderId?: string
    mimeType?: string
    namePattern?: string
    maxResults?: number
  }): Promise<SearchFilesResult>

  // Bulk move operations (ID-based)
  moveFile(fileId: string, newParentId: string): Promise<void>
  moveFolder(folderId: string, newParentId: string): Promise<void>
  createFolder(name: string, parentId: string): Promise<{ id: string }>
  renameFile(fileId: string, newName: string): Promise<void>
  renameFolder(folderId: string, newName: string): Promise<void>

  // Path resolution
  resolvePathToId(path: string): Promise<string>
  resolveIdToPath(fileId: string): Promise<string>
  
  // Tree building
  buildDirectoryTree(rootPath?: string, maxDepth?: number): Promise<string[]>
  buildFileTree(rootPath?: string, maxDepth?: number): Promise<string[]>
}