import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app-shell";
import { getDashboard } from "@/lib/dashboard.functions";

const DESC = "Workspace health at a glance: total cards, overdue work, average time per card and who carries the most.";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Meridian" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Dashboard — Meridian" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "late" | "volt" | undefined }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-mist">{label}</p>
      <p
        className={`mt-2 font-display text-4xl font-bold tracking-tight ${
          tone === "late" ? "text-destructive" : tone === "volt" ? "text-volt" : "text-ice"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-mist">{hint}</p>
    </div>
  );
}

const days = (n: number | null) => (n === null ? "—" : `${n}d`);

function DashboardPage() {
  const { workspaceId } = Route.useParams();
  const fetchDashboard = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard", workspaceId], queryFn: () => fetchDashboard({ data: { workspaceId } }) });

  const back = (
    <Link to="/workspaces/$workspaceId" params={{ workspaceId }} className="text-[11px] uppercase tracking-[0.16em] text-mist hover:text-ice">
      ← Workspace
    </Link>
  );

  if (q.isPending) {
    return (
      <AppShell eyebrow="Workspace · Dashboard">
        <div className="h-9 w-56 animate-pulse rounded bg-line" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-panel h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <AppShell eyebrow="Workspace · Dashboard">
        {back}
        <div className="glass-panel rounded-2xl p-6">
          <h1 className="font-display text-xl font-semibold">We couldn't load the dashboard</h1>
          <p className="mt-2 text-sm text-mist">{q.error instanceof Error ? q.error.message : "Please try again."}</p>
          <button onClick={() => q.refetch()} className="mt-5 rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink">
            Try again
          </button>
        </div>
      </AppShell>
    );
  }

  const d = q.data;
  const top = d.topAssignees[0];
  const max = Math.max(1, ...d.topAssignees.map((a) => a.count));

  return (
    <AppShell eyebrow="Workspace · Dashboard">
      <div>
        {back}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{d.workspaceName}</h1>
      </div>

      {d.totalCards === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <h2 className="font-display text-lg font-semibold">No cards yet</h2>
          <p className="mt-2 text-sm text-mist">Add cards to a board and the numbers will show up here.</p>
          <Link
            to="/workspaces/$workspaceId/boards"
            params={{ workspaceId }}
            className="mt-5 inline-block rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt"
          >
            Go to boards
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total cards" value={String(d.totalCards)} hint={`${d.doneCards} done across ${d.boards.length} boards`} />
            <Stat
              label="Overdue"
              value={String(d.overdue)}
              hint="Open cards past their due date"
              tone={d.overdue > 0 ? "late" : undefined}
            />
            <Stat
              label="Avg time per card"
              value={d.avgDaysToDone !== null ? days(d.avgDaysToDone) : days(d.avgOpenAgeDays)}
              hint={
                d.avgDaysToDone !== null
                  ? `From created to done · open cards average ${days(d.avgOpenAgeDays)}`
                  : "Nothing finished yet · average age of open cards"
              }
            />
            <Stat
              label="Assigned most"
              value={top ? (top.name.split(" ")[0] ?? top.name) : "—"}
              hint={top ? `${top.count} card${top.count === 1 ? "" : "s"} · ${d.unassigned} unassigned` : "Nobody is assigned yet"}
              tone="volt"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="font-display text-sm font-semibold">Workload by person</h2>
              {d.topAssignees.length === 0 ? (
                <p className="mt-3 text-sm text-mist">Assign cards to see who's carrying what.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {d.topAssignees.map((a) => (
                    <li key={a.name}>
                      <div className="flex justify-between text-xs">
                        <span className="text-ice">{a.name}</span>
                        <span className="text-mist">{a.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-frost">
                        <div className="h-full rounded-full bg-volt" style={{ width: `${(a.count / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="font-display text-sm font-semibold">Boards</h2>
              <ul className="mt-3 divide-y divide-border">
                {d.boards.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                    <Link to="/workspaces/$workspaceId/boards/$boardId" params={{ workspaceId, boardId: b.id }} className="hover:text-volt">
                      {b.name}
                    </Link>
                    <span className="text-xs text-mist">
                      {b.total} cards · {b.done} done
                      {b.overdue > 0 && <span className="text-destructive"> · {b.overdue} overdue</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <p className="text-[11px] text-mist">A card counts as done when it sits in the last column of its board.</p>
        </>
      )}
    </AppShell>
  );
}
