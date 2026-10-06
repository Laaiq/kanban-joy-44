import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import type { BoardDetail, CardTask } from "@/lib/boards.functions";
import { createCardTask, deleteCardTask, updateCardTask } from "@/lib/card-tasks.functions";

export function CardTasks({ boardId, cardId, tasks }: { boardId: string; cardId: string; tasks: CardTask[] }) {
  const queryClient = useQueryClient();
  const add = useServerFn(createCardTask);
  const update = useServerFn(updateCardTask);
  const remove = useServerFn(deleteCardTask);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const key = ["board", boardId];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // Optimistically patch this card's tasks in the board cache; returns a rollback snapshot.
  const patchTasks = async (fn: (tasks: CardTask[]) => CardTask[]) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<BoardDetail>(key);
    if (previous) {
      queryClient.setQueryData<BoardDetail>(key, {
        ...previous,
        columns: previous.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === cardId ? { ...c, tasks: fn(c.tasks) } : c)),
        })),
      });
    }
    return { previous };
  };
  const rollback = (ctx: { previous: BoardDetail | undefined } | undefined, error: unknown, what: string) => {
    if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    toast.error(what, { description: error instanceof Error ? error.message : "Please try again." });
  };

  const addMutation = useMutation({
    mutationFn: () => add({ data: { cardId, title: title.trim(), dueDate: dueDate || null } }),
    onSuccess: async () => {
      setTitle("");
      setDueDate("");
      await refresh();
    },
    onError: (e) => toast.error("Couldn't add the sub-task", { description: e instanceof Error ? e.message : undefined }),
  });

  const toggle = useMutation({
    mutationFn: (t: CardTask) => update({ data: { taskId: t.id, done: !t.done } }),
    onMutate: (t) => patchTasks((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))),
    onError: (e, _t, ctx) => rollback(ctx, e, "Sub-task not updated"),
    onSettled: refresh,
  });

  const drop = useMutation({
    mutationFn: (t: CardTask) => remove({ data: { taskId: t.id } }),
    onMutate: (t) => patchTasks((list) => list.filter((x) => x.id !== t.id)),
    onError: (e, _t, ctx) => rollback(ctx, e, "Sub-task not deleted"),
    onSettled: refresh,
  });

  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-mist">Sub-tasks</span>
        {tasks.length > 0 && (
          <span className="text-[11px] text-mist">
            {done}/{tasks.length} done
          </span>
        )}
      </div>
      {tasks.length > 0 && (
        <div className="mt-2 h-1 rounded-full bg-frost">
          <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
        </div>
      )}
      <ul className="mt-3 space-y-1.5">
        {tasks.length === 0 && <li className="text-[11px] text-mist">Break this card into smaller steps, each with its own date.</li>}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border bg-ink2/60 px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle.mutate(t)}
              aria-label={`Mark ${t.title} ${t.done ? "not done" : "done"}`}
              className="size-4 accent-volt"
            />
            <span className={`flex-1 text-sm ${t.done ? "text-mist line-through" : "text-ice"}`}>{t.title}</span>
            {t.dueDate && <span className="text-[10px] text-mist">{t.dueDate}</span>}
            <button
              type="button"
              onClick={() => drop.mutate(t)}
              aria-label={`Delete ${t.title}`}
              className="px-1 text-mist hover:text-destructive"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (title.trim()) addMutation.mutate();
            }
          }}
          placeholder="New sub-task"
          maxLength={160}
          className="min-w-0 flex-1 rounded-xl border border-border bg-ink2/70 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Sub-task due date"
          className="rounded-xl border border-border bg-ink2/70 px-2 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          disabled={!title.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="rounded-xl border border-volt/40 bg-volt/10 px-3 text-sm font-semibold text-volt disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
