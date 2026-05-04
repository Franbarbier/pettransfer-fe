import { promises as fs } from "fs";
import path from "path";

const MICROSOFT_GRAPH_SCOPE = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Send",
].join(" ");

const AUTH_STORAGE_PATH = path.join(
  process.cwd(),
  ".local",
  "microsoft-mail.json",
);

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type StoredMicrosoftMailAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
  email: string;
  displayName: string;
  obtainedAt: string;
};

type GraphMeResponse = {
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

function getTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

function getClientId(): string {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || "";
}

function getClientSecret(): string {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
}

export function isMicrosoftMailConfigured(): boolean {
  return Boolean(getClientId() && getClientSecret());
}

export function getMicrosoftMailConfigError(): string | null {
  if (!getClientId()) return "Falta MICROSOFT_CLIENT_ID en el servidor.";
  if (!getClientSecret()) return "Falta MICROSOFT_CLIENT_SECRET en el servidor.";
  return null;
}

export function getMicrosoftOAuthRedirectUri(origin: string): string {
  return (
    process.env.MICROSOFT_REDIRECT_URI?.trim() ||
    new URL("/api/microsoft/oauth/callback", origin).toString()
  );
}

export function createMicrosoftOAuthUrl(origin: string, state: string): string {
  const authUrl = new URL(
    `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", getClientId());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", getMicrosoftOAuthRedirectUri(origin));
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", MICROSOFT_GRAPH_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  return authUrl.toString();
}

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(path.dirname(AUTH_STORAGE_PATH), { recursive: true });
}

export async function readStoredMicrosoftMailAuth(): Promise<StoredMicrosoftMailAuth | null> {
  try {
    const raw = await fs.readFile(AUTH_STORAGE_PATH, "utf8");
    return JSON.parse(raw) as StoredMicrosoftMailAuth;
  } catch {
    return null;
  }
}

async function writeStoredMicrosoftMailAuth(auth: StoredMicrosoftMailAuth): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(AUTH_STORAGE_PATH, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
}

export async function clearStoredMicrosoftMailAuth(): Promise<void> {
  try {
    await fs.unlink(AUTH_STORAGE_PATH);
  } catch {
    // noop
  }
}

async function fetchToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(
    `https://login.microsoftonline.com/${getTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || "No se pudo obtener token.";
    throw new Error(detail);
  }
  return data;
}

async function fetchMicrosoftMe(accessToken: string): Promise<GraphMeResponse> {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const data = (await response.json()) as GraphMeResponse & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message || "No se pudo leer el perfil de Microsoft.");
  }
  return data;
}

function normalizeStoredAuth(
  token: TokenResponse,
  me: GraphMeResponse,
  fallbackRefreshToken?: string,
): StoredMicrosoftMailAuth {
  const email = me.mail?.trim() || me.userPrincipalName?.trim() || "";
  if (!email) {
    throw new Error("Microsoft no devolvió una casilla válida para enviar email.");
  }

  const accessToken = token.access_token;
  const refreshToken = token.refresh_token || fallbackRefreshToken;
  if (!accessToken || !refreshToken) {
    throw new Error("Microsoft no devolvió tokens suficientes para continuar.");
  }

  const expiresIn = Number(token.expires_in ?? 0);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
    tokenType: token.token_type || "Bearer",
    scope: token.scope || MICROSOFT_GRAPH_SCOPE,
    email,
    displayName: me.displayName?.trim() || email,
    obtainedAt: new Date().toISOString(),
  };
}

export async function exchangeMicrosoftCodeForToken(
  origin: string,
  code: string,
): Promise<StoredMicrosoftMailAuth> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: "authorization_code",
    code,
    redirect_uri: getMicrosoftOAuthRedirectUri(origin),
    scope: MICROSOFT_GRAPH_SCOPE,
  });

  const token = await fetchToken(body);
  const me = await fetchMicrosoftMe(token.access_token!);
  const stored = normalizeStoredAuth(token, me);
  await writeStoredMicrosoftMailAuth(stored);
  return stored;
}

async function refreshMicrosoftAccessToken(
  refreshToken: string,
): Promise<StoredMicrosoftMailAuth> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MICROSOFT_GRAPH_SCOPE,
  });

  const token = await fetchToken(body);
  const me = await fetchMicrosoftMe(token.access_token!);
  const stored = normalizeStoredAuth(token, me, refreshToken);
  await writeStoredMicrosoftMailAuth(stored);
  return stored;
}

export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const stored = await readStoredMicrosoftMailAuth();
  if (!stored) {
    throw new Error("La cuenta Outlook no está conectada todavía.");
  }

  if (stored.expiresAt > Date.now()) {
    return stored.accessToken;
  }

  const refreshed = await refreshMicrosoftAccessToken(stored.refreshToken);
  return refreshed.accessToken;
}

export async function getMicrosoftMailConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  email?: string;
  displayName?: string;
  expiresAt?: number;
  error?: string;
}> {
  const configError = getMicrosoftMailConfigError();
  if (configError) {
    return {
      configured: false,
      connected: false,
      error: configError,
    };
  }

  const stored = await readStoredMicrosoftMailAuth();
  if (!stored) {
    return {
      configured: true,
      connected: false,
    };
  }

  return {
    configured: true,
    connected: true,
    email: stored.email,
    displayName: stored.displayName,
    expiresAt: stored.expiresAt,
  };
}
