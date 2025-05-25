# Google Drive Organizer MCP Server Specification

## Project Overview

Build a remote Model Context Protocol (MCP) server that enables AI assistants (like Claude) to intelligently organize Google Drive files through conversational interaction. The server provides both read and write operations, with a focus on safe, plan-based execution of file organization tasks.

## Key Design Principles

1. **Conversational AI-First**: Designed for back-and-forth conversation with Claude Desktop
2. **Plan-Based Execution**: Operations are grouped into logical plans that can be reviewed before execution
3. **Async Operations**: Large reorganization tasks run asynchronously to avoid timeouts
4. **Resumable**: Partial completion is acceptable; AI can reassess and continue
5. **Auditable**: Complete history logged to Google Drive for user reference
6. **Safe**: Single active operation at a time, clear error messages

## Architecture

- **Base**: Cloudflare Workers with Google OAuth (using existing template)
- **Authentication**: Google OAuth 2.0 with Drive API access
- **Protocol**: Remote MCP server (not local)
- **Required Scopes**: 
  - `https://www.googleapis.com/auth/drive`
  - `https://www.googleapis.com/auth/drive.file`

## Core MCP Tools

### 1. File System Operations

#### `list_directory`
Lists files and folders in a specified directory.

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
    id: string,
    name: string,
    mimeType: string,
    size?: number,        // bytes (not available for folders)
    createdTime: string,  // ISO timestamp
    modifiedTime: string,
    parents: string[],    // parent folder IDs
    path: string,         // human-readable path like "/Documents/Work"
    isFolder: boolean,
    isShared: boolean,
    sharingStatus: 'private' | 'shared' | 'public',
    folderDepth: number   // how nested (0 = root)
  }>
}
```

#### `read_file`
Reads file content with optional pagination for large files.

**Parameters:**
```typescript
{
  fileId: string,
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
Search for files across Google Drive.

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

### 2. Organization Operations

#### `create_folder`
Creates a new folder.

**Parameters:**
```typescript
{
  name: string,
  parentId: string,      // parent folder ID
  parentPath: string     // human-readable parent path for logging
}
```

**Returns:**
```typescript
{
  folderId: string,
  path: string          // full path of created folder
}
```

### 3. Plan-Based Execution

#### `execute_plan`
Executes a pre-defined organization plan asynchronously.

**Parameters:**
```typescript
{
  planName: string,           // "Consolidate scattered notes"
  planDescription: string,    // "Moving 23 files from 4 folders into Documents/Notes/"
  operations: Operation[]
}

interface Operation {
  type: 'move_file' | 'move_folder' | 'create_folder' | 'rename_file' | 'rename_folder',
  sourceId?: string,          // Google Drive file/folder ID (not needed for create_folder)
  sourcePath: string,         // Human-readable current path
  destinationParentId?: string, // Where it's moving to
  destinationPath: string,    // Human-readable destination
  newName?: string,           // For renames
  reason: string             // "Groups tax documents by year"
}
```

**Returns:**
```typescript
{
  success: boolean,
  message: string,      // "Started executing plan: Consolidate scattered notes"
  estimatedDuration?: string // "~2 minutes, 47 operations"
}
```

**Error Response (if operation already running):**
```typescript
{
  error: "Operation already in progress",
  currentOperation: {
    planName: string,
    progress: string    // "12/23 operations completed"
  }
}
```

#### `get_operation_status`
Checks the status of the currently running operation.

**Parameters:** None

**Returns:**
```typescript
{
  isRunning: boolean,
  planName?: string,
  planDescription?: string,
  progress?: {
    completed: number,
    total: number,
    currentOperation?: string,  // "Creating folder Documents/Notes/"
    lastActivity: string,       // ISO timestamp
    estimatedTimeRemaining?: string
  }
}
```

#### `cancel_operation`
Cancels the currently running operation.

**Parameters:** None

**Returns:**
```typescript
{
  success: boolean,
  message: string,      // "Operation cancelled. 12 of 23 operations completed."
  partialResults?: {
    completed: number,
    total: number
  }
}
```

## Data Structures

### Operation Types
- `move_file`: Move a file to a different folder
- `move_folder`: Move an entire folder and its contents
- `create_folder`: Create a new empty folder
- `rename_file`: Rename a file (keeping same location)
- `rename_folder`: Rename a folder (keeping same location)

### File Paths
Always provide human-readable paths like `/Documents/Work/Projects` alongside Google Drive IDs for better user experience and logging.

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
{"timestamp": "2025-01-15T14:32:00Z", "type": "operation_cancelled", "planName": "Clean downloads", "completedOperations": 5, "totalOperations": 15}
```

### Log Entry Types
- `plan_started`: New plan execution began
- `operation_completed`: Individual operation succeeded
- `operation_failed`: Individual operation failed
- `operation_skipped`: Operation skipped due to conflict
- `plan_completed`: Plan finished (success or partial)
- `operation_cancelled`: Plan was cancelled by user

## Usage Workflow

1. **Exploration Phase**: Claude uses `list_directory`, `search_files`, and `read_file` to understand the current file structure
2. **Plan Generation**: Claude analyzes the structure and proposes an organization plan
3. **User Review**: Plan is presented to user with clear summary of changes
4. **Execution**: User approves, Claude calls `execute_plan`
5. **Monitoring**: Claude can check `get_operation_status` periodically and continue conversation
6. **Continuation**: If operation completes partially, Claude can reassess and create a new plan for remaining work

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