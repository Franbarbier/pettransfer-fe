import type { DriveFileItem } from "@/types/drive";

type GapiClient = {
  init: (args: { discoveryDocs: string[] }) => Promise<void>;
  getToken: () => { access_token: string } | null;
  setToken: (token: string | null | "") => void;
};

type GapiWindow = Window & {
  gapi?: {
    load: (api: string, cb: () => void) => void;
    client: GapiClient;
  };
};

export function getGapi(): GapiWindow["gapi"] | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as GapiWindow).gapi;
}

type DriveFilesListFn = (
  p: Record<string, unknown>,
) => Promise<{
  result?: { files?: DriveFileItem[]; nextPageToken?: string };
}>;

/** Lista paginada; requiere gapi init + token (mismo cliente que `useGoogleDrive`). */
export function getGapiDriveListOrNull(): DriveFilesListFn | null {
  const gapi = getGapi() as unknown as {
    client?: { drive?: { files?: { list: DriveFilesListFn } } };
  };
  const list = gapi?.client?.drive?.files?.list;
  const filesObj = gapi?.client?.drive?.files;
  if (!list || !filesObj) return null;
  return list.bind(filesObj) as DriveFilesListFn;
}
