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

export interface DriveService {
  listDirectory(params: {
    folderId?: string
    includeShared?: boolean
    maxResults?: number
  }): Promise<ListDirectoryResult>
}