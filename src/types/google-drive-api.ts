/**
 * Google Drive API v3 Types
 * These types closely match the Google Drive API v3 specification
 * Reference: https://developers.google.com/drive/api/v3/reference
 */

/**
 * Represents a file or folder in Google Drive
 * @see https://developers.google.com/drive/api/v3/reference/files#resource
 */
export interface GoogleDriveFile {
  // Basic identification
  id: string
  name: string
  mimeType: string
  
  // File metadata
  size?: string // Size in bytes as string (API returns string for large files)
  createdTime?: string // RFC 3339 date-time
  modifiedTime?: string // RFC 3339 date-time
  
  // Organization
  parents?: string[] // Array of parent folder IDs
  starred?: boolean
  trashed?: boolean
  explicitlyTrashed?: boolean
  
  // Sharing and permissions
  shared?: boolean
  ownedByMe?: boolean
  sharingUser?: {
    displayName: string
    emailAddress: string
    photoLink?: string
  }
  owners?: Array<{
    displayName: string
    emailAddress: string
    photoLink?: string
  }>
  permissions?: Array<{
    id: string
    type: string // 'user', 'group', 'domain', 'anyone'
    role: string // 'owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'
    emailAddress?: string
    displayName?: string
  }>
  
  // Content
  webViewLink?: string
  webContentLink?: string
  iconLink?: string
  thumbnailLink?: string
  
  // App properties
  appProperties?: Record<string, string>
  properties?: Record<string, string>
  
  // Export links for Google Workspace files
  exportLinks?: Record<string, string>
  
  // Additional metadata
  description?: string
  folderColorRgb?: string
  originalFilename?: string
  fileExtension?: string
  md5Checksum?: string
  sha1Checksum?: string
  sha256Checksum?: string
  headRevisionId?: string
  contentHints?: {
    thumbnail?: {
      image?: string // Base64-encoded image
      mimeType?: string
    }
    indexableText?: string
  }
  
  // Capabilities (what the user can do with the file)
  capabilities?: {
    canEdit?: boolean
    canComment?: boolean
    canShare?: boolean
    canCopy?: boolean
    canReadRevisions?: boolean
    canAddChildren?: boolean
    canDelete?: boolean
    canDownload?: boolean
    canListChildren?: boolean
    canMoveItemIntoTeamDrive?: boolean
    canMoveItemOutOfDrive?: boolean
    canReadDrive?: boolean
    canRemoveChildren?: boolean
    canRename?: boolean
    canTrash?: boolean
    canUntrash?: boolean
  }
}

/**
 * Response from files.list API
 * @see https://developers.google.com/drive/api/v3/reference/files/list
 */
export interface GoogleDriveFilesListResponse {
  kind: 'drive#fileList'
  nextPageToken?: string
  incompleteSearch?: boolean
  files: GoogleDriveFile[]
}

/**
 * Parameters for files.list API
 * @see https://developers.google.com/drive/api/v3/reference/files/list
 */
export interface GoogleDriveFilesListParams {
  // Query parameters
  q?: string // Search query - see https://developers.google.com/drive/api/guides/search-files
  pageSize?: number // 1-1000, default 100
  pageToken?: string
  fields?: string // Partial response fields
  orderBy?: string // Sort order
  
  // Filtering
  corpora?: string // 'user', 'domain', 'drive', 'allDrives'
  driveId?: string
  includeItemsFromAllDrives?: boolean
  includePermissionsForView?: string
  includeLabels?: string
  spaces?: string // 'drive', 'appDataFolder', 'photos'
  supportsAllDrives?: boolean
}

/**
 * Parameters for files.get API
 * @see https://developers.google.com/drive/api/v3/reference/files/get
 */
export interface GoogleDriveFilesGetParams {
  fileId: string
  fields?: string // Partial response fields
  acknowledgeAbuse?: boolean
  includePermissionsForView?: string
  includeLabels?: string
  supportsAllDrives?: boolean
}

