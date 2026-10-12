import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { createColumn, deleteCard, getBoard, moveCard, type BoardDetail, type Card } from "@/lib/boards.functions";

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
  const shiftCard = useServerFn(moveCard);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ columnId: string; index: number } | null>(null);

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

  const moveMutation = useMutation({
    mutationFn: (v: { cardId: string; columnId: string; index: number }) => shiftCard({ data: v }),
    onMutate: async ({ cardId, columnId, index }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BoardDetail>(queryKey);
      if (previous) {
        const moving = previous.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
        if (moving) {
          queryClient.setQueryData<BoardDetail>(queryKey, {
            ...previous,
            columns: previous.columns.map((column) => {
              const rest = column.cards.filter((c) => c.id !== cardId);
              if (column.id !== columnId) return { ...column, cards: rest };
              rest.splice(Math.min(index, rest.length), 0, { ...moving, columnId });
              return { ...column, cards: rest };
            }),
          });
        }
      }
      return { previous };
    },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Card not moved", {
        description: error instanceof Error ? error.message : "It's back where it was. Please try again.",
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["roadmap", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
  });

  const indexFromPointer = (section: HTMLElement, y: number) => {
    const items = [...section.querySelectorAll<HTMLElement>("[data-card-id]")].filter(
      (el) => el.dataset["cardId"] !== dragId,
    );
    const i = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i === -1 ? items.length : i;
  };

  const finishDrop = () => {
    if (dragId && dropAt && data) {
      const from = data.columns.find((c) => c.cards.some((card) => card.id === dragId));
      const currentIndex = from?.cards.filter((c) => c.id !== dragId).length ?? 0;
      const oldIndex = from?.cards.findIndex((c) => c.id === dragId) ?? -1;
      const unchanged = from?.id === dropAt.columnId && oldIndex === dropAt.index;
      if (!unchanged && currentIndex >= 0) moveMutation.mutate({ cardId: dragId, ...dropAt });
    }
    setDragId(null);
    setDropAt(null);
  };

  const data = board.data;

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

      {canEdit && (
        <p className="text-[11px] text-mist">Drag cards to move them between columns or reorder them.</p>
      )}

      {!canEdit && (
        <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-mist">
          <span className="grid size-6 place-items-center rounded-md bg-volt/15 text-volt">i</span>
          You have view-only access to this board.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.columns.map((column) => (
          <section
            key={column.id}
            className={`glass-panel rounded-2xl p-4 transition-shadow ${
              dropAt?.columnId === column.id ? "ring-2 ring-volt/60 shadow-volt" : ""
            }`}
            onDragOver={(event) => {
              if (!dragId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const index = indexFromPointer(event.currentTarget, event.clientY);
              if (dropAt?.columnId !== column.id || dropAt.index !== index) setDropAt({ columnId: column.id, index });
            }}
            onDrop={(event) => {
              event.preventDefault();
              finishDrop();
            }}
          >
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
              {column.cards.map((card, cardIndex) => (
                <div key={card.id}>
                {dropAt?.columnId === column.id &&
                  dropAt.index === column.cards.filter((c) => c.id !== dragId).findIndex((c) => c.id === card.id) &&
                  card.id !== dragId && <div className="mb-2 h-0.5 rounded-full bg-volt shadow-volt" />}
                <article
                  data-card-id={card.id}
                  data-index={cardIndex}
                  draggable={canEdit}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", card.id);
                    setDragId(card.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropAt(null);
                  }}
                  className={`rounded-xl border border-border bg-ink2/60 p-3 transition-opacity ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  } ${dragId === card.id ? "opacity-40" : ""}`}
                >
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
                  {card.tasks.length > 0 && (
                    <p className="mt-2 text-[10px] text-mist">
                      <span className="text-volt">✓</span> {card.tasks.filter((t) => t.done).length}/{card.tasks.length} sub-tasks
                    </p>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-mist">
                    {card.assigneeName ?? "Unassigned"}
                    {card.dueDate ? ` · due ${card.dueDate}` : ""}
                  </p>
                </article>
                </div>
              ))}
              {dropAt?.columnId === column.id &&
                dropAt.index >= column.cards.filter((c) => c.id !== dragId).length &&
                column.cards.some((c) => c.id !== dragId) && <div className="h-0.5 rounded-full bg-volt shadow-volt" />}
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
          card={dialog.card ? (data.columns.flatMap((c) => c.cards).find((c) => c.id === dialog.card!.id) ?? dialog.card) : null}
          columns={data.columns.map((c) => ({ id: c.id, name: c.name }))}
          people={data.people}
          open
          onClose={() => setDialog(null)}
        />
      )}
    </AppShell>
  );
}
