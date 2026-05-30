export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
}

export type EmailTemplateContext = {
  tipo_operacion: "EXPO" | "IMPO";
  tipo_cliente: "retail" | "agente";
  referido_starwood: boolean | null;
  destino_cubierto_latam: boolean | null;
  pais_destino: "argentina" | "mexico" | "otro" | null;
};

export type EmailMergeFields = {
  client_name: string;
  pet_type: string;
  origin_city: string;
  destination_city: string;
  origin_country: string;
  destination_country: string;
  recommended_agent: string;
};

export type ResolvedEmailTemplate = {
  template_code: string;
  body: string;
  cc_recommended_agent: boolean;
};

export async function resolveEmailTemplate(
  context: EmailTemplateContext,
  fields: EmailMergeFields,
): Promise<ResolvedEmailTemplate> {
  const res = await fetch(`${getApiBaseUrl()}/email-templates/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, fields }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof data.error === "string" ? data.error : `Error ${res.status}`);
  }
  return res.json() as Promise<ResolvedEmailTemplate>;
}
