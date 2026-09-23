import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { KineticBackground } from "@/components/kinetic-background";
import { ROLE_COPY } from "@/components/role-badge";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/workspaces.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meridian — Kanban workspaces with real roles" },
      {
        name: "description",
        content:
          "Create a workspace, invite your team as owners, editors or viewers, and keep every board scoped to the people who belong there.",
      },
      { property: "og:title", content: "Meridian — Kanban workspaces with real roles" },
      {
        property: "og:description",
        content:
          "Create a workspace, invite your team as owners, editors or viewers, and keep every board scoped to the people who belong there.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    return () => {
      active = false;
    };
  }, []);

  const roles: Role[] = ["owner", "editor", "viewer"];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <KineticBackground />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-volt/30 bg-volt/10 font-display text-lg font-bold text-volt">
              M
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-none tracking-tight">Meridian</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-mist">Workspaces · Roles</p>
            </div>
          </div>
          <Link
            to={signedIn ? "/workspaces" : "/auth"}
            className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px"
          >
            {signedIn ? "Open workspaces" : "Sign in"}
          </Link>
        </header>

        <div className="mt-8 max-w-2xl">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Kanban that respects who's in the room
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-mist sm:text-base">
            Spin up a workspace, seat your team as owners, editors or viewers, and every board stays scoped to the
            people who belong there — enforced in the database, not just the interface.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              to={signedIn ? "/workspaces" : "/auth"}
              className="rounded-xl bg-volt px-5 py-2.5 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px"
            >
              {signedIn ? "Go to your workspaces" : "Create your workspace"}
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {roles.map((role) => (
            <section key={role} className="glass-panel rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`size-2.5 rounded-full bg-role-${role}`} />
                <span className="font-display text-sm font-semibold">{ROLE_COPY[role].label}</span>
                <span className="ml-auto rounded-md bg-frost px-2 py-0.5 text-xs text-mist">
                  {ROLE_COPY[role].short}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-mist">{ROLE_COPY[role].detail}</p>
            </section>
          ))}
        </div>

        <div className="glass-panel mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-mist">
          <span className="grid size-6 place-items-center rounded-md bg-positive/15 text-positive">✓</span>
          Boards, columns and cards land next — workspaces and roles are live now.
          <span className="ml-auto rounded-md border border-volt/30 bg-volt/10 px-2 py-0.5 font-medium text-volt">
            Access enforced per workspace
          </span>
        </div>
      </div>
    </div>
  );
}
