/**
 * Centralized OAuth configuration constants
 */

// OAuth endpoint URLs
export const OAUTH_URLS = {
  AUTHORIZE: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN: 'https://accounts.google.com/o/oauth2/token',
  USERINFO: 'https://www.googleapis.com/oauth2/v2/userinfo',
} as const

// OAuth scopes
export const OAUTH_SCOPES = {
  EMAIL: 'email',
  PROFILE: 'profile',
  DRIVE_FULL: 'https://www.googleapis.com/auth/drive',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  USERINFO_EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  USERINFO_PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
} as const

// Default scopes for the application
export const DEFAULT_SCOPES = [OAUTH_SCOPES.EMAIL, OAUTH_SCOPES.PROFILE, OAUTH_SCOPES.DRIVE_FULL, OAUTH_SCOPES.DRIVE_FILE] as const

// OAuth parameters
export const OAUTH_PARAMS = {
  ACCESS_TYPE: 'offline' as const,
  PROMPT: 'consent' as const,
  RESPONSE_TYPE: 'code' as const,
  GRANT_TYPE: 'authorization_code' as const,
  REFRESH_GRANT_TYPE: 'refresh_token' as const,
} as const

// Scope string builder
export function buildScopeString(scopes: readonly string[] = DEFAULT_SCOPES): string {
  return scopes.join(' ')
}
