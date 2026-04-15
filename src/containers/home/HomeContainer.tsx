import Link from "next/link";
import { ApiHealthStatus } from "@/components/api-health-status";
import { fetchApiHealth, getApiBaseUrl } from "@/services";

export async function HomeContainer(): Promise<React.JSX.Element> {
  const health = await fetchApiHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href="/drive"
          className="text-blue-600 underline dark:text-blue-400"
        >
          Google Drive (listado)
        </Link>
        <Link
          href="/converter"
          className="text-blue-600 underline dark:text-blue-400"
        >
          Converter (.xls → .xlsx / JSON)
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Pettransfer
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Next.js + Tailwind en el front; Express en{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">
          {getApiBaseUrl()}
        </code>
        .
      </p>
      <ApiHealthStatus health={health} />
    </main>
  );
}
