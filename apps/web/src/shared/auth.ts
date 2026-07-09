import { AuthProfile } from './models.js';
import { getRuntimeConfig } from './runtime-config.js';

const authStateStorageKey = 'InvoiceLens:auth-state';
const authStateBackupStorageKey = 'InvoiceLens:auth-state-backup';
const authProfileStorageKey = 'InvoiceLens:auth-profile';
const authTokensStorageKey = 'InvoiceLens:auth-tokens';
const authRouteStorageKey = 'InvoiceLens:auth-post-login-route';
const authRouteBackupStorageKey = 'InvoiceLens:auth-post-login-route-backup';
const authDebugStorageKey = 'InvoiceLens:debug-auth';

type TokenResponse = {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  ext_expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
};

type AuthState = {
  state: string;
  codeVerifier: string;
};

type StoredTokens = {
  accessToken: string;
  expiresAtUtc: string;
};

type MicrosoftSessionProfileResult = {
  profile: AuthProfile | null;
  unavailableMessage: string | null;
};

type MicrosoftAuthBootstrapResult = MicrosoftSessionProfileResult;

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  bytes.forEach((byte) => {
    result += String.fromCharCode(byte);
  });

  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer);
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(digest);
}

function isAuthDebugEnabled(): boolean {
  try {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    return window.localStorage.getItem(authDebugStorageKey) === 'true';
  } catch {
    return false;
  }
}

function authDebug(message: string, details?: Record<string, unknown>): void {
  if (!isAuthDebugEnabled()) {
    return;
  }

  if (details) {
    console.info(`[InvoiceLens auth] ${message}`, details);
    return;
  }

  console.info(`[InvoiceLens auth] ${message}`);
}

function truncateForLog(value: string, maxLength = 1000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) {
    return {};
  }

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildDisplayName(claims: Record<string, unknown>): string {
  const name = claims['name'];
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  const displayName = claims['displayName'];
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName.trim();
  }

  const givenName = claims['given_name'];
  const familyName = claims['family_name'];
  if (typeof givenName === 'string' && givenName.trim() && typeof familyName === 'string' && familyName.trim()) {
    return `${givenName.trim()} ${familyName.trim()}`;
  }

  if (typeof givenName === 'string' && givenName.trim()) {
    return givenName.trim();
  }

  const preferredUsername = claims['preferred_username'];
  if (typeof preferredUsername === 'string' && preferredUsername.trim()) {
    return preferredUsername.trim();
  }

  const email = claims['email'];
  if (typeof email === 'string' && email.trim()) {
    return email.trim();
  }

  const upn = claims['upn'];
  if (typeof upn === 'string' && upn.trim()) {
    return upn.trim();
  }

  return 'Microsoft user';
}

function buildInitials(displayName: string): string {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'MU';
}

function normalizeIdentityValue(value: string): string {
  return value.trim().toLowerCase();
}

function hasSameIdentity(left: AuthProfile, right: AuthProfile): boolean {
  if (left.email && right.email) {
    return normalizeIdentityValue(left.email) === normalizeIdentityValue(right.email);
  }

  return normalizeIdentityValue(left.displayName) === normalizeIdentityValue(right.displayName);
}

function getAuthConfig() {
  return getRuntimeConfig().auth;
}

function readStorageItem(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch {
    // Ignore storage access failures and fall back to localStorage.
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage access failures and keep trying the backup store.
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage access failures and keep the session copy if available.
  }
}

function removeStorageItem(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access failures and continue with the backup store.
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
}

function isConfigured(): boolean {
  const config = getAuthConfig();
  return Boolean(config.clientId && config.tenantId && config.redirectUri);
}

