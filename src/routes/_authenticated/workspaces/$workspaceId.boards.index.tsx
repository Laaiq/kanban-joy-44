import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { createBoard, listBoards } from "@/lib/boards.functions";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/boards/")({
  head: () => ({
    meta: [
      { title: "Boards — Meridian" },
      { name: "description", content: "Every board in this Meridian workspace, with card counts and next deadlines." },
      { property: "og:title", content: "Boards — Meridian" },
      {
        property: "og:description",
        content: "Every board in this Meridian workspace, with card counts and next deadlines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardsPage,
});

function BoardsPage() {
  const { workspaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchBoards = useServerFn(listBoards);
  const make = useServerFn(createBoard);
  const [name, setName] = useState("");

  const queryKey = ["boards", workspaceId];
  const boards = useQuery({ queryKey, queryFn: () => fetchBoards({ data: { workspaceId } }) });

  const createMutation = useMutation({
    mutationFn: () => make({ data: { workspaceId, name: name.trim() } }),
    onSuccess: async () => {
      toast.success("Board created", { description: "Four starter columns are ready for cards." });
      setName("");
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["roadmap", workspaceId] });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't create the board", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  const canEdit = boards.data?.myRole === "owner" || boards.data?.myRole === "editor";

  return (
    <AppShell eyebrow="Workspace · Boards">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId }}
            className="text-[11px] uppercase tracking-[0.16em] text-mist hover:text-ice"
          >
            ← Workspace
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Boards</h1>
          <p className="mt-2 text-sm text-mist">Each board holds its own columns and cards.</p>
        </div>
        <Link
          to="/workspaces/$workspaceId/roadmap"
          params={{ workspaceId }}
          className="rounded-xl border border-volt/40 bg-volt/10 px-3.5 py-2 text-sm font-semibold text-volt"
        >
          Roadmap
        </Link>
      </div>

      {canEdit && (
        <form
          className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 2) return;
            createMutation.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New board name"
            maxLength={80}
            className="min-w-48 flex-1 rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || name.trim().length < 2}
            className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create board"}
          </button>
        </form>
      )}

      {boards.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {boards.isError && (
        <div className="glass-panel rounded-2xl border-destructive/40 p-6">
          <h2 className="font-display text-lg font-semibold">We couldn't load the boards</h2>
          <p className="mt-2 text-sm text-mist">
            {boards.error instanceof Error ? boards.error.message : "Please try again."}
          </p>
        </div>
      )}

      {boards.data && boards.data.boards.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <h2 className="font-display text-xl font-semibold">No boards yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            {canEdit
              ? "Create your first board above, or turn a project brief into one from the workspace page."
              : "An owner or editor needs to create the first board."}
          </p>
        </div>
      )}

      {boards.data && boards.data.boards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.data.boards.map((board) => (
            <Link
              key={board.id}
              to="/workspaces/$workspaceId/boards/$boardId"
              params={{ workspaceId, boardId: board.id }}
              className="glass-panel rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
            >
              <h2 className="font-display text-lg font-semibold">{board.name}</h2>
              {board.description && <p className="mt-1 line-clamp-2 text-xs text-mist">{board.description}</p>}
              <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-mist">
                {board.cardCount} card{board.cardCount === 1 ? "" : "s"}
                {board.nextDue ? ` · next ${board.nextDue}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
