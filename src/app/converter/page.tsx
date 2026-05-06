import { AppFooterActions } from "@/components/auth/AppFooterActions";
import { SessionKeepAlive } from "@/components/auth/SessionKeepAlive";
import { requireAppSession } from "@/lib/serverAppSession";
import { ConverterContainer } from "@/containers/converter/ConverterContainer";

export default async function ConverterPage(): Promise<React.JSX.Element> {
  await requireAppSession("/converter");
  return (
    <div className="flex min-h-screen flex-col bg-white [color-scheme:light]">
      <SessionKeepAlive />
      <div className="flex-1">
        <ConverterContainer />
      </div>
      <AppFooterActions />
    </div>
  );
}
