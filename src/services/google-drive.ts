import { DriveService, DriveFile, ListDirectoryResult } from '../types/drive'

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export class GoogleDriveService implements DriveService {
  constructor(private accessToken: string) {
    // Log token info (first and last few chars only for security)
    const tokenPreview = accessToken.length > 10 
      ? `${accessToken.substring(0, 4)}...${accessToken.substring(accessToken.length - 4)}`
      : '[token too short]'
    console.log('[GoogleDriveService] Initialized with token:', tokenPreview)
  }

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

    console.log('[GoogleDriveService] listDirectory called with:', {
      folderId,
      includeShared,
      maxResults
    })

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

    console.log('[GoogleDriveService] Request URL:', url.toString())
    console.log('[GoogleDriveService] Query:', query)

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json'
    }

    console.log('[GoogleDriveService] Request headers:', {
      ...headers,
      'Authorization': `Bearer ${this.accessToken.substring(0, 4)}...${this.accessToken.substring(this.accessToken.length - 4)}`
    })

    const response = await fetch(url.toString(), { headers })

    console.log('[GoogleDriveService] Response status:', response.status, response.statusText)
    console.log('[GoogleDriveService] Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      let errorDetails = ''
      try {
        const errorBody = await response.text()
        errorDetails = errorBody
        console.error('[GoogleDriveService] Error response body:', errorBody)
        
        // Try to parse as JSON for better error info
        try {
          const errorJson = JSON.parse(errorBody)
          console.error('[GoogleDriveService] Error JSON:', errorJson)
          if (errorJson.error) {
            errorDetails = `${errorJson.error.message || errorBody} (code: ${errorJson.error.code})`
          }
        } catch (e) {
          // Not JSON, use raw text
        }
      } catch (e) {
        console.error('[GoogleDriveService] Could not read error body:', e)
      }
      
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}. ${errorDetails}`)
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

    console.log('[GoogleDriveService] Response data:', {
      fileCount: data.files.length,
      files: data.files.slice(0, 3).map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType }))
    })

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

    console.log('[GoogleDriveService] Processed files:', {
      totalFiles: files.length,
      sample: files.slice(0, 3).map(f => ({ name: f.name, path: f.path, isFolder: f.isFolder }))
    })

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
      const cachedPath = `${cache.get(parentId)}/${fileName}`
      console.log('[GoogleDriveService] Path from cache:', cachedPath)
      return cachedPath
    }

    // Fetch parent info
    try {
      console.log('[GoogleDriveService] Fetching parent info for:', parentId)
      const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${parentId}?fields=id,name,parents`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('[GoogleDriveService] Failed to get parent info:', response.status, response.statusText)
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
      console.log('[GoogleDriveService] Built path:', `${parentPath}/${fileName}`)
      return `${parentPath}/${fileName}`
    } catch (error) {
      console.error('[GoogleDriveService] Error getting file path:', error)
      return `/<${parentId}>/${fileName}`
    }
  }
}