import { beforeAll } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

export interface TestCredentials {
  refresh_token: string
  client_id: string
  client_secret: string
  user_email: string
  test_folder_id: string
}

// Use module augmentation to add properties to globalThis
declare module 'vitest' {
  interface TestContext {
    testCredentials?: TestCredentials
    testFolderId?: string
  }
}

// Store credentials in a module-level variable instead
let testCredentials: TestCredentials | undefined
let testFolderId: string | undefined

beforeAll(async () => {
  // Load test credentials
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const credentialsPath = join(__dirname, '../../test-credentials.json')
  
  try {
    const credentialsContent = readFileSync(credentialsPath, 'utf8')
    testCredentials = JSON.parse(credentialsContent) as TestCredentials
    
    console.log('✅ Test credentials loaded for:', testCredentials.user_email)
  } catch (error) {
    console.error('❌ Failed to load test credentials from:', credentialsPath)
    console.error('   Please follow the instructions in scripts/setup-test-token-manual.md')
    throw error
  }
})

// Helper to get test credentials
export function getTestCredentials(): TestCredentials {
  if (!testCredentials) {
    throw new Error('Test credentials not loaded. Did integration-setup.ts run?')
  }
  return testCredentials
}

// Helper to get or create a test folder ID
export function getTestFolderId(): string {
  if (!testFolderId) {
    // This will be set by the first test that creates a test folder
    throw new Error('Test folder not yet created')
  }
  return testFolderId
}

export function setTestFolderId(folderId: string): void {
  testFolderId = folderId
}