function readStoredProfile(): AuthProfile | null {
  try {
    const raw = window.localStorage.getItem(authProfileStorageKey);
    if (!raw) {
      authDebug('No stored auth profile found in localStorage.');
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthProfile>;
    if (!parsed.displayName || !parsed.initials) {
      authDebug('Stored auth profile was incomplete.', {
        hasDisplayName: Boolean(parsed.displayName),
        hasInitials: Boolean(parsed.initials),
        hasEmail: Boolean(parsed.email),
      });
      return null;
    }

    const profile = {
      displayName: parsed.displayName,
      initials: parsed.initials,
      email: parsed.email ?? '',
      photoDataUrl: parsed.photoDataUrl ?? null,
      jobTitle: parsed.jobTitle ?? null,
      department: parsed.department ?? null,
      officeLocation: parsed.officeLocation ?? null,
    };
    authDebug('Loaded auth profile from storage.', {
      displayName: profile.displayName,
      initials: profile.initials,
      hasEmail: Boolean(profile.email),
      hasPhoto: Boolean(profile.photoDataUrl),
    });
    return profile;
  } catch {
    authDebug('Failed to parse stored auth profile.');
    return null;
  }
}

function persistProfile(profile: AuthProfile): void {
  const storedProfile = readStoredProfile();
  const mergedProfile = storedProfile && hasSameIdentity(storedProfile, profile)
    ? {
        ...storedProfile,
        ...profile,
        photoDataUrl: profile.photoDataUrl ?? storedProfile.photoDataUrl ?? null,
        jobTitle: profile.jobTitle ?? storedProfile.jobTitle ?? null,
        department: profile.department ?? storedProfile.department ?? null,
        officeLocation: profile.officeLocation ?? storedProfile.officeLocation ?? null,
      }
    : {
        ...profile,
        photoDataUrl: profile.photoDataUrl ?? null,
      };

  window.localStorage.setItem(authProfileStorageKey, JSON.stringify(mergedProfile));
  authDebug('Persisted auth profile.', {
    displayName: mergedProfile.displayName,
    initials: mergedProfile.initials,
    hasEmail: Boolean(mergedProfile.email),
    hasPhoto: Boolean(mergedProfile.photoDataUrl),
  });
}

function clearProfile(): void {
  window.localStorage.removeItem(authProfileStorageKey);
  window.localStorage.removeItem(authTokensStorageKey);
  authDebug('Cleared stored auth profile and tokens.');
}

function readStoredAccessToken(): string | null {
  try {
    const raw = window.localStorage.getItem(authTokensStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredTokens>;
    if (!parsed.accessToken || !parsed.expiresAtUtc) {
      window.localStorage.removeItem(authTokensStorageKey);
      return null;
    }

    const expiry = Date.parse(parsed.expiresAtUtc);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      window.localStorage.removeItem(authTokensStorageKey);
      return null;
    }

    return parsed.accessToken;
  } catch {
    window.localStorage.removeItem(authTokensStorageKey);
    return null;
  }
}

function persistAccessToken(accessToken: string, expiresInSeconds?: number): void {
  const expiresIn = typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : 3600;

  const expiresAt = new Date(Date.now() + (expiresIn * 1000));
  const tokens: StoredTokens = {
    accessToken,
    expiresAtUtc: expiresAt.toISOString(),
  };

  window.localStorage.setItem(authTokensStorageKey, JSON.stringify(tokens));
}

function extractProfileFromClaims(claims: Record<string, unknown>): AuthProfile {
  const displayName = buildDisplayName(claims);
  const email =
    typeof claims['preferred_username'] === 'string'
      ? claims['preferred_username'].trim()
      : typeof claims['email'] === 'string'
        ? claims['email'].trim()
        : typeof claims['upn'] === 'string'
          ? claims['upn'].trim()
          : '';

  return {
    displayName,
    email,
    initials: buildInitials(displayName),
    photoDataUrl: null,
    jobTitle: typeof claims['jobTitle'] === 'string' ? claims['jobTitle'].trim() : null,
    department: typeof claims['department'] === 'string' ? claims['department'].trim() : null,
    officeLocation: typeof claims['officeLocation'] === 'string' ? claims['officeLocation'].trim() : null,
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read Microsoft profile photo.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(blob);
  });
}

