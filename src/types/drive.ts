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
    folderId?: string
    includeShared?: boolean
    maxResults?: number
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
}