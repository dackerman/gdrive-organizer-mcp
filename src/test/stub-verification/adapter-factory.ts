import { GoogleDriveApiClient } from '../../services/google-drive-api-client'
import { GoogleDriveApiStub } from '../google-drive-api-stub'
import { GoogleDriveAdapter } from '../../services/google-drive-adapter'
import { getTestCredentials } from '../integration-setup'

export type TestMode = 'real' | 'stub' | 'both'

/**
 * Factory for creating GoogleDriveAdapter instances for testing
 * Can create adapters backed by real API or stub
 */
export class AdapterFactory {
  static create(mode: TestMode = 'real') {
    if (mode === 'real') {
      return this.createRealAdapter()
    } else if (mode === 'stub') {
      return this.createStubAdapter()
    } else {
      return {
        real: this.createRealAdapter(),
        stub: this.createStubAdapter()
      }
    }
  }

  static createRealAdapter() {
    const credentials = getTestCredentials()
    return new GoogleDriveAdapter(
      '', // Will be refreshed
      credentials.refresh_token,
      credentials.client_id,
      credentials.client_secret
    )
  }

  static createStubAdapter() {
    const stub = new GoogleDriveApiStub()
    const adapter = new GoogleDriveAdapter(
      'stub-token',
      undefined,
      undefined,
      undefined
    )
    
    // Override the private apiClient property
    ;(adapter as any).apiClient = stub
    
    return { adapter, stub }
  }
}

/**
 * Run a test function against both real and stub implementations
 */
export async function runAgainstBoth<T>(
  testFn: (adapter: GoogleDriveAdapter) => Promise<T>
): Promise<{
  real: T | Error
  stub: T | Error
  matched: boolean
}> {
  const realAdapter = AdapterFactory.createRealAdapter()
  const { adapter: stubAdapter } = AdapterFactory.createStubAdapter()

  let realResult: T | Error
  let stubResult: T | Error

  try {
    realResult = await testFn(realAdapter)
  } catch (error) {
    realResult = error as Error
  }

  try {
    stubResult = await testFn(stubAdapter)
  } catch (error) {
    stubResult = error as Error
  }

  const matched = compareResults(realResult, stubResult)

  return { real: realResult, stub: stubResult, matched }
}

function compareResults(real: any, stub: any): boolean {
  // Both threw errors
  if (real instanceof Error && stub instanceof Error) {
    // Compare error types/messages
    return real.constructor === stub.constructor
  }

  // One threw, one didn't
  if (real instanceof Error || stub instanceof Error) {
    return false
  }

  // Compare actual results (this is simplified, might need more sophisticated comparison)
  return JSON.stringify(normalizeResult(real)) === JSON.stringify(normalizeResult(stub))
}

function normalizeResult(result: any): any {
  if (Array.isArray(result)) {
    return result.map(normalizeResult)
  }

  if (result && typeof result === 'object') {
    const normalized: any = {}
    for (const [key, value] of Object.entries(result)) {
      // Skip variable fields
      if (['id', 'createdTime', 'modifiedTime'].includes(key)) {
        continue
      }
      normalized[key] = normalizeResult(value)
    }
    return normalized
  }

  return result
}