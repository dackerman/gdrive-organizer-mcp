# Test Folder Setup Guide

To run integration tests, you need to set up a specific folder structure in your test Google Drive account.

## Required Folder Structure

Create the following structure in your Google Drive:

```
📁 GDrive-Test-Suite/
├── 📁 FolderA/
│   ├── 📄 test-file-1.txt
│   ├── 📄 test-doc-1.gdoc (Google Doc)
│   └── 📄 test-sheet-1.gsheet (Google Sheet)
├── 📁 FolderB/
│   └── (empty - for move operations)
├── 📁 TestOperations/
│   ├── 📄 file_a.txt (for rename tests)
│   ├── 📄 move_me.txt (for move tests)
│   └── 📁 folder_a/ (for folder rename tests)
└── 📄 README.txt (with some content to read)
```

## How to Create Test Structure

### 1. Create Main Test Folder
- Go to Google Drive
- Create a new folder named `GDrive-Test-Suite`
- Note the folder ID from the URL (you'll need this)

### 2. Create Subfolders
- Inside `GDrive-Test-Suite`, create:
  - `FolderA`
  - `FolderB` 
  - `TestOperations`

### 3. Create Test Files

#### In FolderA:
- Upload a text file named `test-file-1.txt` (any content)
- Create a Google Doc named `test-doc-1`
- Create a Google Sheet named `test-sheet-1`

#### In TestOperations:
- Upload a text file named `file_a.txt`
- Upload a text file named `move_me.txt`
- Create a folder named `folder_a`

#### In Root (GDrive-Test-Suite):
- Upload a text file named `README.txt` with content like:
  ```
  This is a test file for the GDrive Organizer integration tests.
  It contains some sample content that can be read by the tests.
  ```

## Update test-credentials.json

Add the test folder ID to your credentials file:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "user_email": "test@gmail.com",
  "generated_at": "2025-01-25T10:00:00Z",
  "test_folder_id": "YOUR_GDRIVE_TEST_SUITE_FOLDER_ID_HERE",
  "scopes": [...]
}
```

## Test Behavior

The tests are designed to be idempotent (can run multiple times):

- **Move operations**: Toggle between FolderA ↔ FolderB
- **Rename operations**: Toggle between `file_a` ↔ `file_b`, `folder_a` ↔ `folder_b`
- **Read operations**: Just verify data is returned with correct structure
- **Search operations**: Look for files we know exist

## Tips

1. Use a dedicated test account, not your personal account
2. The folder structure only needs to be created once
3. Tests will move files around but always restore them
4. If tests fail mid-way, manually restore files to original locations

## Quick Verification

Run this checklist before running tests:
- [ ] `GDrive-Test-Suite` folder exists
- [ ] `FolderA` contains at least 3 files
- [ ] `FolderB` exists (can be empty)
- [ ] `TestOperations` contains required test files
- [ ] `README.txt` exists in root with readable content
- [ ] Folder ID is added to `test-credentials.json`