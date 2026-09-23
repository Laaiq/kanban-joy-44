import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createCard, updateCard, type Card } from "@/lib/boards.functions";

type Props = {
  boardId: string;
  columnId: string;
  columns: { id: string; name: string }[];
  people: { userId: string; name: string }[];
  card: Card | null;
  open: boolean;
  onClose: () => void;
};

export function CardDialog({ boardId, columnId, columns, people, card, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const add = useServerFn(createCard);
  const edit = useServerFn(updateCard);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [targetColumn, setTargetColumn] = useState(columnId);

  useEffect(() => {
    if (!open) return;
    setTitle(card?.title ?? "");
    setDescription(card?.description ?? "");
    setAssigneeId(card?.assigneeId ?? "");
    setDueDate(card?.dueDate ?? "");
    setLabels((card?.labels ?? []).join(", "));
    setTargetColumn(card?.columnId ?? columnId);
  }, [open, card, columnId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedLabels = labels
        .split(",")
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);
      const shared = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        labels: parsedLabels,
      };
      if (card) {
        return edit({ data: { cardId: card.id, columnId: targetColumn, ...shared } });
      }
      return add({
        data: {
          boardId,
          columnId: targetColumn,
          title: shared.title,
          description: shared.description ?? undefined,
          assigneeId: shared.assigneeId,
          dueDate: shared.dueDate,
          labels: shared.labels,
        },
      });
    },
    onSuccess: async () => {
      toast.success(card ? "Card updated" : "Card added");
      await queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      await queryClient.invalidateQueries({ queryKey: ["roadmap"] });
      onClose();
    },
    onError: (error: unknown) =>
      toast.error(card ? "Couldn't save the card" : "Couldn't add the card", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mist">
              {card ? "Edit card" : "New card"}
            </p>
            <h2 className="font-display text-xl font-semibold">
              {card ? "Update this piece of work" : "Add a piece of work"}
            </h2>
          </div>
          <button onClick={onClose} className="text-mist hover:text-ice" aria-label="Close">
            ×
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length < 2) return;
            mutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
              className="mt-1 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1 w-full resize-y rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Assignee</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Unassigned</option>
                {people.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Column</span>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Labels</span>
              <input
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="design, seo"
                className="mt-1 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-frost/40 px-3.5 py-2 text-sm text-mist"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || title.trim().length < 2}
              className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : card ? "Save card" : "Add card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
