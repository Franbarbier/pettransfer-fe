"use client";

import dynamic from "next/dynamic";

const DriveContainer = dynamic(
  () =>
    import("@/containers/drive/DriveContainer").then((m) => m.DriveContainer),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-neutral-500">
        Cargando Google Drive…
      </div>
    ),
  },
);

export default function DrivePageClient(): React.JSX.Element {
  return <DriveContainer />;
}
