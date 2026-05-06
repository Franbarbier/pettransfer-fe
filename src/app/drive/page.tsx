import { AppFooterActions } from "@/components/auth/AppFooterActions";
import { SessionKeepAlive } from "@/components/auth/SessionKeepAlive";
import { requireAppSession } from "@/lib/serverAppSession";
import DrivePageClient from "./DrivePageClient";

export default async function DrivePage(): Promise<React.JSX.Element> {
  await requireAppSession("/drive");
  return (
    <div className="flex min-h-screen flex-col bg-white [color-scheme:light]">
      <SessionKeepAlive />
      <div className="flex-1">
        <DrivePageClient />
      </div>
      <AppFooterActions />
    </div>
  );
}
