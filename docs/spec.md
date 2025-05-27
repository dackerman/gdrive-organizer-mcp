# Google Drive Organizer MCP Server Specification

## Project Overview

Build a remote Model Context Protocol (MCP) server that enables AI assistants (like Claude) to intelligently organize Google Drive files through conversational interaction. The server provides both read and write operations, with a focus on safe, plan-based execution of file organization tasks.

## Key Design Principles

1. **Conversational AI-First**: Designed for back-and-forth conversation with Claude Desktop
2. **Path-Based Operations**: Uses human-readable file paths instead of Google Drive IDs
3. **Synchronous Operations**: All operations complete before returning
4. **Tree Navigation**: Provides tools to explore directory and file structures
5. **Simple Move Operations**: Move/rename operations using intuitive from/to paths
6. **Safe**: Clear error messages and validation

## Architecture

- **Base**: Cloudflare Workers with Google OAuth (using existing template)
- **Authentication**: Google OAuth 2.0 with Drive API access
- **Protocol**: Remote MCP server (not local)
- **Required Scopes**:
  - `https://www.googleapis.com/auth/drive`
  - `https://www.googleapis.com/auth/drive.file`

## Core MCP Tools

### 1. File System Exploration

#### `show_directory_tree`

Shows a tree of all directory paths starting from a given root.

**Parameters:**

```typescript
{
  rootPath?: string,     // Starting path (default: "/")
  maxDepth?: number      // Maximum depth to traverse (default: 10)
}
```

**Returns:**
Tree-formatted text showing all directory paths with visual hierarchy.

#### `show_file_tree`

Shows a tree of all file paths starting from a given root.

**Parameters:**

```typescript
{
  rootPath?: string,     // Starting path (default: "/")
  maxDepth?: number,     // Maximum depth to traverse (default: 10)
  maxFiles?: number      // Maximum files to show (default: 500)
}
```

**Returns:**
Tree-formatted text showing all file paths with icons and directory structure.

#### `list_directory`

Lists files and folders in a specified directory (legacy - uses folder IDs).

**Parameters:**

```typescript
{
  folderId?: string,     // Google Drive folder ID (root if omitted)
  includeShared?: boolean, // Include shared files (default: true)
  maxResults?: number    // Limit results (default: 100)
}
```

**Returns:**

```typescript
{
  files: Array<{
    id: string
    name: string
    mimeType: string
    size?: number // bytes (not available for folders)
    createdTime: string // ISO timestamp
    modifiedTime: string
    parents: string[] // parent folder IDs
    path: string // human-readable path like "/Documents/Work"
    isFolder: boolean
    isShared: boolean
    sharingStatus: 'private' | 'shared' | 'public'
    folderDepth: number // how nested (0 = root)
  }>
}
```

### 2. File Operations

#### `read_file`

Reads file content using file path.

**Parameters:**

```typescript
{
  filePath: string,      // Full path like "/Documents/report.txt"
  maxSize?: number,      // max bytes to return (default: 1MB)
  startOffset?: number,  // for pagination
  endOffset?: number
}
```

**Returns:**

```typescript
{
  content: string,
  mimeType: string,
  size: number,
  truncated: boolean,    // true if maxSize limit hit
  encoding: string       // 'utf-8', 'base64', etc.
}
```

#### `search_files`

Search for files across Google Drive (legacy - uses folder IDs).

**Parameters:**

```typescript
{
  query: string,         // search terms
  folderId?: string,     // limit search to specific folder
  mimeType?: string,     // filter by file type
  namePattern?: string,  // regex pattern for filename
  maxResults?: number    // default: 50
}
```

**Returns:** Same format as `list_directory`

### 3. Move Operations

#### `move_files`

Moves or renames files and folders using simple from/to path operations.

**Parameters:**

```typescript
{
  operations: Array<{
    from: string // Source path like "/Documents/old_file.txt"
    to: string // Destination path like "/Projects/new_file.txt"
  }>
}
```

**Examples:**

```typescript
// Move a file to different folder
{ from: "/Documents/report.pdf", to: "/Projects/report.pdf" }

// Rename a file (same folder)
{ from: "/Documents/draft.txt", to: "/Documents/final.txt" }

// Move and rename
{ from: "/Downloads/temp.xlsx", to: "/Work/budget_2024.xlsx" }

// Move a folder
{ from: "/Old Projects", to: "/Archive/Old Projects" }
```

**Returns:**

```typescript
{
  success: boolean,
  message: string,
  summary: {
    totalOperations: number,
    successfulOperations: number,
    failedOperations: number,
    duration: string
  },
  results: Array<{
    operation: { from: string, to: string },
    success: boolean,
    error?: string
  }>
}
```

## Data Structures

### Path Format

All paths use Unix-style forward slashes starting from the Google Drive root:

