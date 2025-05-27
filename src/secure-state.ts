/**
 * Secure state encoding/decoding with HMAC signing
 * Prevents CSRF attacks by ensuring state integrity
 */

/**
 * Creates an HMAC signature for the given data
 */
async function createHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  )
  
  // Convert ArrayBuffer to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Verifies an HMAC signature
 */
async function verifyHmac(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createHmac(data, secret)
  return signature === expectedSignature
}

/**
 * Encodes state with HMAC signature
 */
export async function encodeSecureState<T>(state: T, secret: string): Promise<string> {
  const jsonData = JSON.stringify(state)
  const base64Data = btoa(jsonData)
  const signature = await createHmac(base64Data, secret)
  
  // Combine data and signature
  return `${base64Data}.${signature}`
}

/**
 * Decodes and verifies state with HMAC signature
 */
export async function decodeSecureState<T>(
  encodedState: string, 
  secret: string
): Promise<T | null> {
  try {
    const [base64Data, signature] = encodedState.split('.')
    if (!base64Data || !signature) {
      console.error('[SecureState] Invalid state format')
      return null
    }
    
    // Verify signature
    const isValid = await verifyHmac(base64Data, signature, secret)
    if (!isValid) {
      console.error('[SecureState] Invalid signature')
      return null
    }
    
    // Decode data
    const jsonData = atob(base64Data)
    return JSON.parse(jsonData) as T
  } catch (error) {
    console.error('[SecureState] Failed to decode state:', error)
    return null
  }
}