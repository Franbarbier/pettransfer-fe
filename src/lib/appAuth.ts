import crypto from "crypto";

export const APP_SESSION_COOKIE = "pettransfer_app_session";
export const APP_AUTH_STATE_COOKIE = "pettransfer_app_auth_state";
export const APP_AUTH_RETURN_TO_COOKIE = "pettransfer_app_auth_return_to";

const DEFAULT_LOGIN_DOMAINS = ["latampettransport.com", "pet.com.ar"];
const DEFAULT_SESSION_DAYS = 30;
const MICROSOFT_AUTH_SCOPE = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Send",
  "Mail.ReadWrite",
].join(" ");

export type AppSession = {
  email: string;
  name: string;
  provider: "microsoft";
  issuedAt: number;
  expiresAt: number;
  microsoftRefreshToken?: string;
  microsoftScope?: string;
};

type GraphMeResponse = {
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthSecret(): string {
  return process.env.APP_AUTH_SECRET?.trim() || "";
}

function getSessionDays(): number {
  const raw = Number(process.env.APP_SESSION_DAYS ?? DEFAULT_SESSION_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SESSION_DAYS;
  return Math.floor(raw);
}

export function getAllowedLoginDomains(): string[] {
  const raw = process.env.ALLOWED_LOGIN_DOMAINS?.trim();
  if (!raw) return DEFAULT_LOGIN_DOMAINS;
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function getMicrosoftTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

function getMicrosoftClientId(): string {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || "";
}

function getMicrosoftClientSecret(): string {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
}

export function getMicrosoftLoginRedirectUri(origin: string): string {
  return (
    process.env.MICROSOFT_LOGIN_REDIRECT_URI?.trim() ||
    new URL("/api/auth/microsoft/callback", origin).toString()
  );
}

export function getAppAuthConfigError(): string | null {
  if (!getAuthSecret()) return "Falta APP_AUTH_SECRET en el servidor.";
  if (!getMicrosoftClientId()) return "Falta MICROSOFT_CLIENT_ID en el servidor.";
  if (!getMicrosoftClientSecret()) {
    return "Falta MICROSOFT_CLIENT_SECRET en el servidor.";
  }
  const domains = getAllowedLoginDomains();
  if (domains.length === 0) {
    return "No hay dominios permitidos para login en ALLOWED_LOGIN_DOMAINS.";
  }
  return null;
}

export function isAllowedLoginEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const atIndex = clean.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const domain = clean.slice(atIndex + 1);
  return getAllowedLoginDomains().includes(domain);
}

export function buildMicrosoftLoginUrl(origin: string, state: string): string {
  const authUrl = new URL(
    `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", getMicrosoftClientId());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", getMicrosoftLoginRedirectUri(origin));
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", MICROSOFT_AUTH_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  return authUrl.toString();
}

async function fetchMicrosoftToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(
    `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "No se pudo autenticar con Microsoft.",
    );
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

export async function exchangeMicrosoftCodeForAppLogin(
  origin: string,
  code: string,
): Promise<AppSession> {
  const token = await fetchMicrosoftToken(
    new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getMicrosoftLoginRedirectUri(origin),
      scope: MICROSOFT_AUTH_SCOPE,
    }),
  );
  const me = await fetchMicrosoftMe(token.access_token!);
  const email = me.mail?.trim() || me.userPrincipalName?.trim() || "";
  if (!email) {
    throw new Error("Microsoft no devolvió un email válido para iniciar sesión.");
  }
  if (!isAllowedLoginEmail(email)) {
    throw new Error("Tu dominio de email no está autorizado para usar esta app.");
  }

  const now = Date.now();
  const refreshToken = token.refresh_token?.trim();
  if (!refreshToken) {
    throw new Error(
      "Microsoft no devolvió refresh token. Revisá que el login incluya offline_access.",
    );
  }
  return {
    email,
    name: me.displayName?.trim() || email,
    provider: "microsoft",
    issuedAt: now,
    expiresAt: now + getSessionDays() * 24 * 60 * 60 * 1000,
    microsoftRefreshToken: refreshToken,
    microsoftScope: token.scope?.trim() || MICROSOFT_AUTH_SCOPE,
  };
}

function signPayload(payload: string): string {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("Falta APP_AUTH_SECRET en el servidor.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export function createAppSessionToken(session: AppSession): string {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyAppSessionToken(token: string | null | undefined): AppSession | null {
  if (!token) return null;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  let expected = "";
  try {
    expected = signPayload(payload);
  } catch {
    return null;
  }
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AppSession;
    if (
      !parsed ||
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      parsed.provider !== "microsoft" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildRollingSession(session: AppSession): AppSession {
  const now = Date.now();
  return {
    ...session,
    issuedAt: now,
    expiresAt: now + getSessionDays() * 24 * 60 * 60 * 1000,
  };
}

export function getAppSessionCookieMaxAge(): number {
  return getSessionDays() * 24 * 60 * 60;
}

export type PublicAppSession = Omit<
  AppSession,
  "microsoftRefreshToken"
>;

export function toPublicAppSession(session: AppSession): PublicAppSession {
  return {
    email: session.email,
    name: session.name,
    provider: session.provider,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    microsoftScope: session.microsoftScope,
  };
}

export async function refreshMicrosoftAccessTokenForSession(
  session: AppSession,
): Promise<{ accessToken: string; session: AppSession }> {
  const refreshToken = session.microsoftRefreshToken?.trim();
  if (!refreshToken) {
    throw new Error(
      "La sesión actual no tiene permisos de Outlook. Cerrá sesión y volvé a entrar con Microsoft.",
    );
  }

  const token = await fetchMicrosoftToken(
    new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: MICROSOFT_AUTH_SCOPE,
    }),
  );

  const accessToken = token.access_token?.trim();
  if (!accessToken) {
    throw new Error("Microsoft no devolvió access token al refrescar la sesión.");
  }

  const nextRefreshToken = token.refresh_token?.trim() || refreshToken;
  const nextSession: AppSession = {
    ...session,
    microsoftRefreshToken: nextRefreshToken,
    microsoftScope: token.scope?.trim() || session.microsoftScope || MICROSOFT_AUTH_SCOPE,
  };

  return {
    accessToken,
    session: nextSession,
  };
}

export function clearMicrosoftMailFromSession(session: AppSession): AppSession {
  const nextSession = { ...session };
  delete nextSession.microsoftRefreshToken;
  return nextSession;
}
