type DropboxCallbackPageProps = {
  searchParams: Promise<{
    code?: string;
    error?: string;
    error_description?: string;
  }>;
};

export default async function DropboxCallbackPage({
  searchParams,
}: DropboxCallbackPageProps) {
  const params = await searchParams;
  const code = params.code?.trim() ?? "";
  const error = params.error?.trim() ?? "";
  const errorDescription = params.error_description?.trim() ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Dropbox callback</h1>
        <p className="text-sm text-neutral-600">
          Esta pantalla existe para capturar el resultado de la autorizacion de
          Dropbox sin caer en un 404.
        </p>
      </div>

      {error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Dropbox devolvio un error</p>
          <p>{error}</p>
          {errorDescription ? <p>{errorDescription}</p> : null}
        </section>
      ) : null}

      {code ? (
        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-neutral-900">
            Codigo de autorizacion recibido
          </p>
          <pre className="overflow-x-auto rounded-md bg-neutral-950 p-3 text-sm text-neutral-100">
            <code>{code}</code>
          </pre>
          <p className="text-sm text-neutral-600">
            Copialo y canjealo enseguida por el `refresh_token`, porque vence
            rapido y sirve una sola vez.
          </p>
        </section>
      ) : null}

      {!error && !code ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No llego ningun `code` en la URL. Revisa que el flujo OAuth de
          Dropbox haya redirigido a esta ruta con `?code=...`.
        </section>
      ) : null}
    </main>
  );
}
