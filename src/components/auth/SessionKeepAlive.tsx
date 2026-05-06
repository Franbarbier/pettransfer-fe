"use client";

import { useEffect } from "react";

export function SessionKeepAlive(): null {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // noop
    });
    return () => controller.abort();
  }, []);

  return null;
}
