import type { Metadata } from "next";
import { AppFooterActions } from "@/components/auth/AppFooterActions";
import { SessionKeepAlive } from "@/components/auth/SessionKeepAlive";
import { requireAppSession } from "@/lib/serverAppSession";
import { AdminSidebar } from "./AdminSidebar";

export const metadata: Metadata = {
  title: "Admin · Pettransfer",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireAppSession("/admin");
  return (
    <>
      <div className="flex min-h-screen bg-gray-50 [color-scheme:light]">
        <SessionKeepAlive />
        <AdminSidebar />
        <main className="flex-1 min-h-screen overflow-auto">{children}</main>
      </div>
      <AppFooterActions />
    </>
  );
}
