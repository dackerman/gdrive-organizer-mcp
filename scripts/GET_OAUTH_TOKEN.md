# Detailed Guide: Getting OAuth Token for Testing

This guide provides step-by-step instructions for obtaining a Google OAuth token for integration testing.

## Quick Method: Using the Helper Script

Run the provided script that guides you through the process:

```bash
node scripts/get-test-credentials.js
```

The script will:
1. Show you exactly what to do in OAuth Playground
2. Validate your token
3. Generate the `test-credentials.json` content for you

## Manual Method: Step-by-Step Instructions

### 1. Access Google OAuth 2.0 Playground

Go to: https://developers.google.com/oauthplayground/

### 2. Configure OAuth Playground (Optional - for longer tokens)

If you want tokens that last longer than 1 hour:

1. Click the **gear icon ⚙️** in the top right
2. Check **"Use your own OAuth credentials"**
3. Enter your OAuth Client ID and Secret (if you have them)
4. OAuth redirect URI: `https://developers.google.com/oauthplayground`

### 3. Select Required Scopes

In the left panel, you need to select these scopes:

#### Google Drive API v3
- ✅ `https://www.googleapis.com/auth/drive` (See, edit, create, and delete all files)
- ✅ `https://www.googleapis.com/auth/drive.file` (See, edit, create, and delete only the specific files you use)

#### Google OAuth2 API v2 (for user info)
- ✅ `https://www.googleapis.com/auth/userinfo.email` (View your email address)
- ✅ `https://www.googleapis.com/auth/userinfo.profile` (See your personal info)

**Visual Guide:**
```
▼ Google Drive API v3
  ☑ ../auth/drive
  ☑ ../auth/drive.file
  ☐ ../auth/drive.appdata
  ☐ ../auth/drive.metadata
  ...

▼ Google OAuth2 API v2
  ☑ openid
  ☑ ../auth/userinfo.email
  ☑ ../auth/userinfo.profile
```

### 4. Authorize APIs

1. Click the blue **"Authorize APIs"** button
2. You'll be redirected to Google sign-in
3. **⚠️ Sign in with your TEST account** (not your personal account!)
4. Review the permissions requested
5. Click **"Allow"** to grant access

### 5. Exchange Authorization Code

After authorization:
1. You'll be redirected back to OAuth Playground
2. Click **"Exchange authorization code for tokens"**
3. You'll see a response with your tokens

### 6. Copy the Access Token

From the response, copy the `access_token` value:

```json
{
  "access_token": "ya29.a0AfH6SMBxxxxxx...", // ← Copy this
  "scope": "https://www.googleapis.com/auth/drive.file ...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

### 7. Get Your Test Folder ID

1. Go to your Google Drive
2. Navigate to your `GDrive-Test-Suite` folder
3. The folder ID is in the URL:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^ (this part)
   ```

### 8. Create test-credentials.json

Create a file named `test-credentials.json` in the project root:

```json
{
  "access_token": "ya29.a0AfH6SMBxxxxxx...",
  "token_type": "Bearer",
  "user_email": "your-test@gmail.com",
  "generated_at": "2025-01-25T10:00:00Z",
  "test_folder_id": "1AbCdEfGhIjKlMnOpQrStUvWxYz",
  "scopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ],
  "warning": "DO NOT COMMIT THIS FILE! It contains sensitive credentials."
}
```

## Token Expiration

⏱️ **Default tokens expire in 1 hour!**

### For Longer Sessions:

1. **Use your own OAuth app** (configure in playground settings)
2. **Use a Service Account** (requires different setup)
3. **Refresh manually** when tests fail with 401 errors

### Quick Refresh Process:

1. Go back to OAuth Playground
2. Click "Refresh access token" 
3. Copy new token to test-credentials.json

## Troubleshooting

### "Invalid Credentials" Error
- Token has expired (check generated_at time)
- Token was copied incorrectly (extra spaces?)
- Wrong scopes selected

### "Insufficient Permission" Error  
- Missing required scopes
- Need to re-authorize with all 4 scopes

### Can't Find Test Folder
- Make sure you created the folder structure (see TEST_FOLDER_SETUP.md)
- Check you're using the right Google account
- Folder ID must be from the folder URL, not the folder name

## Security Reminders

🔒 **NEVER commit test-credentials.json to git!**
- It's in .gitignore, but double-check
- Use a test account, not personal
- Tokens are like passwords - keep them secret
- Regenerate if you accidentally expose them

## Pro Tips

1. **Save your OAuth Playground URL** - If you configure your own credentials, the URL contains them for next time

2. **Use Node script** - The helper script validates tokens and formats JSON correctly

3. **Multiple test accounts** - Consider having separate test accounts for different scenarios

4. **Token lifetime** - Note when you generated the token so you know when it expires

5. **Bookmark the Playground** - You'll use it often during development