import type { Role } from "@/lib/workspaces.functions";

const ROLE_STYLES: Record<Role, string> = {
  owner: "bg-role-owner/15 text-role-owner",
  editor: "bg-role-editor/15 text-role-editor",
  viewer: "bg-role-viewer/15 text-role-viewer",
};

export const ROLE_COPY: Record<Role, { label: string; short: string; detail: string }> = {
  owner: {
    label: "Owner",
    short: "Full control",
    detail: "Full control. Invites people, changes roles, renames and deletes the workspace.",
  },
  editor: {
    label: "Editor",
    short: "Can edit",
    detail: "Creates and edits boards, columns and cards. Cannot change roles or delete the workspace.",
  },
  viewer: {
    label: "Viewer",
    short: "Read-only",
    detail: "Read-only access. Sees every board and card but cannot make changes.",
  },
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[role]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROLE_COPY[role].label}
    </span>
  );
}
