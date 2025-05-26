import {
  GoogleDriveFile,
  GoogleDriveFilesListParams,
  GoogleDriveFilesListResponse,
  GoogleDriveFilesGetParams,
  GoogleDriveFilesUpdateParams,
  GoogleDriveFilesCreateParams,
  GoogleDriveFilesDeleteParams,
  GoogleDriveFilesExportParams,
  GOOGLE_DRIVE_MIME_TYPES,
} from '../types/google-drive-api'
import { GoogleDriveApiClient } from '../services/google-drive-api-client'

/**
 * In-memory file store for testing
 */
interface FileStore {
  [fileId: string]: GoogleDriveFile
}

/**
 * Stub implementation of GoogleDriveApiClient for testing
 * Provides a stateful, in-memory simulation of the Google Drive API
 */
export class GoogleDriveApiStub extends GoogleDriveApiClient {
  private fileStore: FileStore = {}
  private nextFileId = 1
  
  // Track API calls for assertions
  public apiCalls: Array<{ method: string; params: any }> = []

  constructor() {
    // Pass dummy tokens since we won't use them
    super('stub-token', 'stub-refresh-token', 'stub-client-id', 'stub-client-secret')
    
    // Initialize with root folder
    this.fileStore['root'] = {
      id: 'root',
      name: 'My Drive',
      mimeType: GOOGLE_DRIVE_MIME_TYPES.FOLDER,
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: [],
      ownedByMe: true,
    }
  }

  /**
   * Reset the stub to initial state
   */
  reset(): void {
    this.fileStore = {
      root: this.fileStore.root,
    }
    this.nextFileId = 1
    this.apiCalls = []
  }

  /**
   * Add test data to the store
   */
  addTestFile(file: Partial<GoogleDriveFile> & { name: string }): GoogleDriveFile {
    const id = file.id || `test-file-${this.nextFileId++}`
    const now = new Date().toISOString()
    
    const fullFile: GoogleDriveFile = {
      id,
      name: file.name,
      mimeType: file.mimeType || 'text/plain',
      createdTime: file.createdTime || now,
      modifiedTime: file.modifiedTime || now,
      parents: file.parents || ['root'],
      size: file.size,
      shared: file.shared || false,
      ownedByMe: file.ownedByMe ?? true,
      trashed: file.trashed || false,
      ...file,
    }
    
    this.fileStore[id] = fullFile
    return fullFile
  }

  /**
   * Get all files in the store (for debugging)
   */
  getAllFiles(): GoogleDriveFile[] {
    return Object.values(this.fileStore)
  }

  /**
   * Lists files and folders
   */
  async filesList(params: GoogleDriveFilesListParams = {}): Promise<GoogleDriveFilesListResponse> {
    this.apiCalls.push({ method: 'filesList', params })
    
    const {
      q,
      pageSize = 100,
      pageToken,
      orderBy = 'folder,name',
      fields,
    } = params

    // Parse the query
    let files = Object.values(this.fileStore).filter(f => !f.trashed)
    
    if (q) {
      files = this.applyQuery(files, q)
    }

    // Apply ordering
    files = this.applyOrdering(files, orderBy)

    // Handle pagination
    const startIndex = pageToken ? parseInt(pageToken, 10) : 0
    const endIndex = Math.min(startIndex + pageSize, files.length)
    const paginatedFiles = files.slice(startIndex, endIndex)
    const nextPageToken = endIndex < files.length ? endIndex.toString() : undefined

    // Apply field mask if specified
    const resultFiles = fields ? this.applyFieldMask(paginatedFiles, fields) : paginatedFiles

    return {
      kind: 'drive#fileList',
      files: resultFiles,
      nextPageToken,
    }
  }

  /**
   * Gets a file's metadata
   */
  async filesGet(params: GoogleDriveFilesGetParams): Promise<GoogleDriveFile> {
    this.apiCalls.push({ method: 'filesGet', params })
    
    const file = this.fileStore[params.fileId]
    if (!file) {
      throw new Error(`File not found: ${params.fileId}`)
    }

    // Apply field mask if specified
    return params.fields ? this.applyFieldMask([file], params.fields)[0] : file
  }

