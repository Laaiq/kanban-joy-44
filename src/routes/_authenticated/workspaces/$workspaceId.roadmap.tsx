import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app-shell";
import { getRoadmap, type RoadmapItem } from "@/lib/boards.functions";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — Meridian" },
      {
        name: "description",
        content: "Every board and card in this Meridian workspace on one timeline, grouped by when work is due.",
      },
      { property: "og:title", content: "Roadmap — Meridian" },
      {
        property: "og:description",
        content: "Every board and card in this Meridian workspace on one timeline, grouped by when work is due.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoadmapPage,
});

type Bucket = { key: string; label: string; hint: string; items: RoadmapItem[]; tone: "late" | "soon" | "calm" };

function bucketise(items: RoadmapItem[]): Bucket[] {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const todayIso = iso(today);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const buckets: Bucket[] = [
    { key: "overdue", label: "Overdue", hint: "Past its due date", items: [], tone: "late" },
    { key: "week", label: "Next 7 days", hint: "Due this week", items: [], tone: "soon" },
    { key: "month", label: "Next 30 days", hint: "Coming up", items: [], tone: "calm" },
    { key: "later", label: "Later", hint: "Dated beyond 30 days", items: [], tone: "calm" },
    { key: "undated", label: "No date yet", hint: "Needs a due date", items: [], tone: "calm" },
  ];
  const find = (key: string) => buckets.find((b) => b.key === key)!;

  for (const item of items) {
    if (!item.dueDate) find("undated").items.push(item);
    else if (item.dueDate < todayIso) find("overdue").items.push(item);
    else if (item.dueDate <= iso(in7)) find("week").items.push(item);
    else if (item.dueDate <= iso(in30)) find("month").items.push(item);
    else find("later").items.push(item);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RoadmapPage() {
  const { workspaceId } = Route.useParams();
  const fetchRoadmap = useServerFn(getRoadmap);
  const roadmap = useQuery({
    queryKey: ["roadmap", workspaceId],
    queryFn: () => fetchRoadmap({ data: { workspaceId } }),
  });

  if (roadmap.isPending) {
    return (
      <AppShell eyebrow="Workspace · Roadmap">
        <div className="h-9 w-52 animate-pulse rounded bg-line" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (roadmap.isError || !roadmap.data) {
    return (
      <AppShell eyebrow="Workspace · Roadmap">
        <div className="glass-panel rounded-2xl border-destructive/40 p-6">
          <h1 className="font-display text-xl font-semibold">We couldn't build the timeline</h1>
          <p className="mt-2 text-sm text-mist">
            {roadmap.error instanceof Error ? roadmap.error.message : "Please try again."}
          </p>
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId }}
            className="mt-5 inline-block rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink"
          >
            Back to workspace
          </Link>
        </div>
      </AppShell>
    );
  }

  const data = roadmap.data;
  const buckets = bucketise(data.items);
  const dated = data.items.filter((item) => item.dueDate).length;

  return (
    <AppShell eyebrow="Workspace · Roadmap">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId }}
            className="text-[11px] uppercase tracking-[0.16em] text-mist hover:text-ice"
          >
            ← {data.workspaceName}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Roadmap</h1>
          <p className="mt-2 text-sm text-mist">
            {data.boards.length} board{data.boards.length === 1 ? "" : "s"} · {data.items.length} card
            {data.items.length === 1 ? "" : "s"} · {dated} with a date
          </p>
        </div>
        <Link
          to="/workspaces/$workspaceId/boards"
          params={{ workspaceId }}
          className="rounded-xl border border-volt/40 bg-volt/10 px-3.5 py-2 text-sm font-semibold text-volt"
        >
          All boards
        </Link>
      </div>

      {data.boards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.boards.map((board) => (
            <Link
              key={board.id}
              to="/workspaces/$workspaceId/boards/$boardId"
              params={{ workspaceId, boardId: board.id }}
              className="glass-panel rounded-xl px-3 py-2 text-xs text-mist hover:text-ice"
            >
              <span className="font-medium text-ice">{board.name}</span> · {board.cardCount} card
              {board.cardCount === 1 ? "" : "s"}
              {board.nextDue ? ` · next ${formatDate(board.nextDue)}` : ""}
            </Link>
          ))}
        </div>
      )}

      {data.items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Nothing on the timeline yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            {data.boards.length === 0
              ? "Create a board and add cards with due dates — they'll line up here automatically."
              : "Add due dates to cards and they'll appear here, grouped by how soon they land."}
          </p>
          <Link
            to="/workspaces/$workspaceId/boards"
            params={{ workspaceId }}
            className="mt-5 inline-block rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt"
          >
            Go to boards
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {buckets.map((bucket) => (
            <section key={bucket.key} className="glass-panel rounded-2xl p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={
                    bucket.tone === "late"
                      ? "rounded-md bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive"
                      : bucket.tone === "soon"
                        ? "rounded-md bg-volt/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt"
                        : "rounded-md bg-frost px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist"
                  }
                >
                  {bucket.label}
                </span>
                <span className="text-[11px] text-mist">{bucket.hint}</span>
                <span className="ml-auto rounded-md bg-frost px-2 py-0.5 text-xs text-mist">
                  {bucket.items.length}
                </span>
              </div>

              <ol className="relative space-y-2 border-l border-border/70 pl-4">
                {bucket.items.map((item) => (
                  <li key={item.cardId} className="relative rounded-xl border border-border bg-ink2/60 p-3">
                    <span
                      className={
                        bucket.tone === "late"
                          ? "absolute -left-[22px] top-4 size-2 rounded-full bg-destructive"
                          : "absolute -left-[22px] top-4 size-2 rounded-full bg-volt"
                      }
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium">{item.title}</h3>
                      <span
                        className={
                          bucket.tone === "late"
                            ? "text-[11px] font-semibold text-destructive"
                            : "text-[11px] font-semibold text-volt"
                        }
                      >
                        {item.dueDate ? formatDate(item.dueDate) : "No date"}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-mist">{item.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-mist">
                      <Link
                        to="/workspaces/$workspaceId/boards/$boardId"
                        params={{ workspaceId, boardId: item.boardId }}
                        className="text-ice hover:text-volt"
                      >
                        {item.boardName}
                      </Link>
                      <span>· {item.columnName}</span>
                      <span>· {item.assigneeName ?? "Unassigned"}</span>
                      {item.labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-volt"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
