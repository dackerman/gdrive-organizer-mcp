# Google Drive Integration Tests Setup

## What We've Created

1. **Test Infrastructure**

   - `vitest.config.integration.ts` - Vitest config for integration tests
   - `src/test/integration-setup.ts` - Test setup and credential loading
   - `src/test/test-cleanup.ts` - Utilities for tracking and cleaning test data
   - `test-credentials.json.example` - Example credentials file

2. **Integration Tests**

   - `src/services/__tests__/google-drive-practical.integration.test.ts` - **NEW: Practical tests with pre-existing files**
   - `src/services/__tests__/google-drive.integration.test.ts` - Basic read operations
   - `src/services/__tests__/google-drive-write-ops.integration.test.ts` - Comprehensive write operations
   - `src/services/__tests__/google-drive-file-ops.integration.test.ts` - Documents missing file operations

3. **Documentation**
   - `TEST_FOLDER_SETUP.md` - **NEW: How to set up test folder structure**
   - `scripts/setup-test-token-manual.md` - Instructions for getting OAuth tokens
   - `src/test/README.md` - Complete guide for running integration tests

## Key Findings

### What Works ✅

- Folder operations: create, rename, move
- Search and list operations
- Basic error handling

### What's Missing ❌

- **File creation**: Can't test file operations without ability to create files
- **Delete operations**: Can't clean up test data automatically
- **File upload**: Need to implement file content upload
- **Batch operations**: Google Drive API supports batching for performance

## New Practical Approach

The latest tests (`google-drive-practical.integration.test.ts`) use a smarter approach:

- Work with **pre-existing test files** (no need to create them)
- **Toggle-style operations** that work in both directions
- **Idempotent tests** that can run multiple times
- **Lenient assertions** that verify correctness, not exact values

## To Run Tests

1. **One-time setup**: Create test folder structure (see `TEST_FOLDER_SETUP.md`)
2. Get OAuth token:
   - **Easy way**: Run `npm run test:get-token` (interactive helper)
   - **Manual way**: See `scripts/GET_OAUTH_TOKEN.md` for detailed steps
3. Create `test-credentials.json` with folder ID
4. Run: `npm run test:integration`

## Important Notes

- Tests work with real files but are designed to be repeatable
- Minimal cleanup required (only for created test folders)
- OAuth tokens expire after 1 hour
- Use a dedicated test account, not personal

## Test Coverage

With the practical approach, we can test:

- ✅ List operations with field validation
- ✅ Read file content
- ✅ Search functionality
- ✅ Move files between folders
- ✅ Move folders
- ✅ Rename files and folders
- ✅ Create folders
- ✅ Error handling

## Future Improvements

1. Add file upload capability for more comprehensive file tests
2. Add delete operations for automatic cleanup
3. Consider service accounts for CI/CD integration
4. Add batch API support for better performance