/**
 * Parameters for files.update API
 * @see https://developers.google.com/drive/api/v3/reference/files/update
 */
export interface GoogleDriveFilesUpdateParams {
  fileId: string
  
  // Request body - partial file metadata
  requestBody?: Partial<GoogleDriveFile>
  
  // Query parameters
  addParents?: string // Comma-separated list of parent IDs to add
  removeParents?: string // Comma-separated list of parent IDs to remove
  fields?: string
  includePermissionsForView?: string
  includeLabels?: string
  keepRevisionForever?: boolean
  ocrLanguage?: string
  supportsAllDrives?: boolean
  useContentAsIndexableText?: boolean
}

/**
 * Parameters for files.create API
 * @see https://developers.google.com/drive/api/v3/reference/files/create
 */
export interface GoogleDriveFilesCreateParams {
  // Request body - file metadata
  requestBody: {
    name: string
    mimeType?: string
    parents?: string[]
    description?: string
    starred?: boolean
    properties?: Record<string, string>
    appProperties?: Record<string, string>
    folderColorRgb?: string
  }
  
  // Query parameters
  fields?: string
  ignoreDefaultVisibility?: boolean
  includePermissionsForView?: string
  includeLabels?: string
  keepRevisionForever?: boolean
  ocrLanguage?: string
  supportsAllDrives?: boolean
  useContentAsIndexableText?: boolean
}

/**
 * Parameters for files.delete API
 * @see https://developers.google.com/drive/api/v3/reference/files/delete
 */
export interface GoogleDriveFilesDeleteParams {
  fileId: string
  supportsAllDrives?: boolean
}

/**
 * Parameters for files.export API (for Google Workspace files)
 * @see https://developers.google.com/drive/api/v3/reference/files/export
 */
export interface GoogleDriveFilesExportParams {
  fileId: string
  mimeType: string // Target MIME type for export
}

/**
 * Common MIME types for Google Workspace and regular files
 */
export const GOOGLE_DRIVE_MIME_TYPES = {
  // Google Workspace types
  FOLDER: 'application/vnd.google-apps.folder',
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  DRAWING: 'application/vnd.google-apps.drawing',
  FORM: 'application/vnd.google-apps.form',
  SCRIPT: 'application/vnd.google-apps.script',
  SITE: 'application/vnd.google-apps.site',
  
  // Export formats for Google Workspace files
  EXPORT_PDF: 'application/pdf',
  EXPORT_DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  EXPORT_XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  EXPORT_PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  EXPORT_TXT: 'text/plain',
  EXPORT_HTML: 'text/html',
  EXPORT_CSV: 'text/csv',
  EXPORT_TSV: 'text/tab-separated-values',
  EXPORT_JPEG: 'image/jpeg',
  EXPORT_PNG: 'image/png',
  EXPORT_SVG: 'image/svg+xml',
  
  // Common file types
  PDF: 'application/pdf',
  TEXT: 'text/plain',
  CSV: 'text/csv',
  JSON: 'application/json',
  XML: 'application/xml',
  ZIP: 'application/zip',
  
  // Image types
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  WEBP: 'image/webp',
  
  // Document types
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const

/**
 * Export format mappings for Google Workspace files
 */
export const GOOGLE_WORKSPACE_EXPORT_FORMATS: Record<string, string[]> = {
  [GOOGLE_DRIVE_MIME_TYPES.DOCUMENT]: [
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PDF,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_DOCX,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_TXT,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_HTML,
  ],
  [GOOGLE_DRIVE_MIME_TYPES.SPREADSHEET]: [
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PDF,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_XLSX,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_CSV,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_TSV,
  ],
  [GOOGLE_DRIVE_MIME_TYPES.PRESENTATION]: [
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PDF,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PPTX,
  ],
  [GOOGLE_DRIVE_MIME_TYPES.DRAWING]: [
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PDF,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_JPEG,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_PNG,
    GOOGLE_DRIVE_MIME_TYPES.EXPORT_SVG,
  ],
}