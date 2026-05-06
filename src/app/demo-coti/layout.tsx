import type { Metadata } from "next";
import { AppFooterActions } from "@/components/auth/AppFooterActions";
import { SessionKeepAlive } from "@/components/auth/SessionKeepAlive";
import { requireAppSession } from "@/lib/serverAppSession";

export const metadata: Metadata = {
  title: "Demo cotización · Pettransfer",
};

/**
 * Plantilla clara para presentación al cliente: no hereda el esquema oscuro del
 * sistema (`prefers-color-scheme`) en controles ni contraste de texto.
 */
export default async function DemoCoti02Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  await requireAppSession("/demo-coti");
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 [color-scheme:light]">
      <SessionKeepAlive />
      <div className="flex-1">{children}</div>
      <AppFooterActions />
    </div>
  );
}
