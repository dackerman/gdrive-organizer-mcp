# Setting Up Test Credentials for Google Drive Integration Tests

This guide explains how to obtain a Google OAuth2 access token for running integration tests.

## Quick Start

For detailed step-by-step instructions with screenshots and troubleshooting, see:
- **[GET_OAUTH_TOKEN.md](GET_OAUTH_TOKEN.md)** - Comprehensive guide
- **Run `node scripts/get-test-credentials.js`** - Interactive helper script

## Prerequisites

1. A test Google account (Gmail)
2. Access to Google OAuth 2.0 Playground

## Steps

### 1. Go to Google OAuth 2.0 Playground

Visit: https://developers.google.com/oauthplayground/

### 2. Select Google Drive Scopes

In Step 1, find and select these scopes:
- `https://www.googleapis.com/auth/drive` (Full Drive access)
- `https://www.googleapis.com/auth/drive.file` (File-level access)
- `https://www.googleapis.com/auth/userinfo.email` (Email access)
- `https://www.googleapis.com/auth/userinfo.profile` (Profile access)

### 3. Authorize APIs

Click "Authorize APIs" and sign in with your test Google account.

### 4. Exchange Authorization Code

Click "Exchange authorization code for tokens" in Step 2.

### 5. Copy the Access Token

Copy the access token from the response.

### 6. Create test-credentials.json

Create a file called `test-credentials.json` in the project root with this structure:

```json
{
  "access_token": "YOUR_ACCESS_TOKEN_HERE",
  "token_type": "Bearer",
  "user_email": "your-test-account@gmail.com",
  "generated_at": "2025-01-25T10:00:00Z",
  "scopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ],
  "warning": "DO NOT COMMIT THIS FILE! It contains sensitive credentials."
}
```

### 7. Verify .gitignore

Make sure `test-credentials.json` is in your `.gitignore` file.

## Note on Token Expiry

Access tokens from OAuth Playground expire after 1 hour. For longer-lived testing:
1. Use a service account instead (requires more setup)
2. Manually refresh the token when needed
3. Use the refresh token (if available) to get new access tokens

## Alternative: Using a Service Account

For CI/CD environments, consider using a service account:
1. Create a service account in Google Cloud Console
2. Enable Google Drive API
3. Download the service account key JSON
4. Share test folders with the service account email

## Running Integration Tests

Once you have `test-credentials.json` set up:

```bash
npm run test:integration
```