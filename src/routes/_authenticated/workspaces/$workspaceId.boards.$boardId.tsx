import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { createColumn, deleteCard, getBoard, type BoardDetail, type Card } from "@/lib/boards.functions";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId/boards/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — Meridian" },
      { name: "description", content: "Columns and cards for this Meridian board, with assignees and due dates." },
      { property: "og:title", content: "Board — Meridian" },
      {
        property: "og:description",
        content: "Columns and cards for this Meridian board, with assignees and due dates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { workspaceId, boardId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchBoard = useServerFn(getBoard);
  const addColumn = useServerFn(createColumn);
  const dropCard = useServerFn(deleteCard);

  const [dialog, setDialog] = useState<{ columnId: string; card: Card | null } | null>(null);
  const [columnName, setColumnName] = useState("");

  const queryKey = ["board", boardId];
  const board = useQuery({ queryKey, queryFn: () => fetchBoard({ data: { boardId } }) });

  const columnMutation = useMutation({
    mutationFn: () => addColumn({ data: { boardId, name: columnName.trim() } }),
    onSuccess: async () => {
      toast.success("Column added");
      setColumnName("");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't add the column", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (cardId: string) => dropCard({ data: { cardId } }),
    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<BoardDetail>(queryKey, {
          ...previous,
          columns: previous.columns.map((column) => ({
            ...column,
            cards: column.cards.filter((card) => card.id !== cardId),
          })),
        });
      }
      return { previous };
    },
    onError: (error, _cardId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Card not deleted", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
    onSuccess: () => toast.success("Card deleted"),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["roadmap", workspaceId] });
    },
  });

  if (board.isPending) {
    return (
      <AppShell eyebrow="Workspace · Board">
        <div className="h-9 w-56 animate-pulse rounded bg-line" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-64 animate-pulse rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (board.isError || !board.data) {
    return (
      <AppShell eyebrow="Workspace · Board">
        <div className="glass-panel rounded-2xl border-destructive/40 p-6">
          <h1 className="font-display text-xl font-semibold">We couldn't open this board</h1>
          <p className="mt-2 text-sm text-mist">
            {board.error instanceof Error ? board.error.message : "Please try again."}
          </p>
          <Link
            to="/workspaces/$workspaceId/boards"
            params={{ workspaceId }}
            className="mt-5 inline-block rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink"
          >
            Back to boards
          </Link>
        </div>
      </AppShell>
    );
  }

  const data = board.data;
  const canEdit = data.myRole === "owner" || data.myRole === "editor";

  return (
    <AppShell eyebrow="Workspace · Board">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/workspaces/$workspaceId/boards"
            params={{ workspaceId }}
            className="text-[11px] uppercase tracking-[0.16em] text-mist hover:text-ice"
          >
            ← All boards
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{data.name}</h1>
          {data.description && <p className="mt-2 text-sm text-mist">{data.description}</p>}
        </div>
        <Link
          to="/workspaces/$workspaceId/roadmap"
          params={{ workspaceId }}
          className="rounded-xl border border-volt/40 bg-volt/10 px-3.5 py-2 text-sm font-semibold text-volt"
        >
          Roadmap
        </Link>
      </div>

      {!canEdit && (
        <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-mist">
          <span className="grid size-6 place-items-center rounded-md bg-volt/15 text-volt">i</span>
          You have view-only access to this board.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.columns.map((column) => (
          <section key={column.id} className="glass-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-semibold">{column.name}</span>
              <span className="rounded-md bg-frost px-2 py-0.5 text-xs text-mist">{column.cards.length}</span>
            </div>

            <div className="space-y-2">
              {column.cards.length === 0 && (
                <p className="rounded-xl border border-dashed border-border/70 p-3 text-center text-[11px] text-mist">
                  Nothing here yet
                </p>
              )}
              {column.cards.map((card) => (
                <article key={card.id} className="rounded-xl border border-border bg-ink2/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium leading-snug">{card.title}</h3>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => setDialog({ columnId: column.id, card })}
                          className="rounded-md px-1.5 text-[11px] text-mist hover:text-volt"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(card.id)}
                          className="rounded-md px-1.5 text-[11px] text-mist hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  {card.description && <p className="mt-1 text-[11px] leading-relaxed text-mist">{card.description}</p>}
                  {card.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[10px] text-volt"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-mist">
                    {card.assigneeName ?? "Unassigned"}
                    {card.dueDate ? ` · due ${card.dueDate}` : ""}
                  </p>
                </article>
              ))}
            </div>

            {canEdit && (
              <button
                onClick={() => setDialog({ columnId: column.id, card: null })}
                className="mt-3 w-full rounded-xl border border-volt/30 bg-volt/10 py-2 text-xs font-semibold text-volt"
              >
                + Add card
              </button>
            )}
          </section>
        ))}
      </div>

      {canEdit && (
        <form
          className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!columnName.trim()) return;
            columnMutation.mutate();
          }}
        >
          <input
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            placeholder="New column name"
            maxLength={40}
            className="min-w-44 flex-1 rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={columnMutation.isPending || !columnName.trim()}
            className="rounded-xl border border-border bg-frost/40 px-4 py-2 text-sm font-medium text-ice disabled:opacity-50"
          >
            Add column
          </button>
        </form>
      )}

      {dialog && (
        <CardDialog
          boardId={boardId}
          columnId={dialog.columnId}
          card={dialog.card}
          columns={data.columns.map((c) => ({ id: c.id, name: c.name }))}
          people={data.people}
          open
          onClose={() => setDialog(null)}
        />
      )}
    </AppShell>
  );
}
