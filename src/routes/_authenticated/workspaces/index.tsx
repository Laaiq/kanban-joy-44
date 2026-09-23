import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { RoleBadge } from "@/components/role-badge";
import { acceptInvite, listMyInvites, listWorkspaces } from "@/lib/workspaces.functions";

export const Route = createFileRoute("/_authenticated/workspaces/")({
  head: () => ({
    meta: [
      { title: "Your workspaces — Meridian" },
      { name: "description", content: "Every Meridian workspace you belong to, with your role in each." },
      { property: "og:title", content: "Your workspaces — Meridian" },
      { property: "og:description", content: "Every Meridian workspace you belong to, with your role in each." },
    ],
  }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const fetchWorkspaces = useServerFn(listWorkspaces);
  const fetchInvites = useServerFn(listMyInvites);
  const accept = useServerFn(acceptInvite);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: () => fetchWorkspaces() });
  const invites = useQuery({ queryKey: ["my-invites"], queryFn: () => fetchInvites() });

  const acceptMutation = useMutation({
    mutationFn: (inviteId: string) => accept({ data: { inviteId } }),
    onSuccess: async () => {
      toast.success("Invitation accepted", { description: "The workspace is now in your list." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["my-invites"] }),
      ]);
    },
    onError: (error: unknown) =>
      toast.error("Couldn't accept the invitation", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  return (
    <AppShell eyebrow="Workspaces">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-4xl">Your workspaces</h1>
          <p className="mt-2 text-sm text-mist">
            {workspaces.data
              ? `${workspaces.data.length} workspace${workspaces.data.length === 1 ? "" : "s"} · roles enforced per workspace`
              : "Loading your access…"}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px"
        >
          New workspace
        </button>
      </div>

      {(invites.data?.length ?? 0) > 0 && (
        <div className="glass-panel rounded-2xl p-4">
          <p className="font-display text-sm font-semibold">Pending invitations</p>
          <div className="mt-3 space-y-2">
            {invites.data?.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-frost/40 px-3 py-2.5"
              >
                <span className="text-sm font-medium">{invite.workspaceName}</span>
                <RoleBadge role={invite.role} />
                <button
                  onClick={() => acceptMutation.mutate(invite.id)}
                  disabled={acceptMutation.isPending}
                  className="ml-auto rounded-lg bg-volt px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {workspaces.isPending && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel rounded-2xl p-4">
              <div className="h-4 w-28 animate-pulse rounded bg-line" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-line/70" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-line/50" />
              <div className="mt-5 h-5 w-20 animate-pulse rounded-md bg-line/70" />
            </div>
          ))}
        </div>
      )}

      {workspaces.isError && (
        <div className="glass-panel rounded-2xl border-destructive/40 p-5">
          <p className="font-display text-sm font-semibold">We couldn't load your workspaces</p>
          <p className="mt-1 text-xs text-mist">
            {workspaces.error instanceof Error ? workspaces.error.message : "Unexpected error."}
          </p>
          <button
            onClick={() => workspaces.refetch()}
            className="mt-4 rounded-lg border border-border bg-frost/60 px-3 py-1.5 text-xs font-medium text-ice"
          >
            Try again
          </button>
        </div>
      )}

      {workspaces.data?.length === 0 && (
        <div className="glass-panel grid place-items-center rounded-2xl border-dashed py-16 text-center">
          <p className="font-display text-lg font-semibold">No workspaces yet</p>
          <p className="mt-2 max-w-sm px-6 text-sm text-mist">
            A workspace holds your boards and your people. Create one, then invite teammates as editors or viewers.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-5 rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt"
          >
            Create your first workspace
          </button>
        </div>
      )}

      {(workspaces.data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {workspaces.data?.map((workspace) => (
            <Link
              key={workspace.id}
              to="/workspaces/$workspaceId"
              params={{ workspaceId: workspace.id }}
              className="glass-panel rounded-2xl p-4 transition-transform hover:-translate-y-0.5 hover:border-volt/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-base font-semibold leading-snug">{workspace.name}</h2>
                <RoleBadge role={workspace.role} />
              </div>
              <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-mist">
                {workspace.description ?? "No description yet."}
              </p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-mist">
                <span>
                  {workspace.memberCount} member{workspace.memberCount === 1 ? "" : "s"}
                </span>
                <span className="text-volt">Manage →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}
