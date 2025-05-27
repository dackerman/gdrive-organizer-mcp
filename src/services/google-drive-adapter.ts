import { GoogleDriveApiClient } from './google-drive-api-client'
import { GoogleDriveFile, GOOGLE_DRIVE_MIME_TYPES, GOOGLE_WORKSPACE_EXPORT_FORMATS } from '../types/google-drive-api'
import { DriveService, DriveFile, ListDirectoryResult, ReadFileResult, SearchFilesResult } from '../types/drive'
import { DriveQueryBuilder, DrivePathUtils } from '../drive-query-utils'

/**
 * Adapter that provides backward compatibility with the existing DriveService interface
 * while using the new Google Drive API client underneath
 */
export class GoogleDriveAdapter implements DriveService {
  private apiClient: GoogleDriveApiClient
  private pathToIdCache = new Map<string, string>()
  private idToPathCache = new Map<string, string>()

  constructor(accessToken: string, refreshToken?: string, clientId?: string, clientSecret?: string) {
    this.apiClient = new GoogleDriveApiClient(accessToken, refreshToken, clientId, clientSecret)

    // Initialize root path
    this.pathToIdCache.set('/', 'root')
    this.idToPathCache.set('root', '/')
  }

  /**
   * Converts a Google Drive API file to our internal DriveFile format
   */
  private async convertToDriveFile(file: GoogleDriveFile, path?: string): Promise<DriveFile> {
    // If path not provided, try to resolve it
    if (!path) {
      path = await this.getFilePath(file.id, file.name, file.parents?.[0])
    }

    const isFolder = file.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER
    const isShared = file.shared || false
    const isPublic = file.permissions?.some((p) => p.type === 'anyone' || (p.type === 'domain' && p.role !== 'owner')) || false

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : undefined,
      createdTime: file.createdTime || '',
      modifiedTime: file.modifiedTime || '',
      parents: file.parents || [],
      path,
      isFolder,
      isShared,
      sharingStatus: isPublic ? 'public' : isShared ? 'shared' : 'private',
      folderDepth: path.split('/').filter((p) => p).length - 1,
    }
  }

  /**
   * Helper to build path from file ID
   */
  private async getFilePath(fileId: string, fileName: string, parentId?: string): Promise<string> {
    // Check cache first
    if (this.idToPathCache.has(fileId)) {
      return this.idToPathCache.get(fileId)!
    }

    if (!parentId || parentId === 'root') {
      const path = `/${fileName}`
      this.idToPathCache.set(fileId, path)
      this.pathToIdCache.set(path, fileId)
      return path
    }

    // Check if parent is cached
    if (this.idToPathCache.has(parentId)) {
      const parentPath = this.idToPathCache.get(parentId)!
      const path = `${parentPath}/${fileName}`
      this.idToPathCache.set(fileId, path)
      this.pathToIdCache.set(path, fileId)
      return path
    }

    // Fetch parent info
    try {
      const parent = await this.apiClient.filesGet({
        fileId: parentId,
        fields: 'id,name,parents',
      })

      const parentPath = await this.getFilePath(parent.id, parent.name, parent.parents?.[0])

      const path = `${parentPath}/${fileName}`
      this.idToPathCache.set(fileId, path)
      this.pathToIdCache.set(path, fileId)
      return path
    } catch (error) {
      // If we can't get parent info, return with parent ID
      return `/<${parentId}>/${fileName}`
    }
  }

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
    const pathParts = normalizedPath.split('/').filter((part) => part.length > 0)

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
      const query = DriveQueryBuilder.create().inParents(currentId).nameEquals(part).notTrashed().build()

      const response = await this.apiClient.filesList({
        q: query,
        fields: 'files(id,name)',
        pageSize: 1,
      })

      if (response.files.length === 0) {
        throw new Error(`Path not found: ${currentPath}`)
      }

      currentId = response.files[0].id

      // Cache the resolved path
      this.pathToIdCache.set(currentPath, currentId)
      this.idToPathCache.set(currentId, currentPath)
    }

    return currentId
  }

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
    const file = await this.apiClient.filesGet({
      fileId,
      fields: 'id,name,parents',
    })

    const path = await this.getFilePath(file.id, file.name, file.parents?.[0])
    return path
  }

  async listDirectory(params: {
    folderPath?: string
    folderId?: string
    query?: string
    includeShared?: boolean
    onlyDirectories?: boolean
    pageSize?: number
    pageToken?: string
  }): Promise<ListDirectoryResult> {
    const { folderPath, folderId, query: userQuery, includeShared = true, onlyDirectories = false, pageSize = 20, pageToken } = params

    // Resolve folder ID from path if provided
    let targetFolderId = folderId || 'root'
    if (folderPath) {
      targetFolderId = await this.resolvePathToId(folderPath)
    }

    // Build query
    let query = ''

    // If user provided a custom query, use it as the base
    if (userQuery) {
      query = userQuery
      // Add folder constraint if not already present
      if (!userQuery.includes('in parents')) {
        query = `'${targetFolderId}' in parents and (${query})`
      }
    } else {
      // Build default query using query builder
      const queryBuilder = DriveQueryBuilder.create().inParents(targetFolderId)

      // Always exclude trashed files unless explicitly included in user query
      queryBuilder.notTrashed()

      // Apply additional filters
      if (!includeShared) {
        queryBuilder.custom('sharedWithMe = false')
      }
      if (onlyDirectories) {
        queryBuilder.mimeTypeEquals(GOOGLE_DRIVE_MIME_TYPES.FOLDER)
      }

      query = queryBuilder.build()
    }

    // For user queries, add constraints if not already present
    if (userQuery) {
      if (!query.includes('trashed')) {
        query += ' and trashed = false'
      }
      if (!includeShared && !query.includes('sharedWithMe')) {
        query += ' and sharedWithMe = false'
      }
      if (onlyDirectories && !query.includes('mimeType')) {
        query += ` and mimeType = '${GOOGLE_DRIVE_MIME_TYPES.FOLDER}'`
      }
    }

    // Make API request
    const response = await this.apiClient.filesList({
      q: query,
      pageSize,
      pageToken,
      fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,shared,permissions)',
      orderBy: 'folder,name',
    })

    // Convert files to our format
    const files: DriveFile[] = await Promise.all(response.files.map((file) => this.convertToDriveFile(file)))

    return {
      files,
      nextPageToken: response.nextPageToken,
    }
  }

  async readFile(params: { fileId: string; maxSize?: number; startOffset?: number; endOffset?: number }): Promise<ReadFileResult> {
    const {
      fileId,
      maxSize = 1048576, // 1MB default
      startOffset = 0,
      endOffset,
    } = params

    // First, get file metadata
    const file = await this.apiClient.filesGet({
      fileId,
      fields: 'id,name,mimeType,size',
    })

    const fileSize = file.size ? parseInt(file.size, 10) : 0
    const isGoogleDoc = file.mimeType.startsWith('application/vnd.google-apps.')

    // Handle Google Docs differently - they need to be exported
    if (isGoogleDoc) {
      return this.readGoogleDoc(file, maxSize)
    }

    // For binary files, download content
    const response = await this.apiClient.filesDownload(fileId)

    // Handle range requests if needed
    let content: string
    let encoding: string
    let actualSize: number

    if (startOffset > 0 || endOffset !== undefined) {
      // Read the full content and slice it
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      const end = endOffset ?? Math.min(startOffset + maxSize, bytes.length)
      const slice = bytes.slice(startOffset, end)

      // Determine if content is text or binary
      const isText = this.isTextMimeType(file.mimeType)

      if (isText) {
        content = new TextDecoder().decode(slice)
        encoding = 'utf-8'
      } else {
        content = btoa(String.fromCharCode(...slice))
        encoding = 'base64'
      }

      actualSize = slice.length
    } else {
      // Read normally
      const contentType = response.headers.get('content-type') || file.mimeType
      const isText = this.isTextMimeType(contentType)

      if (isText) {
        content = await response.text()
        encoding = 'utf-8'
        actualSize = content.length

        // Truncate if needed
        if (content.length > maxSize) {
          content = content.substring(0, maxSize)
        }
      } else {
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)

        // Truncate if needed
        const truncatedBytes = bytes.length > maxSize ? bytes.slice(0, maxSize) : bytes

        content = btoa(String.fromCharCode(...truncatedBytes))
        encoding = 'base64'
        actualSize = truncatedBytes.length
      }
    }

    return {
      content,
      mimeType: file.mimeType,
      size: actualSize,
      truncated: actualSize < fileSize,
      encoding,
    }
  }

  private async readGoogleDoc(file: GoogleDriveFile, maxSize: number): Promise<ReadFileResult> {
    // Map Google Docs types to export formats
    const exportMimeTypes: Record<string, string> = {
      [GOOGLE_DRIVE_MIME_TYPES.DOCUMENT]: GOOGLE_DRIVE_MIME_TYPES.EXPORT_TXT,
      [GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET]: GOOGLE_DRIVE_MIME_TYPES.EXPORT_CSV,
      [GOOGLE_DRIVE_MIME_TYPES.PRESENTATION]: GOOGLE_DRIVE_MIME_TYPES.EXPORT_TXT,
      [GOOGLE_DRIVE_MIME_TYPES.DRAWING]: GOOGLE_DRIVE_MIME_TYPES.EXPORT_PNG,
      [GOOGLE_DRIVE_MIME_TYPES.SCRIPT]: 'application/vnd.google-apps.script+json',
    }

    const exportMimeType = exportMimeTypes[file.mimeType] || GOOGLE_DRIVE_MIME_TYPES.EXPORT_TXT
    const response = await this.apiClient.filesExport({
      fileId: file.id,
      mimeType: exportMimeType,
    })

    const content = await response.text()
    const truncated = content.length > maxSize

    return {
      content: truncated ? content.substring(0, maxSize) : content,
      mimeType: exportMimeType,
      size: content.length,
      truncated,
      encoding: 'utf-8',
    }
  }

  private isTextMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('xml') ||
      mimeType.includes('javascript') ||
      mimeType.includes('typescript')
    )
  }

  async searchFiles(params: {
    query: string
    folderId?: string
    mimeType?: string
    namePattern?: string
    maxResults?: number
  }): Promise<SearchFilesResult> {
    const { query, folderId, mimeType, namePattern, maxResults = 50 } = params

    // Build search query
    const queryBuilder = DriveQueryBuilder.create()

    // Add text search
    if (query) {
      // Create a custom condition for combined name/fullText search
      queryBuilder.custom(`(name contains '${query.replace(/'/g, "\\'")}' or fullText contains '${query.replace(/'/g, "\\'")}')`)
    }

    // Add folder filter
    if (folderId) {
      queryBuilder.inParents(folderId)
    }

    // Add mime type filter
    if (mimeType) {
      queryBuilder.mimeTypeEquals(mimeType)
    }

    // Always exclude trashed files
    queryBuilder.notTrashed()

    const driveQuery = queryBuilder.build()

    // Make API request
    const response = await this.apiClient.filesList({
      q: driveQuery,
      pageSize: maxResults,
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,shared,permissions)',
      orderBy: 'modifiedTime desc',
    })

    // Filter by name pattern if provided
    let files = response.files
    if (namePattern) {
      try {
        const regex = new RegExp(namePattern, 'i')
        files = files.filter((file) => regex.test(file.name))
      } catch (e) {
        // Invalid regex, skip filtering
      }
    }

    // Convert to our format
    const driveFiles: DriveFile[] = await Promise.all(files.map((file) => this.convertToDriveFile(file)))

    return { files: driveFiles }
  }

  // File operation methods
  async moveFile(fileId: string, newParentId: string): Promise<void> {
    // First get current parents
    const file = await this.apiClient.filesGet({
      fileId,
      fields: 'parents',
    })

    const currentParents = file.parents || []

    // If file is already in the target folder, no need to move
    if (currentParents.includes(newParentId)) {
      return
    }

    // Update file with new parent
    await this.apiClient.filesUpdate({
      fileId,
      addParents: newParentId,
      removeParents: currentParents.join(','),
    })
  }

  async moveFolder(folderId: string, newParentId: string): Promise<void> {
    // Verify it's actually a folder
    const folder = await this.apiClient.filesGet({
      fileId: folderId,
      fields: 'id,mimeType',
    })

    if (folder.mimeType !== GOOGLE_DRIVE_MIME_TYPES.FOLDER) {
      throw new Error(`Item with ID ${folderId} is not a folder`)
    }

    // Use the same moveFile logic
    await this.moveFile(folderId, newParentId)
  }

  async createFolder(name: string, parentId: string): Promise<{ id: string }> {
    const result = await this.apiClient.filesCreate({
      requestBody: {
        name,
        mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
        parents: [parentId],
      },
      fields: 'id',
    })

    return { id: result.id }
  }

  async renameFile(fileId: string, newName: string): Promise<void> {
    await this.apiClient.filesUpdate({
      fileId,
      requestBody: { name: newName },
    })
  }

  async renameFolder(folderId: string, newName: string): Promise<void> {
    // Renaming a folder is the same as renaming a file
    await this.renameFile(folderId, newName)
  }

  // Tree building methods (kept for compatibility)
  async buildDirectoryTree(rootPath: string = '/', maxDepth: number = 10): Promise<string[]> {
    const directories: string[] = []
    const rootId = await this.resolvePathToId(rootPath)

    const queue: Array<{ id: string; path: string; depth: number }> = [{ id: rootId, path: rootPath, depth: 0 }]

    while (queue.length > 0) {
      const batch = queue.splice(0, 5)

      await Promise.all(
        batch.map(async ({ id, path, depth }) => {
          directories.push(path)

          if (depth < maxDepth) {
            try {
              const response = await this.apiClient.filesList({
                q: `'${id}' in parents and mimeType = '${GOOGLE_DRIVE_MIME_TYPES.FOLDER}' and trashed = false`,
                pageSize: 100,
                fields: 'files(id,name)',
              })

              for (const item of response.files) {
                const childPath = path === '/' ? '/' + item.name : path + '/' + item.name

                this.pathToIdCache.set(childPath, item.id)
                this.idToPathCache.set(item.id, childPath)

                queue.push({ id: item.id, path: childPath, depth: depth + 1 })
              }
            } catch (error) {
              // Continue with other folders even if one fails
            }
          }
        }),
      )
    }

    return directories.sort()
  }

  async buildFileTree(rootPath: string = '/', maxDepth: number = 10): Promise<string[]> {
    const files: string[] = []
    const rootId = await this.resolvePathToId(rootPath)

    const queue: Array<{ id: string; path: string; depth: number }> = [{ id: rootId, path: rootPath, depth: 0 }]

    while (queue.length > 0) {
      const batch = queue.splice(0, 5)

      await Promise.all(
        batch.map(async ({ id, path, depth }) => {
          if (depth >= maxDepth) return

          try {
            const response = await this.apiClient.filesList({
              q: `'${id}' in parents and trashed = false`,
              pageSize: 100,
              fields: 'files(id,name,mimeType)',
            })

            for (const item of response.files) {
              const itemPath = DrivePathUtils.joinPath(path, item.name)

              this.pathToIdCache.set(itemPath, item.id)
              this.idToPathCache.set(item.id, itemPath)

              if (item.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER) {
                queue.push({ id: item.id, path: itemPath, depth: depth + 1 })
              } else {
                files.push(itemPath)
              }
            }
          } catch (error) {
            // Continue with other folders even if one fails
          }
        }),
      )
    }

    return files.sort()
  }

  private normalizePath(path: string): string {
    return DrivePathUtils.normalizePath(path)
  }
}
