import { DriveService, DriveFile, ListDirectoryResult, ReadFileResult, SearchFilesResult } from '../types/drive'

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

  async readFile(params: {
    fileId: string
    maxSize?: number
    startOffset?: number
    endOffset?: number
  }): Promise<ReadFileResult> {
    const {
      fileId,
      maxSize = 1048576, // 1MB default
      startOffset = 0,
      endOffset
    } = params

    console.log('[GoogleDriveService] readFile called with:', {
      fileId,
      maxSize,
      startOffset,
      endOffset
    })

    // First, get file metadata to check mime type and size
    const metadataUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size`
    console.log('[GoogleDriveService] Fetching file metadata:', metadataUrl)

    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error('[GoogleDriveService] Failed to get file metadata:', metadataResponse.status, errorText)
      throw new Error(`Failed to get file metadata: ${metadataResponse.status} ${metadataResponse.statusText}`)
    }

    const metadata = await metadataResponse.json() as {
      id: string
      name: string
      mimeType: string
      size?: string
    }

    console.log('[GoogleDriveService] File metadata:', metadata)

    const fileSize = metadata.size ? parseInt(metadata.size, 10) : 0
    const isGoogleDoc = metadata.mimeType.startsWith('application/vnd.google-apps.')

    // Handle Google Docs differently - they need to be exported
    if (isGoogleDoc) {
      return this.readGoogleDoc(fileId, metadata.mimeType, maxSize)
    }

    // For binary files, download content
    const downloadUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`
    
    // Calculate range for partial content
    const effectiveEndOffset = endOffset ?? Math.min(startOffset + maxSize - 1, fileSize - 1)
    const rangeHeader = `bytes=${startOffset}-${effectiveEndOffset}`
    
    console.log('[GoogleDriveService] Downloading file content with range:', rangeHeader)

    const contentResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Range': rangeHeader
      }
    })

    if (!contentResponse.ok && contentResponse.status !== 206) { // 206 is partial content
      const errorText = await contentResponse.text()
      console.error('[GoogleDriveService] Failed to download file:', contentResponse.status, errorText)
      throw new Error(`Failed to download file: ${contentResponse.status} ${contentResponse.statusText}`)
    }

    const contentType = contentResponse.headers.get('content-type') || metadata.mimeType
    const contentLength = parseInt(contentResponse.headers.get('content-length') || '0', 10)
    
    // Determine if content is text or binary
    const isText = contentType.startsWith('text/') || 
                   contentType.includes('json') || 
                   contentType.includes('xml') ||
                   contentType.includes('javascript') ||
                   contentType.includes('typescript')

    let content: string
    let encoding: string

    if (isText) {
      content = await contentResponse.text()
      encoding = 'utf-8'
    } else {
      // For binary files, return base64 encoded
      const buffer = await contentResponse.arrayBuffer()
      content = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      encoding = 'base64'
    }

    const truncated = effectiveEndOffset < fileSize - 1

    console.log('[GoogleDriveService] File read complete:', {
      size: contentLength,
      truncated,
      encoding,
      mimeType: contentType
    })

    return {
      content,
      mimeType: contentType,
      size: contentLength,
      truncated,
      encoding
    }
  }

  private async readGoogleDoc(fileId: string, mimeType: string, maxSize: number): Promise<ReadFileResult> {
    // Map Google Docs types to export formats
    const exportMimeTypes: Record<string, string> = {
      'application/vnd.google-apps.document': 'text/plain',
      'application/vnd.google-apps.spreadsheet': 'text/csv',
      'application/vnd.google-apps.presentation': 'text/plain',
      'application/vnd.google-apps.drawing': 'image/png',
      'application/vnd.google-apps.script': 'application/vnd.google-apps.script+json'
    }

    const exportMimeType = exportMimeTypes[mimeType] || 'text/plain'
    const exportUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`

    console.log('[GoogleDriveService] Exporting Google Doc as:', exportMimeType)

    const response = await fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': exportMimeType
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GoogleDriveService] Failed to export Google Doc:', response.status, errorText)
      throw new Error(`Failed to export Google Doc: ${response.status} ${response.statusText}`)
    }

    const content = await response.text()
    const truncated = content.length > maxSize

    return {
      content: truncated ? content.substring(0, maxSize) : content,
      mimeType: exportMimeType,
      size: content.length,
      truncated,
      encoding: 'utf-8'
    }
  }

  async searchFiles(params: {
    query: string
    folderId?: string
    mimeType?: string
    namePattern?: string
    maxResults?: number
  }): Promise<SearchFilesResult> {
    const {
      query,
      folderId,
      mimeType,
      namePattern,
      maxResults = 50
    } = params

    console.log('[GoogleDriveService] searchFiles called with:', params)

    // Build search query
    const queryParts: string[] = []
    
    // Add text search
    if (query) {
      queryParts.push(`(name contains '${query}' or fullText contains '${query}')`)
    }
    
    // Add folder filter
    if (folderId) {
      queryParts.push(`'${folderId}' in parents`)
    }
    
    // Add mime type filter
    if (mimeType) {
      queryParts.push(`mimeType = '${mimeType}'`)
    }
    
    // Always exclude trashed files
    queryParts.push('trashed = false')
    
    const driveQuery = queryParts.join(' and ')
    
    console.log('[GoogleDriveService] Search query:', driveQuery)

    // Make API request
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`)
    url.searchParams.append('q', driveQuery)
    url.searchParams.append('pageSize', maxResults.toString())
    url.searchParams.append('fields', 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,shared,sharingUser,permissions)')
    url.searchParams.append('orderBy', 'modifiedTime desc')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GoogleDriveService] Search failed:', response.status, errorText)
      throw new Error(`Search failed: ${response.status} ${response.statusText}`)
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

    console.log('[GoogleDriveService] Search returned', data.files.length, 'files')

    // Filter by name pattern if provided
    let files = data.files
    if (namePattern) {
      try {
        const regex = new RegExp(namePattern, 'i')
        files = files.filter(file => regex.test(file.name))
        console.log('[GoogleDriveService] After name pattern filter:', files.length, 'files')
      } catch (e) {
        console.error('[GoogleDriveService] Invalid regex pattern:', namePattern, e)
      }
    }

    // Get paths for all files
    const pathCache = new Map<string, string>()
    const driveFiles: DriveFile[] = await Promise.all(
      files.map(async (file) => {
        const isFolder = file.mimeType === FOLDER_MIME_TYPE
        const isShared = file.shared || false
        const isPublic = file.permissions?.some(p => p.role === 'reader' || p.role === 'writer') || false
        
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

    return { files: driveFiles }
  }

  // Bulk move operations
  async moveFile(fileId: string, newParentId: string): Promise<void> {
    console.log('[GoogleDriveService] moveFile called:', { fileId, newParentId })

    // First get current parents
    const metadataUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=parents`
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      throw new Error(`Failed to get file metadata: ${metadataResponse.status} ${errorText}`)
    }

    const metadata = await metadataResponse.json() as { parents?: string[] }
    const currentParents = metadata.parents?.join(',') || ''

    // Update file with new parent
    const updateUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}`
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        addParents: newParentId,
        removeParents: currentParents
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to move file: ${updateResponse.status} ${errorText}`)
    }

    console.log('[GoogleDriveService] File moved successfully')
  }

  async moveFolder(folderId: string, newParentId: string): Promise<void> {
    // Moving a folder is the same as moving a file in Google Drive
    return this.moveFile(folderId, newParentId)
  }

  async createFolder(name: string, parentId: string): Promise<{ id: string }> {
    console.log('[GoogleDriveService] createFolder called:', { name, parentId })

    const url = `${GOOGLE_DRIVE_API_BASE}/files`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME_TYPE,
        parents: [parentId]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create folder: ${response.status} ${errorText}`)
    }

    const result = await response.json() as { id: string }
    console.log('[GoogleDriveService] Folder created with id:', result.id)
    
    return { id: result.id }
  }

  async renameFile(fileId: string, newName: string): Promise<void> {
    console.log('[GoogleDriveService] renameFile called:', { fileId, newName })

    const url = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to rename file: ${response.status} ${errorText}`)
    }

    console.log('[GoogleDriveService] File renamed successfully')
  }

  async renameFolder(folderId: string, newName: string): Promise<void> {
    // Renaming a folder is the same as renaming a file in Google Drive
    return this.renameFile(folderId, newName)
  }
}