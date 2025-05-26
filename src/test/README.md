# Google Drive Integration Tests

This directory contains integration tests that verify our Google Drive API implementation works correctly with real API calls.

## Test Philosophy

These tests work with **pre-existing files and folders** in a test Google Drive account. Tests are designed to be:
- **Idempotent**: Can run multiple times without manual reset
- **Toggle-style**: Operations work in both directions (e.g., move A→B or B→A)
- **Lenient**: Assert general correctness rather than exact values

## Why Integration Tests?

The Google Drive API is complex and has many edge cases:
- Different behavior for files vs folders
- Special handling for Google Workspace files (Docs, Sheets, etc.)
- Complex permission and sharing models
- Rate limiting and error responses

Unit tests with mocks can't catch all these issues. Integration tests ensure our code actually works with the real API.

## Setup

### 1. Get a Test Google Account

Use a dedicated test account, not your personal Google account. The tests will modify real files/folders.

### 2. Set Up Test Folder Structure

Follow the instructions in `TEST_FOLDER_SETUP.md` to create the required folder structure in your test Google Drive.

### 3. Obtain OAuth Credentials

Follow the instructions in `scripts/setup-test-token-manual.md` to get OAuth credentials.

Quick version:
1. Go to https://developers.google.com/oauthplayground/
2. Click the gear icon (⚙️) and check "Use your own OAuth credentials"
3. Enter your OAuth client ID and secret
4. Select Drive scopes (full access + file access)
5. Authorize with your test account
6. Exchange the code for tokens
7. Copy both the access token and refresh token

### 4. Create test-credentials.json

Create this file in the project root (see `test-credentials.json.example`):

```json
{
  "access_token": "ya29.a0AfH6SMB...",
  "refresh_token": "1//04dX...",
  "client_id": "your-client-id.apps.googleusercontent.com",
  "client_secret": "your-client-secret",
  "token_type": "Bearer", 
  "user_email": "your-test@gmail.com",
  "generated_at": "2025-01-25T10:00:00Z",
  "test_folder_id": "YOUR_GDRIVE_TEST_SUITE_FOLDER_ID",
  "scopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

### 5. Verify .gitignore

Make sure `test-credentials.json` is in `.gitignore` - it should never be committed!

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration google-drive.integration.test.ts

# Run with verbose output
npm run test:integration -- --reporter=verbose
```

## Test Structure

### Practical Integration Tests (`google-drive-practical.integration.test.ts`)
- Works with pre-existing test folder structure
- Idempotent tests that can run multiple times
- Toggle-style operations (move A↔B, rename a↔b)
- Lenient assertions focusing on correctness

### Legacy Test Files (for reference)
- `google-drive.integration.test.ts` - Original approach
- `google-drive-write-ops.integration.test.ts` - Creates test data
- `google-drive-file-ops.integration.test.ts` - Documents missing features

## Cleanup

The practical tests are designed to minimize cleanup needs:
- Toggle operations restore files to original locations
- Only the create folder test leaves behind new folders

**Occasional cleanup:**
1. Look for folders named `test-create-*` in TestOperations folder
2. Delete old test folders if they accumulate
3. Restore any files that got stuck in wrong locations due to test failures

## Known Limitations

1. **No file creation**: We can't test file operations (move, rename) because we can't create test files
2. **No delete operations**: Can't automatically clean up test data
3. **Rate limits**: Tests run sequentially to avoid hitting API rate limits

## Adding New Tests

1. Create test files following the pattern: `*.integration.test.ts`
2. Use the test setup from `integration-setup.ts`
3. Track created resources for cleanup documentation
4. Add descriptive console logs - these tests are meant to be informative

## CI/CD Considerations

For CI/CD, consider:
1. Using a service account instead of OAuth tokens
2. Creating a dedicated test Drive folder that gets cleaned periodically
3. Running integration tests on a schedule, not every commit
4. Setting up proper test data isolation

## Troubleshooting

### "Invalid Credentials" Error
- Check that your OAuth client ID and secret are correct
- Verify the refresh token is valid
- Try regenerating tokens if needed

### "Not Found" Errors  
- Check the test account has access to the resources
- Verify folder IDs are correct

### Rate Limiting
- Tests run sequentially to avoid this
- If you still hit limits, add delays between operations

### Manual Cleanup Burden
- Until we add delete operations, you must manually clean test data
- Search Drive for folders starting with `test-` 
- Consider using a dedicated test account you can periodically wipe