async function fetchMicrosoftProfilePhoto(accessToken: string): Promise<string | null> {
  authDebug('Fetching Microsoft profile photo from Graph.');
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'image/*',
      },
    });

    if (response.status === 404) {
      authDebug('Microsoft profile photo was not available.');
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      authDebug('Microsoft profile photo request failed.', {
        status: response.status,
        statusText: response.statusText,
        errorText: truncateForLog(errorText),
      });
      return null;
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      authDebug('Microsoft profile photo response was empty.');
      return null;
    }

    const dataUrl = await blobToDataUrl(blob);
    authDebug('Microsoft profile photo received.', {
      size: blob.size,
      type: blob.type,
    });
    return dataUrl || null;
  } catch (error) {
    authDebug('Microsoft profile photo fetch failed.', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function fetchMicrosoftSessionProfile(): Promise<MicrosoftSessionProfileResult> {
  authDebug('Fetching Microsoft session profile from the API.');
  const accessToken = readStoredAccessToken();
  try {
    const headers = new Headers({
      Accept: 'application/json',
    });

    if (accessToken) {
      headers.set('X-Microsoft-Access-Token', accessToken);
    }

    const response = await fetch('/api/auth/me', {
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      authDebug('No Microsoft session is active.');
      return { profile: null, unavailableMessage: null };
    }

    if (!response.ok) {
      const backendUnavailable = [502, 503, 504].includes(response.status);
      const unavailableMessage = backendUnavailable
        ? 'The InvoiceLens API is unavailable right now. Start the API, make sure SQL Server is reachable, and refresh the page.'
        : 'InvoiceLens could not verify the Microsoft session right now. Please refresh the page and try again.';

      authDebug('Microsoft session profile request failed.', {
        status: response.status,
        statusText: response.statusText,
        backendUnavailable,
      });
      return { profile: null, unavailableMessage };
    }

    const profile = (await response.json()) as AuthProfile;
    authDebug('Microsoft session profile received.', {
      displayName: profile.displayName,
      initials: profile.initials,
      hasEmail: Boolean(profile.email),
      hasPhoto: Boolean(profile.photoDataUrl),
    });
    return { profile, unavailableMessage: null };
  } catch (error) {
    authDebug('Microsoft session profile request could not reach the API.', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      profile: null,
      unavailableMessage: 'InvoiceLens could not reach the API. Start the backend and refresh the page.',
    };
  }
}

async function createMicrosoftSession(idToken: string, accessToken?: string): Promise<AuthProfile> {
  authDebug('Creating Microsoft session cookie from id token.');
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ idToken, accessToken: accessToken ?? null }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const backendUnavailable = [502, 503, 504].includes(response.status);
    const failureMessage = backendUnavailable
      ? 'Microsoft session could not be established because the InvoiceLens API is unavailable. Start the API and make sure SQL Server is reachable, then try signing in again.'
      : `Microsoft session could not be established (${response.status} ${response.statusText}).`;
    authDebug('Microsoft session creation failed.', {
      status: response.status,
      statusText: response.statusText,
      errorText: truncateForLog(errorText),
    });
    throw new Error(failureMessage);
  }

  const profile = (await response.json()) as AuthProfile;
  authDebug('Microsoft session established.', {
    displayName: profile.displayName,
    initials: profile.initials,
    hasEmail: Boolean(profile.email),
    hasPhoto: Boolean(profile.photoDataUrl),
  });
  return profile;
}

function readAuthState(): AuthState | null {
  try {
    const raw = readStorageItem(authStateStorageKey) ?? readStorageItem(authStateBackupStorageKey);
    if (!raw) {
      authDebug('No auth state found in storage.');
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.state || !parsed.codeVerifier) {
      authDebug('Stored auth state was incomplete.', {
        hasState: Boolean(parsed.state),
        hasCodeVerifier: Boolean(parsed.codeVerifier),
      });
      return null;
    }

    const authState = {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
    };
    authDebug('Loaded auth state from storage.');
    return authState;
  } catch {
    authDebug('Failed to parse auth state from storage.');
    return null;
  }
}

function persistAuthState(state: AuthState): void {
  const raw = JSON.stringify(state);
  writeStorageItem(authStateStorageKey, raw);
  writeStorageItem(authStateBackupStorageKey, raw);
  authDebug('Persisted auth state.', {
    stateLength: state.state.length,
    codeVerifierLength: state.codeVerifier.length,
  });
}

function clearAuthState(): void {
  removeStorageItem(authStateStorageKey);
  removeStorageItem(authStateBackupStorageKey);
  authDebug('Cleared auth state.');
}

function persistPostLoginRoute(pathname: string): void {
  writeStorageItem(authRouteStorageKey, pathname);
  writeStorageItem(authRouteBackupStorageKey, pathname);
  authDebug('Persisted post-login route.', { pathname });
}

function readPostLoginRoute(): string | null {
  const route = readStorageItem(authRouteStorageKey) ?? readStorageItem(authRouteBackupStorageKey);
  authDebug(route ? 'Loaded post-login route from storage.' : 'No post-login route found in storage.', {
    pathname: route ?? '',
  });
  return route;
}

function clearPostLoginRoute(): void {
  removeStorageItem(authRouteStorageKey);
  removeStorageItem(authRouteBackupStorageKey);
  authDebug('Cleared post-login route.');
}

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
  const config = getAuthConfig();
  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  authDebug('Exchanging authorization code for token.', {
    redirectUri: config.redirectUri,
    scopes: config.scopes,
  });
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
    scope: config.scopes.join(' '),
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorBody: unknown = errorText;
    try {
      errorBody = errorText ? JSON.parse(errorText) : '';
    } catch {
      errorBody = errorText;
    }

    authDebug('Microsoft token exchange failed.', {
      status: response.status,
      statusText: response.statusText,
      errorBody: typeof errorBody === 'string' ? truncateForLog(errorBody) : errorBody,
    });
    throw new Error(`Microsoft sign-in failed (${response.status} ${response.statusText}).`);
  }

  const tokenData = (await response.json()) as TokenResponse;
  if (!tokenData.id_token) {
    authDebug('Microsoft token exchange returned no id token.', {
      scope: tokenData.scope ?? '',
      hasAccessToken: Boolean(tokenData.access_token),
      hasRefreshToken: Boolean(tokenData.refresh_token),
      keys: Object.keys(tokenData),
    });
    throw new Error('Microsoft sign-in did not return an id token.');
  }

  authDebug('Token exchange completed.', {
    hasAccessToken: Boolean(tokenData.access_token),
    hasRefreshToken: Boolean(tokenData.refresh_token),
    hasIdToken: Boolean(tokenData.id_token),
    scope: tokenData.scope ?? '',
  });
  return tokenData;
}

