import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { ROLE_COPY } from "@/components/role-badge";
import { inviteMember, type Role } from "@/lib/workspaces.functions";

const ROLES: Role[] = ["owner", "editor", "viewer"];

export function InviteMemberDialog({
  workspaceId,
  workspaceName,
  open,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteMember);

  const mutation = useMutation({
    mutationFn: (input: { workspaceId: string; email: string; role: Role }) => invite({ data: input }),
    onSuccess: async (result) => {
      if (result.added) {
        toast.success("Member added", { description: `${result.email} now has ${role} access.` });
      } else {
        toast.success("Invitation saved", {
          description: `${result.email} joins as ${role} the moment they sign up.`,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setEmail("");
      onClose();
    },
    onError: (error: unknown) => {
      toast.error("Couldn't send the invite", {
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
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Invite to {workspaceName}</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight">Add a member</h2>
          </div>
          <button onClick={onClose} className="rounded-md px-2 text-lg leading-none text-mist hover:text-ice">
            ×
          </button>
        </div>

        <form
          className="mt-4 space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ workspaceId, email: email.trim(), role });
          }}
        >
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="invite-email">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="mt-1.5 w-full rounded-xl border border-border bg-ink/70 px-3 py-2 text-sm placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-[0.14em] text-mist">Role</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {ROLES.map((option) => {
                const selected = role === option;
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setRole(option)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selected ? "border-volt bg-volt/10" : "border-border bg-frost/40 hover:bg-accent"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${selected ? "text-volt" : "text-ice"}`}>
                      {ROLE_COPY[option].label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-mist">{ROLE_COPY[option].short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded-xl border border-border bg-frost/40 px-3 py-2.5 text-xs leading-relaxed text-mist">
            {ROLE_COPY[role].detail}
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
              {mutation.isPending ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
