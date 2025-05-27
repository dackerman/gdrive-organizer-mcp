import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { Hono, Context } from 'hono'
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, Props } from './utils'
import { clientIdAlreadyApproved, parseRedirectApproval, renderApprovalDialog } from './workers-oauth-utils'
import { OAUTH_URLS, buildScopeString, OAUTH_PARAMS } from './oauth-constants'
import { encodeSecureState, decodeSecureState } from './secure-state'

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>()

app.get('/authorize', async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)
  const { clientId } = oauthReqInfo
  if (!clientId) {
    return c.text('Invalid request', 400)
  }

  if (await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
    return redirectToGoogle(c, oauthReqInfo)
  }

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    server: {
      name: 'Google Drive Organizer',
      description: 'This MCP Server provides tools to organize your Google Drive files.', 
    },
    state: { oauthReqInfo },
  })
})

app.post('/authorize', async (c) => {
  const { state, headers } = await parseRedirectApproval(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)
  if (!state.oauthReqInfo) {
    return c.text('Invalid request', 400)
  }

  return redirectToGoogle(c, state.oauthReqInfo, headers)
})

async function redirectToGoogle(c: Context, oauthReqInfo: AuthRequest, headers: Record<string, string> = {}) {
  const scopes = buildScopeString()
  console.log('[GoogleHandler] Redirecting to Google with scopes:', scopes)
  
  // Use secure state encoding with HMAC signature
  const secureState = await encodeSecureState(oauthReqInfo, c.env.COOKIE_ENCRYPTION_KEY)
  
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        upstreamUrl: OAUTH_URLS.AUTHORIZE,
        scope: scopes,
        clientId: c.env.GOOGLE_CLIENT_ID,
        redirectUri: new URL('/callback', c.req.raw.url).href,
        state: secureState,
        hostedDomain: c.env.HOSTED_DOMAIN,
      }),
    },
  })
}

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from Google after user authentication.
 * It exchanges the temporary code for an access token, then stores some
 * user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 */
app.get('/callback', async (c) => {
  // Decode and verify the secure state
  const stateParam = c.req.query('state') as string
  if (!stateParam) {
    return c.text('Missing state parameter', 400)
  }
  
  const oauthReqInfo = await decodeSecureState<AuthRequest>(stateParam, c.env.COOKIE_ENCRYPTION_KEY)
  if (!oauthReqInfo || !oauthReqInfo.clientId) {
    return c.text('Invalid or tampered state', 400)
  }

  // Exchange the code for an access token
  const code = c.req.query('code')
  if (!code) {
    return c.text('Missing code', 400)
  }

  console.log('[GoogleHandler] Exchanging code for access token')
  const [tokenData, googleErrResponse] = await fetchUpstreamAuthToken({
    upstreamUrl: OAUTH_URLS.TOKEN,
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    code,
    redirectUri: new URL('/callback', c.req.url).href,
    grantType: OAUTH_PARAMS.GRANT_TYPE,
  })
  if (googleErrResponse) {
    console.error('[GoogleHandler] Failed to get access token:', googleErrResponse)
    return googleErrResponse
  }
  console.log('[GoogleHandler] Got tokens:', {
    accessTokenLength: tokenData.accessToken.length,
    hasRefreshToken: !!tokenData.refreshToken,
    expiresIn: tokenData.expiresIn
  })

  // Fetch the user info from Google
  console.log('[GoogleHandler] Fetching user info from Google')
  const userResponse = await fetch(OAUTH_URLS.USERINFO, {
    headers: {
      Authorization: `Bearer ${tokenData.accessToken}`,
    },
  })
  if (!userResponse.ok) {
    const errorText = await userResponse.text()
    console.error('[GoogleHandler] Failed to fetch user info:', errorText)
    return c.text(`Failed to fetch user info: ${errorText}`, 500)
  }

  const { id, name, email } = (await userResponse.json()) as {
    id: string
    name: string
    email: string
  }
  console.log('[GoogleHandler] Got user info:', { id, name, email })

  // Calculate token expiration time
  const tokenExpiresAt = tokenData.expiresIn 
    ? Date.now() + (tokenData.expiresIn * 1000) 
    : undefined

  // Return back to the MCP client a new token
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: id,
    metadata: {
      label: name,
    },
    scope: oauthReqInfo.scope,
    props: {
      name,
      email,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt,
    } as Props,
  })

  return Response.redirect(redirectTo)
})

export { app as GoogleHandler }
