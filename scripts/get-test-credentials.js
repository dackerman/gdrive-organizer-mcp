#!/usr/bin/env node

/**
 * Script to help obtain Google OAuth2 access token for integration testing
 * 
 * This script guides you through the OAuth flow and helps format the credentials
 * for use in test-credentials.json
 */

const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getTokenInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: '/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(accessToken),
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔐 Google Drive Test Credentials Helper\n');
  console.log('This script will help you obtain an access token for integration testing.\n');
  
  console.log('Step 1: Open Google OAuth 2.0 Playground');
  console.log('   URL: https://developers.google.com/oauthplayground/\n');
  
  console.log('Step 2: Configure OAuth Playground');
  console.log('   1. Click the gear icon (⚙️) in the top right');
  console.log('   2. Check "Use your own OAuth credentials" (optional, for longer-lived tokens)');
  console.log('   3. If using own credentials, enter your Client ID and Client Secret\n');
  
  console.log('Step 3: Select Scopes');
  console.log('   In the left panel, expand "Google Drive API v3" and select:');
  console.log('   ✓ https://www.googleapis.com/auth/drive');
  console.log('   ✓ https://www.googleapis.com/auth/drive.file');
  console.log('   Also expand "Google OAuth2 API v2" and select:');
  console.log('   ✓ https://www.googleapis.com/auth/userinfo.email');
  console.log('   ✓ https://www.googleapis.com/auth/userinfo.profile\n');
  
  console.log('Step 4: Authorize APIs');
  console.log('   1. Click "Authorize APIs" button');
  console.log('   2. Sign in with your TEST Google account (not personal!)');
  console.log('   3. Grant all requested permissions\n');
  
  console.log('Step 5: Exchange Authorization Code');
  console.log('   Click "Exchange authorization code for tokens"\n');
  
  console.log('Step 6: Copy Access Token');
  console.log('   Copy the access_token from the response\n');
  
  await prompt('Press Enter when you have completed the above steps...');
  
  const accessToken = await prompt('\nPaste your access token here: ');
  
  if (!accessToken || accessToken.length < 20) {
    console.error('\n❌ Invalid access token. Please try again.');
    process.exit(1);
  }
  
  console.log('\n🔍 Validating token...');
  
  try {
    const tokenInfo = await getTokenInfo(accessToken.trim());
    
    if (tokenInfo.error) {
      console.error('\n❌ Token validation failed:', tokenInfo.error_description || tokenInfo.error);
      process.exit(1);
    }
    
    console.log('\n✅ Token is valid!');
    console.log(`📧 Email: ${tokenInfo.email}`);
    console.log(`🔑 Scopes: ${tokenInfo.scope}`);
    console.log(`⏱️  Expires in: ${tokenInfo.expires_in} seconds`);
    
    const testFolderId = await prompt('\nEnter your GDrive-Test-Suite folder ID (or press Enter to add later): ');
    
    const credentials = {
      access_token: accessToken.trim(),
      token_type: "Bearer",
      user_email: tokenInfo.email,
      generated_at: new Date().toISOString(),
      test_folder_id: testFolderId.trim() || "ADD_YOUR_TEST_FOLDER_ID_HERE",
      scopes: tokenInfo.scope.split(' '),
      warning: "DO NOT COMMIT THIS FILE! It contains sensitive credentials."
    };
    
    console.log('\n📋 Your test-credentials.json content:\n');
    console.log(JSON.stringify(credentials, null, 2));
    
    console.log('\n📝 Next steps:');
    console.log('1. Create a file named "test-credentials.json" in the project root');
    console.log('2. Paste the JSON content above into the file');
    if (!testFolderId.trim()) {
      console.log('3. Replace ADD_YOUR_TEST_FOLDER_ID_HERE with your actual test folder ID');
    }
    console.log('\n⚠️  Remember: This token expires in ~1 hour!');
    console.log('   For longer sessions, use your own OAuth app credentials in the playground.');
    
  } catch (error) {
    console.error('\n❌ Error validating token:', error.message);
    console.error('   The token might be invalid or expired.');
  }
  
  rl.close();
}

main().catch(console.error);