import { DriveService, DriveFile, ListDirectoryResult, ReadFileResult, SearchFilesResult } from '../types/drive'

// Add type definitions for environment variables
interface ImportMetaEnv {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export class GoogleDriveService implements DriveService {
  // Path resolution cache to avoid repeated API calls
  private pathToIdCache = new Map<string, string>()
  private idToPathCache = new Map<string, string>()
  private refreshToken: string
  private clientId: string
  private clientSecret: string
  
  constructor(
    private accessToken: string, 
    refreshToken?: string,
    clientId?: string,
    clientSecret?: string
  ) {
    // Log token info (first and last few chars only for security)
    const tokenPreview = accessToken && accessToken.length > 10 
      ? `${accessToken.substring(0, 4)}...${accessToken.substring(accessToken.length - 4)}`
      : '[token too short]'
    console.log('[GoogleDriveService] Initialized with token:', tokenPreview)
    
    this.refreshToken = refreshToken || ''
    this.clientId = clientId || ''
    this.clientSecret = clientSecret || ''
    
    // Initialize root path
    this.pathToIdCache.set('/', 'root')
    this.idToPathCache.set('root', '/')
  }

  private async refreshAccessToken(): Promise<void> {
    console.log('[GoogleDriveService] Refreshing access token...')
    
    // Check if we have the necessary credentials to refresh
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Cannot refresh token: missing refresh token or client credentials. In production, tokens should be managed by the OAuth provider.')
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`)
    }

    const data = await response.json() as { access_token: string }
    this.accessToken = data.access_token
    console.log('[GoogleDriveService] Access token refreshed successfully')
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // If access token is empty or missing, refresh it first
    if (!this.accessToken || this.accessToken.trim() === '') {
      console.log('[GoogleDriveService] Access token is empty, refreshing...')
      await this.refreshAccessToken()
    }

    const makeRequestWithToken = async (token: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
    }

    // Try with current token
    let response = await makeRequestWithToken(this.accessToken)

    // If unauthorized or forbidden (in case of expired token), try refreshing token and retry once
    if (response.status === 401 || response.status === 403) {
      console.log(`[GoogleDriveService] Got ${response.status} response, attempting token refresh...`)
      await this.refreshAccessToken()
      response = await makeRequestWithToken(this.accessToken)
    }

    return response
  }

  // Path resolution methods
  
  /**
   * Resolve a Google Drive path to a file/folder ID
   * @param path - Full path from root like "/Documents/Projects" or "/" for root
   * @returns Google Drive file ID
   */
  async resolvePathToId(path: string): Promise<string> {
    // Normalize path
    const normalizedPath = this.normalizePath(path)
    
    // Check cache first
    if (this.pathToIdCache.has(normalizedPath)) {
      return this.pathToIdCache.get(normalizedPath)!
    }
    
    // Root case
    if (normalizedPath === '/') {
      return 'root'
    }
    
    // Split path into components
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0)
    
    // Walk the path from root
    let currentId = 'root'
    let currentPath = ''
    
    for (const part of pathParts) {
      currentPath += '/' + part
      
      // Check if we have this path cached
      if (this.pathToIdCache.has(currentPath)) {
        currentId = this.pathToIdCache.get(currentPath)!
        continue
      }
      
      // Search for the part in current directory
      const children = await this.listDirectory({ folderId: currentId, maxResults: 1000 })
      const found = children.files.find(file => file.name === part)
      
      if (!found) {
        throw new Error(`Path not found: ${currentPath}`)
      }
      
      currentId = found.id
      
      // Cache the resolved path
      this.pathToIdCache.set(currentPath, currentId)
      this.idToPathCache.set(currentId, currentPath)
    }
    
    return currentId
  }
  
  /**
   * Resolve a Google Drive file ID to a path
   * @param fileId - Google Drive file ID
   * @returns Full path from root
   */
  async resolveIdToPath(fileId: string): Promise<string> {
    // Check cache first
    if (this.idToPathCache.has(fileId)) {
      return this.idToPathCache.get(fileId)!
    }
    
    // Root case
    if (fileId === 'root') {
      return '/'
    }
    
    // Get file metadata to build path
    const path = await this.buildPathFromId(fileId)
    
    // Cache the result
    this.pathToIdCache.set(path, fileId)
    this.idToPathCache.set(fileId, path)
    
    return path
  }
  
  /**
   * Build directory tree starting from a given path
   * @param rootPath - Starting path (default: "/")
   * @param maxDepth - Maximum depth to traverse (default: 10)
   * @returns Array of directory paths
   */
  async buildDirectoryTree(rootPath: string = '/', maxDepth: number = 10): Promise<string[]> {
    const directories: string[] = []
    const rootId = await this.resolvePathToId(rootPath)
    
    // Use breadth-first traversal to minimize API calls
    const queue: Array<{ id: string; path: string; depth: number }> = [
      { id: rootId, path: rootPath, depth: 0 }
    ]
    
    // Process in batches to avoid too many concurrent requests
    while (queue.length > 0) {
      // Process up to 5 folders at once to limit concurrent API calls
      const batch = queue.splice(0, 5)
      
      await Promise.all(
        batch.map(async ({ id, path, depth }) => {
          directories.push(path)
          
          // Only traverse children if we haven't reached maxDepth
          if (depth < maxDepth) {
            try {
              const contents = await this.listDirectory({ folderId: id, maxResults: 100 })
              
              for (const item of contents.files) {
                if (item.isFolder) {
                  const childPath = path === '/' ? '/' + item.name : path + '/' + item.name
                  
                  // Cache the path
                  this.pathToIdCache.set(childPath, item.id)
                  this.idToPathCache.set(item.id, childPath)
                  
                  // Add to queue for next iteration
                  queue.push({ id: item.id, path: childPath, depth: depth + 1 })
                }
              }
            } catch (error) {
              console.error(`[GoogleDriveService] Error processing folder ${path}:`, error)
              // Continue with other folders even if one fails
            }
          }
        })
      )
    }
    
    return directories.sort()
  }
  
  /**
   * Build file tree starting from a given path
   * @param rootPath - Starting path (default: "/")
   * @param maxDepth - Maximum depth to traverse (default: 10)
   * @returns Array of file paths
   */
  async buildFileTree(rootPath: string = '/', maxDepth: number = 10): Promise<string[]> {
    const files: string[] = []
    const rootId = await this.resolvePathToId(rootPath)
    
    // Use breadth-first traversal to minimize API calls
    const queue: Array<{ id: string; path: string; depth: number }> = [
      { id: rootId, path: rootPath, depth: 0 }
    ]
    
    // Process in batches to avoid too many concurrent requests
    while (queue.length > 0) {
      // Process up to 5 folders at once to limit concurrent API calls
      const batch = queue.splice(0, 5)
      
      await Promise.all(
        batch.map(async ({ id, path, depth }) => {
          if (depth >= maxDepth) return
          
          try {
            const contents = await this.listDirectory({ folderId: id, maxResults: 100 })
            
            for (const item of contents.files) {
              const itemPath = path === '/' ? '/' + item.name : path + '/' + item.name
              
              // Cache the path
              this.pathToIdCache.set(itemPath, item.id)
              this.idToPathCache.set(item.id, itemPath)
              
              if (item.isFolder) {
                // Add to queue for next iteration
                queue.push({ id: item.id, path: itemPath, depth: depth + 1 })
              } else {
                // Add file to list
                files.push(itemPath)
              }
            }
          } catch (error) {
            console.error(`[GoogleDriveService] Error processing folder ${path}:`, error)
            // Continue with other folders even if one fails
          }
        })
      )
    }
    
    return files.sort()
  }
  
  // Helper methods
  
  private normalizePath(path: string): string {
    // Handle empty path
    if (!path || path === '') return '/'
    
    // Ensure path starts with /
    if (!path.startsWith('/')) path = '/' + path
    
    // Remove trailing slash (except for root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    
    return path
  }
  
  private async buildPathFromId(fileId: string): Promise<string> {
    const url = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=id,name,parents`
    const response = await this.makeRequest(url)
    
    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.status}`)
    }
    
    const file = await response.json() as { id: string, name: string, parents?: string[] }
    
    // If no parents, this is likely in root
    if (!file.parents || file.parents.length === 0) {
      return '/' + file.name
    }
    
    // Recursively build parent path
    const parentPath = await this.resolveIdToPath(file.parents[0])
    return parentPath === '/' ? '/' + file.name : parentPath + '/' + file.name
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

    const response = await this.makeRequest(url.toString())

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

    const metadataResponse = await this.makeRequest(metadataUrl)

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

    const contentResponse = await this.makeRequest(downloadUrl, {
      headers: {
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

    const response = await this.makeRequest(exportUrl, {
      headers: {
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

    const response = await this.makeRequest(url.toString())

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
    const metadataResponse = await this.makeRequest(metadataUrl)

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      throw new Error(`Failed to get file metadata: ${metadataResponse.status} ${errorText}`)
    }

    const metadata = await metadataResponse.json() as { parents?: string[] }
    const currentParents = metadata.parents || []

    // If file is already in the target folder, no need to move it
    if (currentParents.includes(newParentId)) {
      console.log('[GoogleDriveService] File is already in target folder')
      return
    }

    // Update file with new parent
    // Note: addParents and removeParents must be query parameters, not in the body
    const updateUrl = new URL(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}`)
    updateUrl.searchParams.append('addParents', newParentId)
    updateUrl.searchParams.append('removeParents', currentParents.join(','))
    
