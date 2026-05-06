"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OutlookMailStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  displayName?: string;
  error?: string;
};

type AppSession = {
  email: string;
  name: string;
  provider: "microsoft";
  issuedAt: number;
  expiresAt: number;
  microsoftScope?: string;
};

export function AppFooterActions(): React.JSX.Element | null {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [outlookStatus, setOutlookStatus] = useState<OutlookMailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession(): Promise<void> {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setSession(null);
          return;
        }
        const data = (await res.json()) as {
          authenticated?: boolean;
          session?: AppSession;
        };
        if (!cancelled) {
          setSession(data.authenticated ? (data.session ?? null) : null);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
        }
      }
    }

    async function loadOutlook(): Promise<void> {
      setLoading(true);
      try {
        const res = await fetch("/api/microsoft/oauth/status", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json()) as OutlookMailStatus;
        if (!cancelled) {
          setOutlookStatus(data);
        }
      } catch {
        if (!cancelled) {
          setOutlookStatus(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void Promise.all([loadSession(), loadOutlook()]);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  async function handleDisconnectOutlook(): Promise<void> {
    setDisconnecting(true);
    try {
      await fetch("/api/microsoft/oauth/disconnect", {
        method: "POST",
        credentials: "include",
      });
      setOutlookStatus((prev) =>
        prev
          ? {
              ...prev,
              connected: false,
              email: undefined,
              displayName: undefined,
            }
          : {
              configured: true,
              connected: false,
            },
      );
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading && !session) {
    return null;
  }

  return (
    <footer className="border-t border-zinc-200 bg-white/90 px-4 py-3 [color-scheme:light]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 text-xs text-zinc-600">
        <div className="min-w-0">
          {session ? (
            <span className="truncate">
              Sesión iniciada como <strong>{session.name}</strong>
              {session.email ? ` · ${session.email}` : ""}
            </span>
          ) : (
            <span>Sin sesión de app.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {outlookStatus?.connected ? (
            <>
              <span className="hidden truncate sm:inline">
                Outlook conectado{outlookStatus.email ? `: ${outlookStatus.email}` : ""}
              </span>
              <button
                type="button"
                onClick={() => void handleDisconnectOutlook()}
                disabled={disconnecting || loggingOut}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disconnecting ? "Desconectando Outlook…" : "Desconectar Outlook"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut || disconnecting}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </footer>
  );
}
