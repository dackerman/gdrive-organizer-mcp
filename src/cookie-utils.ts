/**
 * Shared cookie utilities for parsing and building secure cookies
 */

export interface CookieOptions {
  name: string
  value: string
  maxAge?: number
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

/**
 * Parses cookies from a Cookie header string
 */
export function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  
  if (!cookieHeader) return cookies
  
  cookieHeader.split(';').forEach(cookie => {
    const trimmed = cookie.trim()
    const [name, ...valueParts] = trimmed.split('=')
    if (name && valueParts.length > 0) {
      cookies.set(name, valueParts.join('='))
    }
  })
  
  return cookies
}

/**
 * Gets a specific cookie value by name
 */
export function getCookie(cookieHeader: string | null, name: string): string | null {
  const cookies = parseCookies(cookieHeader)
  return cookies.get(name) || null
}

/**
 * Builds a Set-Cookie header string
 */
export function buildSetCookie(options: CookieOptions): string {
  const parts = [`${options.name}=${options.value}`]
  
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }
  
  if (options.path) {
    parts.push(`Path=${options.path}`)
  }
  
  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  
  if (options.secure) {
    parts.push('Secure')
  }
  
  if (options.httpOnly) {
    parts.push('HttpOnly')
  }
  
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }
  
  return parts.join('; ')
}

/**
 * Creates a signed cookie value using HMAC
 */
export async function signCookieValue(value: string, secret: string): Promise<string> {
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
    encoder.encode(value)
  )
  
  // Convert signature to hex
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Format: signature.value
  return `${signatureHex}.${btoa(value)}`
}

/**
 * Verifies and extracts a signed cookie value
 */
export async function verifyCookieValue(
  signedValue: string, 
  secret: string
): Promise<string | null> {
  const parts = signedValue.split('.')
  if (parts.length !== 2) return null
  
  const [signatureHex, base64Value] = parts
  
  try {
    const value = atob(base64Value)
    
    // Verify signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    // Convert hex signature back to ArrayBuffer
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer,
      encoder.encode(value)
    )
    
    return isValid ? value : null
  } catch (error) {
    console.error('[CookieUtils] Failed to verify cookie:', error)
    return null
  }
}