    const updateResponse = await this.makeRequest(updateUrl.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})  // Empty body for metadata-only update
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to move file: ${updateResponse.status} ${errorText}`)
    }

    // Verify the move was successful
    const verifyUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=parents`
    const verifyResponse = await this.makeRequest(verifyUrl)

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text()
      console.error('[GoogleDriveService] Failed to verify file move:', verifyResponse.status, errorText)
      throw new Error(`Failed to verify file move: ${verifyResponse.status} ${verifyResponse.statusText}`)
    }

    const verifyData = await verifyResponse.json() as { parents: string[] }
    if (!verifyData.parents.includes(newParentId)) {
      throw new Error('File move verification failed - file is not in the expected parent')
    }

    console.log('[GoogleDriveService] File moved successfully')
  }

  async moveFolder(folderId: string, newParentId: string): Promise<void> {
    // First verify the folder exists and is actually a folder
    const metadataUrl = `${GOOGLE_DRIVE_API_BASE}/files/${folderId}?fields=id,name,mimeType,parents`
    const metadataResponse = await this.makeRequest(metadataUrl)

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error('[GoogleDriveService] Failed to get folder metadata:', metadataResponse.status, errorText)
      throw new Error(`Failed to get folder metadata: ${metadataResponse.status} ${metadataResponse.statusText}`)
    }

    const metadata = await metadataResponse.json() as {
      id: string
      name: string
      mimeType: string
      parents?: string[]
    }

    if (metadata.mimeType !== FOLDER_MIME_TYPE) {
      throw new Error(`Item with ID ${folderId} is not a folder`)
    }

    // Verify the new parent exists and is a folder
    const parentMetadataUrl = `${GOOGLE_DRIVE_API_BASE}/files/${newParentId}?fields=id,name,mimeType`
    const parentMetadataResponse = await this.makeRequest(parentMetadataUrl)

    if (!parentMetadataResponse.ok) {
      const errorText = await parentMetadataResponse.text()
      console.error('[GoogleDriveService] Failed to get parent folder metadata:', parentMetadataResponse.status, errorText)
      throw new Error(`Failed to get parent folder metadata: ${parentMetadataResponse.status} ${parentMetadataResponse.statusText}`)
    }

    const parentMetadata = await parentMetadataResponse.json() as {
      id: string
      name: string
      mimeType: string
    }

    if (parentMetadata.mimeType !== FOLDER_MIME_TYPE) {
      throw new Error(`Target parent with ID ${newParentId} is not a folder`)
    }

    // Now move the folder
    await this.moveFile(folderId, newParentId)

    // Verify the move was successful
    const verifyUrl = `${GOOGLE_DRIVE_API_BASE}/files/${folderId}?fields=parents`
    const verifyResponse = await this.makeRequest(verifyUrl)

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text()
      console.error('[GoogleDriveService] Failed to verify folder move:', verifyResponse.status, errorText)
      throw new Error(`Failed to verify folder move: ${verifyResponse.status} ${verifyResponse.statusText}`)
    }

    const verifyData = await verifyResponse.json() as { parents: string[] }
    if (!verifyData.parents.includes(newParentId)) {
      throw new Error('Folder move verification failed - folder is not in the expected parent')
    }
  }

  async createFolder(name: string, parentId: string): Promise<{ id: string }> {
    console.log('[GoogleDriveService] createFolder called:', { name, parentId })

    const url = `${GOOGLE_DRIVE_API_BASE}/files`
    const response = await this.makeRequest(url, {
      method: 'POST',
      headers: {
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
    const response = await this.makeRequest(url, {
      method: 'PATCH',
      headers: {
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