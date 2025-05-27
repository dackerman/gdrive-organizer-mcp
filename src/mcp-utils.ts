/**
 * Utilities for MCP (Model Context Protocol) formatting
 */

import { DriveFile } from './types/drive'

/**
 * MCP content item type
 */
export interface MCPContentItem {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

/**
 * MCP response format
 */
export interface MCPResponse {
  content: MCPContentItem[]
}

/**
 * Creates an MCP response with text content
 */
export function createMCPTextResponse(data: any) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  }
}

/**
 * Maps DriveFile fields to a clean object based on requested fields
 */
export function mapDriveFileFields(file: DriveFile, requestedFields?: string[]): Record<string, any> {
  // If no specific fields requested, return essential fields
  if (!requestedFields || requestedFields.length === 0) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      parents: file.parents,
      size: file.size,
      modifiedTime: file.modifiedTime,
      createdTime: file.createdTime,
      path: file.path,
      isFolder: file.isFolder,
      isShared: file.isShared,
      sharingStatus: file.sharingStatus,
      folderDepth: file.folderDepth
    }
  }

  // Map requested fields from DriveFile
  const result: Record<string, any> = {}
  
  requestedFields.forEach(field => {
    if (field in file) {
      result[field] = file[field as keyof DriveFile]
    }
  })
  
  return result
}

/**
 * Creates an error MCP response
 */
export function createMCPErrorResponse(error: Error | string): MCPResponse {
  const errorMessage = error instanceof Error ? error.message : error
  return createMCPTextResponse({
    error: errorMessage,
    success: false
  })
}

/**
 * Creates a success MCP response with optional data
 */
export function createMCPSuccessResponse(data: any, message?: string): MCPResponse {
  const response: any = {
    success: true,
    ...data
  }
  
  if (message) {
    response.message = message
  }
  
  return createMCPTextResponse(response)
}