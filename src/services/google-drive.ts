import { DriveService, DriveFile, ListDirectoryResult } from '../types/drive'

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export class GoogleDriveService implements DriveService {
  constructor(private accessToken: string) {}

  async listDirectory(params: {
    folderId?: string
    includeShared?: boolean
    maxResults?: number
  }): Promise<ListDirectoryResult> {
    const {
      folderId = 'root',
      includeShared = true,
      maxResults = 100
    } = params

    // Build query
    let query = `'${folderId}' in parents`
    if (!includeShared) {
      query += ' and sharedWithMe = false'
    }
    query += ' and trashed = false'

    // Make API request
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`)
    url.searchParams.append('q', query)
    url.searchParams.append('pageSize', maxResults.toString())
    url.searchParams.append('fields', 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,shared,sharingUser,permissions)')
    url.searchParams.append('orderBy', 'folder,name')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      files: Array<{
        id: string
        name: string
        mimeType: string
        size?: string
        createdTime: string
        modifiedTime: string
        parents?: string[]
        shared?: boolean
        sharingUser?: any
        permissions?: Array<{ role: string }>
      }>
    }

    // Get folder paths for better UX
    const pathCache = new Map<string, string>()
    
    // Convert to our format
    const files: DriveFile[] = await Promise.all(
      data.files.map(async (file) => {
        const isFolder = file.mimeType === FOLDER_MIME_TYPE
        const isShared = file.shared || false
        const isPublic = file.permissions?.some(p => p.role === 'reader' || p.role === 'writer') || false
        
        // Calculate path
        const path = await this.getFilePath(file.id, file.name, file.parents?.[0], pathCache)
        const folderDepth = path.split('/').filter(p => p).length - 1

        return {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? parseInt(file.size, 10) : undefined,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
          parents: file.parents || [],
          path,
          isFolder,
          isShared,
          sharingStatus: isPublic ? 'public' : (isShared ? 'shared' : 'private'),
          folderDepth
        }
      })
    )

    return { files }
  }

  private async getFilePath(
    fileId: string,
    fileName: string,
    parentId: string | undefined,
    cache: Map<string, string>
  ): Promise<string> {
    if (!parentId || parentId === 'root') {
      return `/${fileName}`
    }

    // Check cache
    if (cache.has(parentId)) {
      return `${cache.get(parentId)}/${fileName}`
    }

    // Fetch parent info
    try {
      const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${parentId}?fields=id,name,parents`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        // If we can't get parent info, just return with parent ID
        return `/<${parentId}>/${fileName}`
      }

      const parent = await response.json() as {
        id: string
        name: string
        parents?: string[]
      }

      const parentPath = await this.getFilePath(
        parent.id,
        parent.name,
        parent.parents?.[0],
        cache
      )
      
      cache.set(parentId, parentPath)
      return `${parentPath}/${fileName}`
    } catch {
      return `/<${parentId}>/${fileName}`
    }
  }
}