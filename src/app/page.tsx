import { redirect } from "next/navigation";

import { getCurrentAppSession } from "@/lib/serverAppSession";

export default async function Page(): Promise<React.JSX.Element> {
  const session = await getCurrentAppSession();
  redirect(session ? "/demo-coti" : "/login");
}