- Root: `/`
- File: `/Documents/report.pdf`
- Nested folder: `/Projects/2024/Budget/`
- Folder in root: `/Archives`

### Move Operations

Simple from/to path pairs that handle both moves and renames:

- **Move**: Different parent directories (`/Downloads/file.txt` → `/Documents/file.txt`)
- **Rename**: Same parent directory (`/Documents/draft.txt` → `/Documents/final.txt`)
- **Move + Rename**: Different parent + different name (`/Downloads/temp.xlsx` → `/Work/budget.xlsx`)

### File Discovery

Tree tools provide comprehensive views:

- `show_directory_tree`: All folder paths for navigation
- `show_file_tree`: All file paths with visual icons and structure

## Implementation Details

### Operation Execution

- Execute operations sequentially to avoid conflicts
- For each operation, verify source still exists before attempting
- Log each completed operation immediately
- If an operation fails, log the failure but continue with remaining operations
- Update progress after each operation

### Error Handling

- **File not found**: Skip operation, log warning, continue
- **Permission denied**: Skip operation, log error, continue
- **Network timeout**: Retry up to 3 times, then fail operation
- **Rate limiting**: Implement exponential backoff

### Google Drive API Considerations

- Use batch requests where possible to improve performance
- Respect rate limits (1000 requests per 100 seconds per user)
- Handle partial failures in batch operations gracefully

## History and Audit Trail

### Log File Location

Create and maintain `/Drive Organizer History.jsonl` in the root of the user's Google Drive.

### Log Entry Format

Each line is a JSON object:

```json
{"timestamp": "2025-01-15T14:30:52Z", "type": "plan_started", "planName": "Consolidate notes", "planDescription": "Moving 23 files...", "totalOperations": 23}
{"timestamp": "2025-01-15T14:30:53Z", "type": "operation_completed", "operationType": "move_file", "fileName": "ideas.txt", "fromPath": "/Random/ideas.txt", "toPath": "/Documents/Notes/ideas.txt", "reason": "Groups scattered notes"}
{"timestamp": "2025-01-15T14:30:54Z", "type": "operation_failed", "operationType": "move_file", "fileName": "missing.txt", "error": "File not found", "reason": "File may have been deleted"}
{"timestamp": "2025-01-15T14:31:45Z", "type": "plan_completed", "planName": "Consolidate notes", "completedOperations": 21, "failedOperations": 2, "duration": "53s"}
```

### Log Entry Types

- `plan_started`: New plan execution began
- `operation_completed`: Individual operation succeeded
- `operation_failed`: Individual operation failed
- `operation_skipped`: Operation skipped due to conflict
- `plan_completed`: Plan finished (success or partial)

## Usage Workflow

1. **Discovery Phase**: Claude uses `show_directory_tree` and `show_file_tree` to understand the overall structure
2. **Detailed Exploration**: Claude uses `read_file` to examine specific files if needed
3. **Organization Planning**: Claude analyzes the structure and proposes move operations using human-readable paths
4. **User Review**: Plan is presented to user with clear from/to paths that are easy to understand
5. **Execution**: User approves, Claude calls `move_files` with the path-based operations
6. **Results Review**: Claude receives complete results including any failures
7. **Continuation**: If operations failed or more work is needed, Claude can create additional move operations

## Technical Requirements

### Google Drive API Setup

- Enable Google Drive API in Google Cloud Console
- Set up OAuth 2.0 credentials for web application
- Configure authorized redirect URIs for Cloudflare Workers domain

### Required Dependencies

- Google APIs Client Library
- OAuth 2.0 handling
- JSON Lines (JSONL) parsing/writing for log files

### Rate Limiting and Performance

- Implement request batching for multiple file operations
- Add retry logic with exponential backoff
- Monitor quota usage and provide warnings

### Security Considerations

- Validate all file paths and IDs before operations
- Ensure operations don't escape user's Drive scope
- Never expose raw Google API credentials
- Log security-relevant events (permission changes, etc.)

## Testing Strategy

### Unit Tests

- Individual tool functions
- Operation validation logic
- Error handling scenarios

### Integration Tests

- End-to-end plan execution
- Google Drive API integration
- Authentication flow

### Test Data

- Create test Drive folder structure
- Test with various file types and sizes
- Test edge cases (deeply nested folders, special characters in names)

## Future Enhancements

### Phase 2 Features

- Duplicate file detection and removal
- Smart naming convention enforcement
- Photo organization by date/metadata
- Integration with Google Photos for media files

### Performance Optimizations

- Parallel operation execution (where safe)
- Caching of folder structures
- Incremental organization updates

This specification provides the foundation for building a robust, conversational Google Drive organization tool that integrates seamlessly with Claude Desktop through the Model Context Protocol.
