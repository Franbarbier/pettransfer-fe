import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo cotización · Pettransfer",
};

/**
 * Plantilla clara para presentación al cliente: no hereda el esquema oscuro del
 * sistema (`prefers-color-scheme`) en controles ni contraste de texto.
 */
export default function DemoCoti02Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      {children}
    </div>
  );
}