  /**
   * Updates a file's metadata
   */
  async filesUpdate(params: GoogleDriveFilesUpdateParams): Promise<GoogleDriveFile> {
    this.apiCalls.push({ method: 'filesUpdate', params })
    
    const file = this.fileStore[params.fileId]
    if (!file) {
      throw new Error(`File not found: ${params.fileId}`)
    }

    // Handle parent changes
    if (params.addParents || params.removeParents) {
      const currentParents = new Set(file.parents || [])
      
      if (params.removeParents) {
        params.removeParents.split(',').forEach(p => currentParents.delete(p))
      }
      
      if (params.addParents) {
        params.addParents.split(',').forEach(p => currentParents.add(p))
      }
      
      file.parents = Array.from(currentParents)
    }

    // Apply metadata updates
    if (params.requestBody) {
      Object.assign(file, params.requestBody)
    }

    file.modifiedTime = new Date().toISOString()
    
    return file
  }

  /**
   * Creates a new file or folder
   */
  async filesCreate(params: GoogleDriveFilesCreateParams): Promise<GoogleDriveFile> {
    this.apiCalls.push({ method: 'filesCreate', params })
    
    const id = `file-${this.nextFileId++}`
    const now = new Date().toISOString()
    
    const file: GoogleDriveFile = {
      id,
      ...params.requestBody,
      createdTime: now,
      modifiedTime: now,
      ownedByMe: true,
      shared: false,
      trashed: false,
    }
    
    this.fileStore[id] = file
    return file
  }

  /**
   * Deletes a file
   */
  async filesDelete(params: GoogleDriveFilesDeleteParams): Promise<void> {
    this.apiCalls.push({ method: 'filesDelete', params })
    
    if (!this.fileStore[params.fileId]) {
      throw new Error(`File not found: ${params.fileId}`)
    }
    
    delete this.fileStore[params.fileId]
  }

