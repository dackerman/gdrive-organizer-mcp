/**
 * Utilities for building Google Drive API queries and path operations
 */

/**
 * Query builder for Google Drive API
 */
export class DriveQueryBuilder {
  private conditions: string[] = []

  /**
   * Add a parent folder constraint
   */
  inParents(parentId: string): this {
    this.conditions.push(`'${parentId}' in parents`)
    return this
  }

  /**
   * Add name equality constraint
   */
  nameEquals(name: string): this {
    // Escape single quotes in the name
    const escapedName = name.replace(/'/g, "\\'")
    this.conditions.push(`name = '${escapedName}'`)
    return this
  }

  /**
   * Add name contains constraint
   */
  nameContains(text: string): this {
    // Escape single quotes in the text
    const escapedText = text.replace(/'/g, "\\'")
    this.conditions.push(`name contains '${escapedText}'`)
    return this
  }

  /**
   * Add full text search constraint
   */
  fullTextContains(text: string): this {
    // Escape single quotes in the text
    const escapedText = text.replace(/'/g, "\\'")
    this.conditions.push(`fullText contains '${escapedText}'`)
    return this
  }

  /**
   * Add MIME type constraint
   */
  mimeTypeEquals(mimeType: string): this {
    this.conditions.push(`mimeType = '${mimeType}'`)
    return this
  }

  /**
   * Add MIME type contains constraint
   */
  mimeTypeContains(mimeType: string): this {
    this.conditions.push(`mimeType contains '${mimeType}'`)
    return this
  }

  /**
   * Add modified time constraint
   */
  modifiedAfter(dateTime: string): this {
    this.conditions.push(`modifiedTime > '${dateTime}'`)
    return this
  }

  /**
   * Exclude trashed files
   */
  notTrashed(): this {
    this.conditions.push('trashed = false')
    return this
  }

  /**
   * Include only trashed files
   */
  onlyTrashed(): this {
    this.conditions.push('trashed = true')
    return this
  }

  /**
   * Add custom query condition
   */
  custom(condition: string): this {
    this.conditions.push(condition)
    return this
  }

  /**
   * Build the final query string
   */
  build(): string {
    return this.conditions.join(' and ')
  }

  /**
   * Create a new query builder
   */
  static create(): DriveQueryBuilder {
    return new DriveQueryBuilder()
  }
}

/**
 * Path utilities for Google Drive
 */
export class DrivePathUtils {
  /**
   * Normalize a path (ensure it starts with /)
   */
  static normalizePath(path: string): string {
    if (!path || path === '') return '/'
    return path.startsWith('/') ? path : `/${path}`
  }

  /**
   * Get the parent path from a given path
   */
  static getParentPath(path: string): string {
    const normalized = this.normalizePath(path)
    if (normalized === '/') return '/'
    
    const lastSlash = normalized.lastIndexOf('/')
    return lastSlash === 0 ? '/' : normalized.substring(0, lastSlash)
  }

  /**
   * Get the name (last segment) from a path
   */
  static getNameFromPath(path: string): string {
    const normalized = this.normalizePath(path)
    if (normalized === '/') return ''
    
    const lastSlash = normalized.lastIndexOf('/')
    return normalized.substring(lastSlash + 1)
  }

  /**
   * Split a path into segments
   */
  static splitPath(path: string): string[] {
    const normalized = this.normalizePath(path)
    if (normalized === '/') return []
    
    return normalized.split('/').filter(segment => segment.length > 0)
  }

  /**
   * Join path segments
   */
  static joinPath(...segments: string[]): string {
    const filtered = segments.filter(s => s && s !== '/')
    if (filtered.length === 0) return '/'
    return '/' + filtered.join('/')
  }

  /**
   * Check if a path is the root
   */
  static isRoot(path: string): boolean {
    return this.normalizePath(path) === '/'
  }
}

/**
 * Common MIME types for Google Drive
 */
export const DRIVE_MIME_TYPES = {
  FOLDER: 'application/vnd.google-apps.folder',
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FORM: 'application/vnd.google-apps.form',
  DRAWING: 'application/vnd.google-apps.drawing',
  SCRIPT: 'application/vnd.google-apps.script',
  SITE: 'application/vnd.google-apps.site',
  PDF: 'application/pdf',
  IMAGE_JPEG: 'image/jpeg',
  IMAGE_PNG: 'image/png',
  VIDEO_MP4: 'video/mp4',
  TEXT_PLAIN: 'text/plain',
  TEXT_HTML: 'text/html'
} as const