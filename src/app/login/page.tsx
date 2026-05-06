import Link from "next/link";
import { redirect } from "next/navigation";

import { getAllowedLoginDomains } from "@/lib/appAuth";
import { getCurrentAppSession } from "@/lib/serverAppSession";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const session = await getCurrentAppSession();
  const params = (await searchParams) ?? {};
  const returnToRaw = getSingleParam(params, "returnTo");
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/demo-coti";

  if (session) {
    redirect(returnTo);
  }

  const error = getSingleParam(params, "error");
  const allowedDomains = getAllowedLoginDomains();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f4ead7_0%,#f7f3eb_36%,#f5f4f0_100%)] px-6 py-12 text-zinc-900">
      <div className="w-full max-w-md rounded-[28px] border border-[#dcc9a4] bg-white/90 p-8 shadow-[0_24px_80px_rgba(55,37,8,0.10)] backdrop-blur">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a7a39]">
            Pettransfer
          </p>
          <h1 className="mt-2 font-[family:var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Entrás con tu cuenta de Microsoft. La app solo permite dominios autorizados.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <a
          href={`/api/auth/microsoft/start?returnTo=${encodeURIComponent(returnTo)}`}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1f2937] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#111827]"
        >
          Entrar con Outlook / Microsoft
        </a>

        <div className="mt-6 rounded-2xl border border-[#eadcc1] bg-[#fbf8f1] px-4 py-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">Dominios permitidos</p>
          <p className="mt-1">
            {allowedDomains.map((domain) => `@${domain}`).join(", ")}
          </p>
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          Si tu mail tiene dominio correcto pero no te deja entrar, probablemente haya que revisar la configuración de Microsoft o el redirect URI.
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/" className="underline underline-offset-2">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
