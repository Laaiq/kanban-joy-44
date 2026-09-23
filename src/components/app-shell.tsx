import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { KineticBackground } from "@/components/kinetic-background";
import { supabase } from "@/integrations/supabase/client";

export function initials(name: string | null | undefined, fallback = "··") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

export function AppShell({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <KineticBackground />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
        <header className="flex items-center justify-between">
          <Link to="/workspaces" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-volt/30 bg-volt/10 font-display text-lg font-bold text-volt">
              M
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-none tracking-tight">Meridian</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-mist">{eyebrow}</p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-xl border border-border bg-frost/60 px-4 py-2 text-sm font-medium text-mist backdrop-blur-xl transition-colors hover:text-ice"
          >
            Sign out
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