  /**
   * Downloads a file's content
   */
  async filesDownload(fileId: string, options: { alt?: 'media' } = {}): Promise<Response> {
    this.apiCalls.push({ method: 'filesDownload', params: { fileId, options } })
    
    const file = this.fileStore[fileId]
    if (!file) {
      throw new Error(`File not found: ${fileId}`)
    }

    // Simulate file content based on type
    let content = ''
    let contentType = file.mimeType

    if (file.mimeType === 'text/plain') {
      content = `Content of ${file.name}`
    } else if (file.mimeType === 'application/json') {
      content = JSON.stringify({ name: file.name, data: 'test' })
    } else {
      // Binary content (base64)
      content = btoa(`Binary content of ${file.name}`)
    }

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': content.length.toString(),
      },
    })
  }

  /**
   * Exports a Google Workspace file
   */
  async filesExport(params: GoogleDriveFilesExportParams): Promise<Response> {
    this.apiCalls.push({ method: 'filesExport', params })
    
    const file = this.fileStore[params.fileId]
    if (!file) {
      throw new Error(`File not found: ${params.fileId}`)
    }

    // Simulate export content
    let content = ''
    
    if (file.mimeType === GOOGLE_DRIVE_MIME_TYPES.DOCUMENT) {
      if (params.mimeType === 'text/plain') {
        content = `Text export of document: ${file.name}`
      } else if (params.mimeType === 'text/html') {
        content = `<html><body><h1>${file.name}</h1></body></html>`
      }
    } else if (file.mimeType === GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET) {
      if (params.mimeType === 'text/csv') {
        content = `name,value\n${file.name},test`
      }
    }

    return new Response(content, {
      headers: {
        'Content-Type': params.mimeType,
        'Content-Length': content.length.toString(),
      },
    })
  }

  /**
   * Apply a Google Drive query to filter files
   */
  private applyQuery(files: GoogleDriveFile[], query: string): GoogleDriveFile[] {
    // Parse common query patterns
    const patterns = {
      inParents: /'([^']+)' in parents/g,
      nameContains: /name contains '([^']+)'/g,
      nameEquals: /name = '([^']+)'/g,
      mimeType: /mimeType = '([^']+)'/g,
      fullTextContains: /fullText contains '([^']+)'/g,
      trashed: /trashed = (true|false)/g,
      sharedWithMe: /sharedWithMe = (true|false)/g,
    }

    let result = files

    // Filter by parent
    const parentMatches = [...query.matchAll(patterns.inParents)]
    if (parentMatches.length > 0) {
      const parentIds = parentMatches.map(m => m[1])
      result = result.filter(f => 
        f.parents?.some(p => parentIds.includes(p))
      )
    }

    // Filter by name contains
    const nameContainsMatches = [...query.matchAll(patterns.nameContains)]
    if (nameContainsMatches.length > 0) {
      const searchTerms = nameContainsMatches.map(m => m[1].toLowerCase())
      result = result.filter(f =>
        searchTerms.some(term => f.name.toLowerCase().includes(term))
      )
    }

    // Filter by name equals
    const nameEqualsMatches = [...query.matchAll(patterns.nameEquals)]
    if (nameEqualsMatches.length > 0) {
      const names = nameEqualsMatches.map(m => m[1])
      result = result.filter(f => names.includes(f.name))
    }

    // Filter by mime type
    const mimeTypeMatches = [...query.matchAll(patterns.mimeType)]
    if (mimeTypeMatches.length > 0) {
      const mimeTypes = mimeTypeMatches.map(m => m[1])
      result = result.filter(f => mimeTypes.includes(f.mimeType))
    }

    // Filter by full text
    const fullTextMatches = [...query.matchAll(patterns.fullTextContains)]
    if (fullTextMatches.length > 0) {
      const searchTerms = fullTextMatches.map(m => m[1].toLowerCase())
      result = result.filter(f =>
        searchTerms.some(term => 
          f.name.toLowerCase().includes(term) ||
          f.description?.toLowerCase().includes(term)
        )
      )
    }

    // Filter by trashed
    const trashedMatch = patterns.trashed.exec(query)
    if (trashedMatch) {
      const trashedValue = trashedMatch[1] === 'true'
      result = result.filter(f => f.trashed === trashedValue)
    }

    // Filter by sharedWithMe
    const sharedMatch = patterns.sharedWithMe.exec(query)
    if (sharedMatch) {
      const sharedValue = sharedMatch[1] === 'true'
      if (sharedValue) {
        result = result.filter(f => f.shared && !f.ownedByMe)
      } else {
        // sharedWithMe = false means exclude files shared by others
        result = result.filter(f => f.ownedByMe || !f.shared)
      }
    }

    return result
  }

  /**
   * Apply ordering to files
   */
  private applyOrdering(files: GoogleDriveFile[], orderBy: string): GoogleDriveFile[] {
    const orders = orderBy.split(',').map(o => o.trim())
    
    return files.sort((a, b) => {
      for (const order of orders) {
        const [field, direction] = order.split(' ')
        const desc = direction === 'desc'
        
        let aVal: any = a[field as keyof GoogleDriveFile]
        let bVal: any = b[field as keyof GoogleDriveFile]
        
        // Special handling for 'folder' ordering
        if (field === 'folder') {
          aVal = a.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER ? 0 : 1
          bVal = b.mimeType === GOOGLE_DRIVE_MIME_TYPES.FOLDER ? 0 : 1
        }
        
        if (aVal < bVal) return desc ? 1 : -1
        if (aVal > bVal) return desc ? -1 : 1
      }
      return 0
    })
  }

  /**
   * Apply field mask to limit returned fields
   */
  private applyFieldMask(files: GoogleDriveFile[], fields: string): GoogleDriveFile[] {
    // Parse fields parameter - handle nested fields syntax like files(id,name,mimeType)
    if (fields.includes('files(')) {
      // Extract fields within files(...) parentheses
      const filesMatch = fields.match(/files\(([^)]+)\)/)
      if (filesMatch) {
        const innerFields = filesMatch[1].split(',').map(f => f.trim())
        const requestedFields = new Set(innerFields)
        requestedFields.add('id') // Always include id
        
        return files.map(file => {
          const filtered: any = {}
          for (const field of requestedFields) {
            if (field in file) {
              filtered[field] = file[field as keyof GoogleDriveFile]
            }
          }
          return filtered as GoogleDriveFile
        })
      }
    }
    
    // If no specific field mask or not in expected format, return all fields
    return files
  }
}