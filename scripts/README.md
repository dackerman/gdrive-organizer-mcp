# Scripts Directory

This directory contains helper scripts for the Google Drive Organizer MCP project.

## Available Scripts

### get-test-credentials.js

Interactive script to help obtain Google OAuth tokens for integration testing.

**Usage:**
```bash
npm run test:get-token
# or
node scripts/get-test-credentials.js
```

**What it does:**
1. Provides step-by-step instructions for OAuth Playground
2. Validates the token you obtain
3. Generates properly formatted `test-credentials.json` content
4. Checks token expiration time

## Documentation

### GET_OAUTH_TOKEN.md

Comprehensive guide with:
- Detailed step-by-step instructions
- Visual guides for OAuth Playground
- Troubleshooting tips
- Security reminders
- Pro tips for testing

### setup-test-token-manual.md

Quick reference guide that points to the detailed documentation and helper script.

## Adding New Scripts

When adding new scripts:
1. Make them executable: `chmod +x script-name.js`
2. Add npm script alias in package.json if frequently used
3. Document usage in this README
4. Consider adding `#!/usr/bin/env node` shebang for direct execution