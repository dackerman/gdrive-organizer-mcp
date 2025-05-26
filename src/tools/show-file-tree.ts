import { z } from 'zod'
import { DriveService } from '../types/drive'

// Define the schema for show_file_tree parameters
export const showFileTreeSchema = z.object({
  rootPath: z.string().optional().default('/'),
  maxDepth: z.number().min(1).max(20).optional().default(10),
  maxFiles: z.number().min(1).max(1000).optional().default(500)
})

// Type inference from the schema
export type ShowFileTreeParams = z.infer<typeof showFileTreeSchema>

// Factory function to create the tool with injected dependencies
export function createShowFileTreeTool(driveService: DriveService) {
  // The actual handler function
  async function showFileTree(params: ShowFileTreeParams) {
    console.log('[showFileTree tool] Called with params:', params)
    
    try {
      const files = await driveService.buildFileTree(params.rootPath, params.maxDepth)
      
      console.log('[showFileTree tool] Found files:', {
        count: files.length,
        rootPath: params.rootPath,
        maxDepth: params.maxDepth
      })

      // Limit the number of files shown to avoid overwhelming output
      const limitedFiles = files.slice(0, params.maxFiles)
      const wasTruncated = files.length > params.maxFiles

      // Format the response with a nice tree-like structure
      const formattedTree = formatFileTree(limitedFiles, wasTruncated, files.length)

      // Format response according to MCP spec
      return {
        content: [
          {
            type: 'text' as const,
            text: formattedTree
          }
        ]
      }
    } catch (error) {
      console.error('[showFileTree tool] Error:', error)
      throw error
    }
  }

  // Return the tool definition
  return {
    name: 'show_file_tree',
    description: 'Shows a tree of all file paths starting from a given root path',
    schema: showFileTreeSchema.shape,
    handler: showFileTree
  }
}

/**
 * Format file paths into a nice tree structure
 */
function formatFileTree(files: string[], wasTruncated: boolean, totalCount: number): string {
  if (files.length === 0) {
    return 'No files found.'
  }

  const lines: string[] = []
  lines.push('📄 File Tree:')
  lines.push('')

  // Group files by directory for better organization
  const filesByDir = new Map<string, string[]>()
  
  for (const filePath of files) {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/'
    if (!filesByDir.has(dirPath)) {
      filesByDir.set(dirPath, [])
    }
    filesByDir.get(dirPath)!.push(filePath)
  }

  // Sort directories
  const sortedDirs = Array.from(filesByDir.keys()).sort()

  for (const dirPath of sortedDirs) {
    const dirFiles = filesByDir.get(dirPath)!.sort()
    
    // Show directory header
    const depth = dirPath === '/' ? 0 : dirPath.split('/').length - 1
    const indent = '  '.repeat(depth)
    const dirName = dirPath === '/' ? 'My Drive (root)' : dirPath.split('/').pop()
    
    lines.push(`${indent}📁 ${dirName}/`)
    
    // Show files in this directory
    for (const filePath of dirFiles) {
      const fileName = filePath.split('/').pop()
      const fileIndent = '  '.repeat(depth + 1)
      const fileIcon = getFileIcon(fileName || '')
      lines.push(`${fileIndent}${fileIcon} ${fileName}`)
    }
    
    if (dirFiles.length > 0) {
      lines.push('') // Add spacing between directories
    }
  }

  // Add summary
  lines.push(`Total files shown: ${files.length}`)
  if (wasTruncated) {
    lines.push(`(Showing first ${files.length} of ${totalCount} files)`)
    lines.push('Use a more specific rootPath or increase maxFiles to see more.')
  }

  return lines.join('\n')
}

/**
 * Get appropriate icon for file based on extension
 */
function getFileIcon(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  
  // Document types
  if (['doc', 'docx', 'gdoc'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'gsheet'].includes(ext)) return '📊'
  if (['ppt', 'pptx', 'gslides'].includes(ext)) return '📺'
  if (['pdf'].includes(ext)) return '📋'
  
  // Code types
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return '🟨'
  if (['py'].includes(ext)) return '🐍'
  if (['java'].includes(ext)) return '☕'
  if (['html', 'htm'].includes(ext)) return '🌐'
  if (['css'].includes(ext)) return '🎨'
  if (['json'].includes(ext)) return '📋'
  
  // Media types  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return '🖼️'
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return '🎥'
  if (['mp3', 'wav', 'flac'].includes(ext)) return '🎵'
  
  // Archive types
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️'
  
  // Text types
  if (['txt', 'md', 'readme'].includes(ext)) return '📄'
  
  // Default
  return '📄'
}