export function getCurrentAuthProfile(): AuthProfile | null {
  return readStoredProfile();
}

export async function initializeMicrosoftAuth(): Promise<MicrosoftAuthBootstrapResult> {
  const cachedProfile = readStoredProfile();

  if (!isConfigured()) {
    authDebug('Microsoft auth is not configured; reading stored profile only.');
    if (cachedProfile) {
      return { profile: cachedProfile, unavailableMessage: null };
    }

    return fetchMicrosoftSessionProfile();
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  authDebug('Initializing Microsoft auth.', {
    pathname: url.pathname,
    search: url.search,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    redirectUri: getAuthConfig().redirectUri,
  });

  if (code) {
    const storedState = readAuthState();
    if (!storedState || !state || storedState.state !== state) {
      authDebug('Microsoft sign-in state validation failed.', {
        hasStoredState: Boolean(storedState),
        hasState: Boolean(state),
      });
      const sessionProfile = await fetchMicrosoftSessionProfile();
      if (sessionProfile.profile) {
        persistProfile(sessionProfile.profile);
        clearAuthState();
        clearPostLoginRoute();
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('session_state');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        authDebug('Recovered Microsoft auth from existing session cookie after callback state mismatch.', {
          displayName: sessionProfile.profile.displayName,
          initials: sessionProfile.profile.initials,
          hasEmail: Boolean(sessionProfile.profile.email),
          hasPhoto: Boolean(sessionProfile.profile.photoDataUrl),
        });
        return sessionProfile;
      }

      if (sessionProfile.unavailableMessage) {
        return sessionProfile;
      }

      throw new Error('Microsoft sign-in state could not be validated.');
    }

    const tokenData = await exchangeCodeForToken(code, storedState.codeVerifier);
    if (tokenData.access_token) {
      persistAccessToken(tokenData.access_token, tokenData.expires_in);
    }

    const idToken = tokenData.id_token ?? '';
    const idTokenProfile = extractProfileFromClaims(parseJwtPayload(idToken));
    authDebug('Extracted profile from id token.', {
      displayName: idTokenProfile.displayName,
      hasEmail: Boolean(idTokenProfile.email),
      initials: idTokenProfile.initials,
    });
    const profile = await createMicrosoftSession(idToken, tokenData.access_token);
    if (!profile.photoDataUrl && tokenData.access_token) {
      const photoDataUrl = await fetchMicrosoftProfilePhoto(tokenData.access_token);
      if (photoDataUrl) {
        profile.photoDataUrl = photoDataUrl;
      }
    }
    persistProfile(profile);
    clearAuthState();
    clearPostLoginRoute();
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('session_state');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    authDebug('Microsoft auth callback completed and URL cleaned up.', {
      displayName: profile.displayName,
      initials: profile.initials,
      hasEmail: Boolean(profile.email),
      hasPhoto: Boolean(profile.photoDataUrl),
    });
    return { profile, unavailableMessage: null };
  }

  authDebug('No auth callback present; checking session state.');

  if (cachedProfile) {
    // Prefer instant UI hydration from cached profile and verify the real session in the background.
    void fetchMicrosoftSessionProfile()
      .then((sessionProfile) => {
        if (sessionProfile.profile) {
          persistProfile(sessionProfile.profile);
          return;
        }

        clearProfile();
      })
      .catch(() => {
        // Ignore background verification failures; runtime API calls will enforce session state.
      });

    return { profile: cachedProfile, unavailableMessage: null };
  }

  const sessionProfile = await fetchMicrosoftSessionProfile();
  if (sessionProfile.profile) {
    persistProfile(sessionProfile.profile);
    return sessionProfile;
  }

  if (sessionProfile.unavailableMessage) {
    clearProfile();
    return sessionProfile;
  }

  clearProfile();
  return sessionProfile;
}

export async function startMicrosoftSignIn(): Promise<void> {
  const config = getAuthConfig();
  if (!isConfigured()) {
    throw new Error('Microsoft sign-in is not configured.');
  }

  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = await sha256(codeVerifier);
  persistAuthState({ state, codeVerifier });
  persistPostLoginRoute(`${window.location.pathname}${window.location.search}`);
  authDebug('Starting Microsoft sign-in redirect.', {
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    scopes: config.scopes,
    stateLength: state.length,
    codeVerifierLength: codeVerifier.length,
  });

  const authorizeUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('prompt', 'select_account');

  authDebug('Navigating to Microsoft authorize endpoint.', {
    authorizeUrl: authorizeUrl.toString(),
  });
  window.location.assign(authorizeUrl.toString());
}

export async function signOutMicrosoft(): Promise<void> {
  clearProfile();
  clearAuthState();

  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => null);

  if (!isConfigured()) {
    return;
  }

  const config = getAuthConfig();
  const logoutUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/logout`);
  logoutUrl.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri || config.redirectUri);
  authDebug('Navigating to Microsoft logout endpoint.', {
    postLogoutRedirectUri: config.postLogoutRedirectUri || config.redirectUri,
  });
  window.location.assign(logoutUrl.toString());
}

export function restorePostLoginRoute(): string | null {
  const route = readPostLoginRoute();
  clearPostLoginRoute();
  return route;
}

export function clearMicrosoftAuth(): void {
  clearProfile();
  clearAuthState();
  clearPostLoginRoute();
  authDebug('Cleared all Microsoft auth state.');
}
