const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_CREATE_FOLDER_URL = "https://api.dropboxapi.com/2/files/create_folder_v2";
const DROPBOX_MOVE_URL = "https://api.dropboxapi.com/2/files/move_v2";
const DROPBOX_DELETE_URL = "https://api.dropboxapi.com/2/files/delete_v2";
const DROPBOX_LIST_FOLDER_URL = "https://api.dropboxapi.com/2/files/list_folder";
const DROPBOX_LIST_FOLDER_CONTINUE_URL = "https://api.dropboxapi.com/2/files/list_folder/continue";

type DropboxTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  uid?: string;
  account_id?: string;
  error?: string;
  error_description?: string;
};

type DropboxUploadResponse = {
  id: string;
  name: string;
  path_display?: string;
  path_lower?: string;
  size: number;
};

type DropboxMetadataResponse = {
  id: string;
  name: string;
  path_display?: string;
  path_lower?: string;
  ".tag"?: string;
};

export type DropboxUploadResult = {
  id: string;
  name: string;
  pathDisplay: string | null;
  pathLower: string | null;
  size: number;
};

export type DropboxListEntry = {
  tag: string;
  name: string;
  pathDisplay: string | null;
};

export type DropboxPathResult = {
  id: string;
  name: string;
  pathDisplay: string | null;
  pathLower: string | null;
  tag: string | null;
};

type UploadPdfInput = {
  buffer: Buffer;
  filename: string;
  folderPath?: string;
};

function getDropboxAppKey(): string {
  return process.env.DROPBOX_APP_KEY?.trim() || "";
}

function getDropboxAppSecret(): string {
  return process.env.DROPBOX_APP_SECRET?.trim() || "";
}

function getDropboxRefreshToken(): string {
  return process.env.DROPBOX_REFRESH_TOKEN?.trim() || "";
}

function getDropboxBaseFolder(): string {
  return process.env.DROPBOX_QUOTES_FOLDER?.trim() || "/Cotizaciones";
}

export function isDropboxConfigured(): boolean {
  return Boolean(
    getDropboxAppKey() &&
      getDropboxAppSecret() &&
      getDropboxRefreshToken(),
  );
}

export function getDropboxConfigError(): string | null {
  if (!getDropboxAppKey()) return "Falta DROPBOX_APP_KEY.";
  if (!getDropboxAppSecret()) return "Falta DROPBOX_APP_SECRET.";
  if (!getDropboxRefreshToken()) return "Falta DROPBOX_REFRESH_TOKEN.";
  return null;
}

function sanitizeDropboxPathPart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"|?*\\]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\/+/g, "-");
}

