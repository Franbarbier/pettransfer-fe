"use client";

import { getGapi } from "@/lib/gapiDrive";
import { gatherCotizacionMetasOAuth } from "@/lib/driveCotizacionesOAuth";

type Props = {
  rootFolderId: string | undefined;
  disabled: boolean;
};

export function CotizacionesFiltradasConsolaButton({
  rootFolderId,
  disabled,
}: Props): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void runLog(rootFolderId)}
      className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-neutral-600"
    >
      Cotizaciones filtradas (consola)
    </button>
  );
}

async function runLog(rootFolderId: string | undefined): Promise<void> {
  const gapi = getGapi();
  if (!gapi?.client?.getToken?.()?.access_token) {
    console.warn("[cotizaciones] Sin token OAuth.");
    return;
  }
  try {
    const metas = await gatherCotizacionMetasOAuth(rootFolderId);
    console.log(
      "[cotizaciones filtradas]",
      metas.length,
      "archivo(s) elegido(s) (regla cot impo / cot expo / cot…transit, Excel o PDF).",
    );
    console.table(
      metas.map((m) => ({
        id: m.id,
        name: m.name,
        mimeType: m.mimeType ?? "",
        modifiedTime: m.modifiedTime ?? "",
      })),
    );
  } catch (e: unknown) {
    console.error("[cotizaciones filtradas]", e);
  }
}
