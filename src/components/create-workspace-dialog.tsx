import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { createWorkspace } from "@/lib/workspaces.functions";

export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const create = useServerFn(createWorkspace);

  const mutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) => create({ data: input }),
    onSuccess: async () => {
      toast.success("Workspace created", { description: `You're the owner of ${name.trim()}.` });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setName("");
      setDescription("");
      onClose();
    },
    onError: (error: unknown) => {
      toast.error("Couldn't create the workspace", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl bg-ink2/95 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist">New workspace</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight">Name your workspace</h2>
          </div>
          <button onClick={onClose} className="rounded-md px-2 text-lg leading-none text-mist hover:text-ice">
            ×
          </button>
        </div>

        <form
          className="mt-4 space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = description.trim();
            mutation.mutate(trimmed ? { name, description: trimmed } : { name });
          }}
        >
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="ws-name">
              Workspace name
            </label>
            <input
              id="ws-name"
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Northwind Studio"
              className="mt-1.5 w-full rounded-xl border border-border bg-ink/70 px-3 py-2 text-sm placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="ws-desc">
              Description <span className="normal-case tracking-normal text-mist/60">(optional)</span>
            </label>
            <textarea
              id="ws-desc"
              rows={2}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this team is shipping."
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-ink/70 px-3 py-2 text-sm placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p className="rounded-xl border border-border bg-frost/40 px-3 py-2.5 text-xs leading-relaxed text-mist">
            You become the owner. Only owners can invite people, change roles, or delete the workspace — and only
            members can see anything inside it.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm font-medium text-mist hover:text-ice"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px disabled:opacity-60"
            >
              {mutation.isPending ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