function normalizeDropboxFolderPath(folderPath?: string): string {
  const raw = folderPath?.trim() || getDropboxBaseFolder();
  const cleaned = raw.replace(/\/+$/, "");
  if (!cleaned || cleaned === "/") return "";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

function buildDropboxTargetPath(filename: string, folderPath?: string): string {
  const safeFilename = sanitizeDropboxPathPart(filename);
  const baseFolder = normalizeDropboxFolderPath(folderPath);
  return baseFolder ? `${baseFolder}/${safeFilename}` : `/${safeFilename}`;
}

function normalizeDropboxPath(pathValue: string): string {
  const trimmed = pathValue.trim();
  const cleaned = trimmed.replace(/\/+$/, "");
  if (!cleaned || cleaned === "/") {
    throw new Error("La ruta de Dropbox no puede estar vacía.");
  }
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

async function refreshDropboxAccessToken(): Promise<string> {
  const appKey = getDropboxAppKey();
  const appSecret = getDropboxAppSecret();
  const refreshToken = getDropboxRefreshToken();

  const auth = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json()) as DropboxTokenResponse;
  if (!response.ok || !data.access_token) {
    const detail =
      data.error_description || data.error || `Dropbox token error ${response.status}`;
    throw new Error(detail);
  }

  return data.access_token;
}

async function postDropboxJson<TResponse extends object>(
  url: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const configError = getDropboxConfigError();
  if (configError) throw new Error(configError);

  const accessToken = await refreshDropboxAccessToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as
    | TResponse
    | { error_summary?: string };

  if (!response.ok) {
    const detail =
      "error_summary" in data && typeof data.error_summary === "string"
        ? data.error_summary
        : `Dropbox API error ${response.status}`;
    throw new Error(detail);
  }

  return data as TResponse;
}

function toDropboxPathResult(metadata: DropboxMetadataResponse): DropboxPathResult {
  return {
    id: metadata.id,
    name: metadata.name,
    pathDisplay: metadata.path_display ?? null,
    pathLower: metadata.path_lower ?? null,
    tag: metadata[".tag"] ?? null,
  };
}

export async function createDropboxFolder(folderPath: string): Promise<DropboxPathResult> {
  const path = normalizeDropboxPath(folderPath);
  const data = await postDropboxJson<{ metadata: DropboxMetadataResponse }>(
    DROPBOX_CREATE_FOLDER_URL,
    {
      path,
      autorename: false,
    },
  );

  return toDropboxPathResult(data.metadata);
}

type ListFolderPage = {
  entries: Array<{ ".tag": string; name: string; path_display?: string }>;
  cursor: string;
  has_more: boolean;
};

export async function listDropboxFolder(folderPath: string): Promise<DropboxListEntry[]> {
  const path = normalizeDropboxPath(folderPath);
  const all: DropboxListEntry[] = [];

  let page = await postDropboxJson<ListFolderPage>(DROPBOX_LIST_FOLDER_URL, {
    path,
    recursive: false,
  });

  while (true) {
    for (const e of page.entries) {
      all.push({ tag: e[".tag"], name: e.name, pathDisplay: e.path_display ?? null });
    }
    if (!page.has_more) break;
    page = await postDropboxJson<ListFolderPage>(DROPBOX_LIST_FOLDER_CONTINUE_URL, {
      cursor: page.cursor,
    });
  }

  return all;
}

export async function moveDropboxPath(
  fromPath: string,
  toPath: string,
): Promise<DropboxPathResult> {
  const from = normalizeDropboxPath(fromPath);
  const to = normalizeDropboxPath(toPath);
  const data = await postDropboxJson<{ metadata: DropboxMetadataResponse }>(
    DROPBOX_MOVE_URL,
    {
      from_path: from,
      to_path: to,
      allow_shared_folder: true,
      autorename: false,
      allow_ownership_transfer: false,
    },
  );

  return toDropboxPathResult(data.metadata);
}

export async function deleteDropboxPath(path: string): Promise<DropboxPathResult> {
  const normalizedPath = normalizeDropboxPath(path);
  const data = await postDropboxJson<{ metadata: DropboxMetadataResponse }>(
    DROPBOX_DELETE_URL,
    { path: normalizedPath },
  );
  return toDropboxPathResult(data.metadata);
}

export async function uploadPdfToDropbox({
  buffer,
  filename,
  folderPath,
}: UploadPdfInput): Promise<DropboxUploadResult> {
  const configError = getDropboxConfigError();
  if (configError) throw new Error(configError);

  const accessToken = await refreshDropboxAccessToken();
  const targetPath = buildDropboxTargetPath(filename, folderPath);

  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: targetPath,
        mode: "add",
        autorename: true,
        mute: false,
        strict_conflict: false,
      }),
    },
    body: new Uint8Array(buffer),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as
    | DropboxUploadResponse
    | { error_summary?: string };

  if (!response.ok || !("id" in data)) {
    const detail =
      "error_summary" in data && typeof data.error_summary === "string"
        ? data.error_summary
        : `Dropbox upload error ${response.status}`;
    throw new Error(detail);
  }

  return {
    id: data.id,
    name: data.name,
    pathDisplay: data.path_display ?? null,
    pathLower: data.path_lower ?? null,
    size: data.size,
  };
}
