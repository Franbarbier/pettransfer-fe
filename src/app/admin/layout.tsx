import type { Metadata } from "next";
import { AdminSidebar } from "./AdminSidebar";

export const metadata: Metadata = {
  title: "Admin · Pettransfer",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 [color-scheme:light]">
      <AdminSidebar />
      <main className="flex-1 min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
