import type { ApiHealthResult } from "@/types/health";

type ApiHealthStatusProps = {
  health: ApiHealthResult;
};

export function ApiHealthStatus({
  health,
}: ApiHealthStatusProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm font-medium">Estado de la API</p>
      {health.ok ? (
        <pre className="mt-2 overflow-x-auto font-mono text-xs text-emerald-600 dark:text-emerald-400">
          {JSON.stringify(health.payload, null, 2)}
        </pre>
      ) : (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          No responde. ¿Corriste{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            npm run dev
          </code>{" "}
          en <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">api/</code>?
        </p>
      )}
    </div>
  );
}
