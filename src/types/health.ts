export type ApiHealthResult =
  | { ok: true; payload: unknown }
  | { ok: false };
