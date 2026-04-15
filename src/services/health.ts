import type { ApiHealthResult } from "@/types/health";
import { getApiBaseUrl } from "./api";

export async function fetchApiHealth(): Promise<ApiHealthResult> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false };
    }
    const payload: unknown = await res.json();
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}
