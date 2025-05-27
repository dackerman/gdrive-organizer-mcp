import {
  GoogleDriveFile,
  GoogleDriveFilesListParams,
  GoogleDriveFilesListResponse,
  GoogleDriveFilesGetParams,
  GoogleDriveFilesUpdateParams,
  GoogleDriveFilesCreateParams,
  GoogleDriveFilesDeleteParams,
  GoogleDriveFilesExportParams,
} from '../types/google-drive-api'

/**
 * Google Drive API v3 Client
 * A thin wrapper around the Google Drive REST API that closely matches the API structure
 * 
 * @see https://developers.google.com/drive/api/v3/reference
 */
export class GoogleDriveApiClient {
  private static readonly API_BASE = 'https://www.googleapis.com/drive/v3'
  private accessToken: string
  private refreshToken?: string
  private clientId?: string
  private clientSecret?: string
  private tokenExpiresAt?: number // Unix timestamp when the token expires

  constructor(
    accessToken: string,
    refreshToken?: string,
    clientId?: string,
    clientSecret?: string
  ) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.clientId = clientId
    this.clientSecret = clientSecret
    
    // Assume token is valid for 1 hour if not specified
    this.tokenExpiresAt = Date.now() + (3600 * 1000)
  }

  /**
   * Makes an authenticated request to the Google Drive API
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Check if token is expired or will expire in the next 5 minutes
    const now = Date.now()
    const fiveMinutesFromNow = now + (5 * 60 * 1000)
    
    if (!this.accessToken || 
        this.accessToken.trim() === '' || 
        (this.tokenExpiresAt && this.tokenExpiresAt < fiveMinutesFromNow)) {
      console.log('[GoogleDriveApiClient] Token expired or expiring soon, refreshing...')
      await this.refreshAccessToken()
    }

    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${GoogleDriveApiClient.API_BASE}${endpoint}`

    const makeRequestWithToken = async (token: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })
    }

    // Try with current token
    let response = await makeRequestWithToken(this.accessToken)

    // If unauthorized, try refreshing token once
    if (response.status === 401 && this.refreshToken) {
      console.log('[GoogleDriveApiClient] Got 401, attempting token refresh...')
      await this.refreshAccessToken()
      response = await makeRequestWithToken(this.accessToken)
    }

    return response
  }

  /**
   * Refreshes the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Cannot refresh token: missing refresh token or client credentials')
    }

    console.log('[GoogleDriveApiClient] Refreshing access token...')
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`)
    }

    const data = await response.json() as { access_token: string; expires_in?: number }
    this.accessToken = data.access_token
    
    // Update token expiration time
    if (data.expires_in) {
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)
    } else {
      // Default to 1 hour if not specified
      this.tokenExpiresAt = Date.now() + (3600 * 1000)
    }
    
    console.log('[GoogleDriveApiClient] Token refreshed successfully, expires at:', new Date(this.tokenExpiresAt))
  }

  /**
   * Lists files and folders
   * @see https://developers.google.com/drive/api/v3/reference/files/list
   */
  async filesList(params: GoogleDriveFilesListParams = {}): Promise<GoogleDriveFilesListResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.q) searchParams.append('q', params.q)
    if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    if (params.pageToken) searchParams.append('pageToken', params.pageToken)
    if (params.fields) searchParams.append('fields', params.fields)
    if (params.orderBy) searchParams.append('orderBy', params.orderBy)
    if (params.corpora) searchParams.append('corpora', params.corpora)
    if (params.driveId) searchParams.append('driveId', params.driveId)
    if (params.includeItemsFromAllDrives !== undefined) {
      searchParams.append('includeItemsFromAllDrives', params.includeItemsFromAllDrives.toString())
    }
    if (params.includePermissionsForView) {
      searchParams.append('includePermissionsForView', params.includePermissionsForView)
    }
    if (params.includeLabels) searchParams.append('includeLabels', params.includeLabels)
    if (params.spaces) searchParams.append('spaces', params.spaces)
    if (params.supportsAllDrives !== undefined) {
      searchParams.append('supportsAllDrives', params.supportsAllDrives.toString())
    }

    const response = await this.makeRequest(`/files?${searchParams.toString()}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to list files: ${response.status} ${errorText}`)
    }

    return await response.json() as GoogleDriveFilesListResponse
  }

  /**
   * Gets a file's metadata
   * @see https://developers.google.com/drive/api/v3/reference/files/get
   */
  async filesGet(params: GoogleDriveFilesGetParams): Promise<GoogleDriveFile> {
    const searchParams = new URLSearchParams()
    
    if (params.fields) searchParams.append('fields', params.fields)
    if (params.acknowledgeAbuse !== undefined) {
      searchParams.append('acknowledgeAbuse', params.acknowledgeAbuse.toString())
    }
    if (params.includePermissionsForView) {
      searchParams.append('includePermissionsForView', params.includePermissionsForView)
    }
    if (params.includeLabels) searchParams.append('includeLabels', params.includeLabels)
    if (params.supportsAllDrives !== undefined) {
      searchParams.append('supportsAllDrives', params.supportsAllDrives.toString())
    }

    const queryString = searchParams.toString()
    const url = `/files/${params.fileId}${queryString ? `?${queryString}` : ''}`
    
    const response = await this.makeRequest(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get file: ${response.status} ${errorText}`)
    }

    return await response.json() as GoogleDriveFile
  }

  /**
   * Updates a file's metadata
   * @see https://developers.google.com/drive/api/v3/reference/files/update
   */
  async filesUpdate(params: GoogleDriveFilesUpdateParams): Promise<GoogleDriveFile> {
    const searchParams = new URLSearchParams()
    
    if (params.addParents) searchParams.append('addParents', params.addParents)
    if (params.removeParents) searchParams.append('removeParents', params.removeParents)
    if (params.fields) searchParams.append('fields', params.fields)
    if (params.includePermissionsForView) {
      searchParams.append('includePermissionsForView', params.includePermissionsForView)
    }
    if (params.includeLabels) searchParams.append('includeLabels', params.includeLabels)
    if (params.keepRevisionForever !== undefined) {
      searchParams.append('keepRevisionForever', params.keepRevisionForever.toString())
    }
    if (params.ocrLanguage) searchParams.append('ocrLanguage', params.ocrLanguage)
    if (params.supportsAllDrives !== undefined) {
      searchParams.append('supportsAllDrives', params.supportsAllDrives.toString())
    }
    if (params.useContentAsIndexableText !== undefined) {
      searchParams.append('useContentAsIndexableText', params.useContentAsIndexableText.toString())
    }

    const queryString = searchParams.toString()
    const url = `/files/${params.fileId}${queryString ? `?${queryString}` : ''}`
    
    const response = await this.makeRequest(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.requestBody || {}),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to update file: ${response.status} ${errorText}`)
    }

    return await response.json() as GoogleDriveFile
  }

  /**
   * Creates a new file or folder
   * @see https://developers.google.com/drive/api/v3/reference/files/create
   */
  async filesCreate(params: GoogleDriveFilesCreateParams): Promise<GoogleDriveFile> {
    const searchParams = new URLSearchParams()
    
    if (params.fields) searchParams.append('fields', params.fields)
    if (params.ignoreDefaultVisibility !== undefined) {
      searchParams.append('ignoreDefaultVisibility', params.ignoreDefaultVisibility.toString())
    }
    if (params.includePermissionsForView) {
      searchParams.append('includePermissionsForView', params.includePermissionsForView)
    }
    if (params.includeLabels) searchParams.append('includeLabels', params.includeLabels)
    if (params.keepRevisionForever !== undefined) {
      searchParams.append('keepRevisionForever', params.keepRevisionForever.toString())
    }
    if (params.ocrLanguage) searchParams.append('ocrLanguage', params.ocrLanguage)
    if (params.supportsAllDrives !== undefined) {
      searchParams.append('supportsAllDrives', params.supportsAllDrives.toString())
    }
    if (params.useContentAsIndexableText !== undefined) {
      searchParams.append('useContentAsIndexableText', params.useContentAsIndexableText.toString())
    }

    const queryString = searchParams.toString()
    const url = `/files${queryString ? `?${queryString}` : ''}`
    
    const response = await this.makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.requestBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create file: ${response.status} ${errorText}`)
    }

    return await response.json() as GoogleDriveFile
  }

  /**
   * Deletes a file
   * @see https://developers.google.com/drive/api/v3/reference/files/delete
   */
  async filesDelete(params: GoogleDriveFilesDeleteParams): Promise<void> {
    const searchParams = new URLSearchParams()
    
    if (params.supportsAllDrives !== undefined) {
      searchParams.append('supportsAllDrives', params.supportsAllDrives.toString())
    }

    const queryString = searchParams.toString()
    const url = `/files/${params.fileId}${queryString ? `?${queryString}` : ''}`
    
    const response = await this.makeRequest(url, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to delete file: ${response.status} ${errorText}`)
    }
  }

  /**
   * Downloads a file's content
   * @see https://developers.google.com/drive/api/v3/reference/files/get
   */
  async filesDownload(fileId: string, options: { alt?: 'media' } = {}): Promise<Response> {
    const searchParams = new URLSearchParams()
    searchParams.append('alt', options.alt || 'media')
    
    const response = await this.makeRequest(`/files/${fileId}?${searchParams.toString()}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to download file: ${response.status} ${errorText}`)
    }

    return response
  }

  /**
   * Exports a Google Workspace file
   * @see https://developers.google.com/drive/api/v3/reference/files/export
   */
  async filesExport(params: GoogleDriveFilesExportParams): Promise<Response> {
    const searchParams = new URLSearchParams()
    searchParams.append('mimeType', params.mimeType)
    
    const response = await this.makeRequest(
      `/files/${params.fileId}/export?${searchParams.toString()}`
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to export file: ${response.status} ${errorText}`)
    }

    return response
  }
}