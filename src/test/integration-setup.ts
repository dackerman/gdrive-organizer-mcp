import { beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

export interface TestCredentials {
  access_token: string
  token_type: string
  user_email: string
  generated_at: string
  scopes: string[]
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
  const credentialsPath = path.join(process.cwd(), 'test-credentials.json')
  
  try {
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8')
    testCredentials = JSON.parse(credentialsContent)
    
    console.log('✅ Test credentials loaded for:', testCredentials.user_email)
    console.log('⚠️  Token generated at:', testCredentials.generated_at)
    
    // Warn if token might be expired (tokens usually last 1 hour)
    const generatedAt = new Date(testCredentials.generated_at)
    const now = new Date()
    const hoursSinceGenerated = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceGenerated > 1) {
      console.warn('⚠️  WARNING: Token is more than 1 hour old and may be expired!')
      console.warn('   Please regenerate the token using the instructions in scripts/setup-test-token-manual.md')
    }
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