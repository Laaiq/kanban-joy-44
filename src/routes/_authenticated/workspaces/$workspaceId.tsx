import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, initials } from "@/components/app-shell";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { ROLE_COPY, RoleBadge } from "@/components/role-badge";
import {
  cancelInvite,
  deleteWorkspace,
  getWorkspace,
  removeMember,
  updateMemberRole,
  type Role,
  type WorkspaceDetail,
} from "@/lib/workspaces.functions";

const ROLES: Role[] = ["owner", "editor", "viewer"];

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId")({
  head: () => ({
    meta: [
      { title: "Workspace members — Meridian" },
      { name: "description", content: "Manage who belongs to this Meridian workspace and what each person can do." },
      { property: "og:title", content: "Workspace members — Meridian" },
      {
        property: "og:description",
        content: "Manage who belongs to this Meridian workspace and what each person can do.",
      },
    ],
  }),
  component: WorkspaceDetailPage,
});

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchWorkspace = useServerFn(getWorkspace);
  const changeRole = useServerFn(updateMemberRole);
  const kick = useServerFn(removeMember);
  const dropInvite = useServerFn(cancelInvite);
  const destroy = useServerFn(deleteWorkspace);

  const queryKey = ["workspace", workspaceId];
  const workspace = useQuery({ queryKey, queryFn: () => fetchWorkspace({ data: { workspaceId } }) });

  const roleMutation = useMutation({
    mutationFn: (input: { memberId: string; role: Role }) =>
      changeRole({ data: { memberId: input.memberId, workspaceId, role: input.role } }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkspaceDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkspaceDetail>(queryKey, {
          ...previous,
          members: previous.members.map((m) => (m.id === input.memberId ? { ...m, role: input.role } : m)),
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Role change rolled back", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
    onSuccess: () => toast.success("Role updated"),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => kick({ data: { memberId, workspaceId } }),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkspaceDetail>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkspaceDetail>(queryKey, {
          ...previous,
          members: previous.members.filter((m) => m.id !== memberId),
        });
      }
      return { previous };
    },
    onError: (error, _memberId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Member not removed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
    onSuccess: () => toast.success("Member removed"),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const inviteMutation = useMutation({
    mutationFn: (inviteId: string) => dropInvite({ data: { inviteId } }),
    onSuccess: async () => {
      toast.success("Invitation cancelled");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't cancel the invitation", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => destroy({ data: { workspaceId } }),
    onSuccess: async () => {
      toast.success("Workspace deleted");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate({ to: "/workspaces", replace: true });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't delete the workspace", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  if (workspace.isPending) {
    return (
      <AppShell eyebrow="Workspace · Members">
        <div className="h-9 w-60 animate-pulse rounded bg-line" />
        <div className="glass-panel rounded-2xl p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <div className="size-9 animate-pulse rounded-full bg-line" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-line" />
                <div className="h-2.5 w-48 animate-pulse rounded bg-line/60" />
              </div>
              <div className="h-5 w-20 animate-pulse rounded-md bg-line/70" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  if (workspace.isError || !workspace.data) {
    return (
      <AppShell eyebrow="Workspace">
        <div className="glass-panel rounded-2xl border-destructive/40 p-6">
          <h1 className="font-display text-xl font-semibold">We couldn't open this workspace</h1>
          <p className="mt-2 text-sm text-mist">
            {workspace.error instanceof Error
              ? workspace.error.message
              : "You may not have access to it any more."}
          </p>
          <Link
            to="/workspaces"
            className="mt-5 inline-block rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink"
          >
            Back to workspaces
          </Link>
        </div>
      </AppShell>
    );
  }

  const data = workspace.data;
  const isOwner = data.myRole === "owner";

  return (
    <AppShell eyebrow="Workspace · Members">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/workspaces" className="text-[11px] uppercase tracking-[0.16em] text-mist hover:text-ice">
            ← All workspaces
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight sm:text-4xl">{data.name}</h1>
          <p className="mt-2 text-sm text-mist">
            {data.members.length} member{data.members.length === 1 ? "" : "s"} · you are{" "}
            <span className="text-volt">{ROLE_COPY[data.myRole].label.toLowerCase()}</span>
            {data.description ? ` · ${data.description}` : ""}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm(`Delete ${data.name}? This removes the workspace and every member from it.`)) {
                  deleteMutation.mutate();
                }
              }}
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-sm font-medium text-destructive"
            >
              Delete workspace
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px"
            >
              Invite member
            </button>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-mist">
          <span className="grid size-6 place-items-center rounded-md bg-volt/15 text-volt">i</span>
          Only owners can invite people or change roles. You can see the team as {ROLE_COPY[data.myRole].label
            .toLowerCase()}.
        </div>
      )}

      <section className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="font-display text-sm font-semibold">Members</span>
          <span className="rounded-md bg-frost px-2 py-0.5 text-xs text-mist">{data.members.length}</span>
        </div>

        <div className="divide-y divide-border/60">
          {data.members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-volt to-volt-deep text-xs font-semibold text-ink">
                {initials(member.fullName ?? member.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.fullName ?? member.email ?? "Member"}
                  {member.userId === data.myUserId && <span className="ml-2 text-[11px] text-mist">you</span>}
                </p>
                <p className="truncate text-[11px] text-mist">{member.email ?? "Email hidden"}</p>
              </div>

              {isOwner ? (
                <select
                  value={member.role}
                  onChange={(event) =>
                    roleMutation.mutate({ memberId: member.id, role: event.target.value as Role })
                  }
                  className="rounded-lg border border-border bg-ink2/80 px-2 py-1.5 text-xs font-medium text-ice focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_COPY[role].label}
                    </option>
                  ))}
                </select>
              ) : (
                <RoleBadge role={member.role} />
              )}

              {isOwner && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.fullName ?? member.email ?? "this member"} from ${data.name}?`)) {
                      removeMutation.mutate(member.id);
                    }
                  }}
                  className="rounded-lg border border-border bg-frost/50 px-2.5 py-1.5 text-[11px] font-medium text-mist hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {data.invites.length > 0 && (
        <section className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="font-display text-sm font-semibold">Pending invitations</span>
            <span className="rounded-md bg-frost px-2 py-0.5 text-xs text-mist">{data.invites.length}</span>
          </div>
          <div className="divide-y divide-border/60">
            {data.invites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">{invite.email}</span>
                <RoleBadge role={invite.role} />
                {isOwner && (
                  <button
                    onClick={() => inviteMutation.mutate(invite.id)}
                    className="rounded-lg border border-border bg-frost/50 px-2.5 py-1.5 text-[11px] font-medium text-mist hover:text-destructive"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role} className="glass-panel rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <RoleBadge role={role} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-mist">{ROLE_COPY[role].detail}</p>
          </div>
        ))}
      </div>

      <InviteMemberDialog
        workspaceId={workspaceId}
        workspaceName={data.name}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </AppShell>
  );
}
