import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Role = "owner" | "editor" | "viewer";

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  role: Role;
  memberCount: number;
};

export type Member = {
  id: string;
  userId: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  joinedAt: string;
};

export type Invite = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type WorkspaceDetail = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  myRole: Role;
  myUserId: string;
  members: Member[];
  invites: Invite[];
};

const roleSchema = z.enum(["owner", "editor", "viewer"]);

export type MutationResult = { ok: true } | { ok: false; message: string };

function fail(message: string): never {
  throw new Error(message);
}

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceSummary[]> => {
    const { supabase, userId } = context;

    const { data: memberships, error } = await supabase
      .from("workspace_members")
      .select("role, workspace_id, workspaces(id, name, description, created_at)")
      .eq("user_id", userId);

    if (error) fail(error.message);

    const ids = (memberships ?? []).map((m) => m.workspace_id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: allMembers, error: countError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", ids);
      if (countError) fail(countError.message);
      for (const row of allMembers ?? []) {
        counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
      }
    }

    return (memberships ?? [])
      .filter((m) => m.workspaces != null)
      .map((m) => {
        const w = m.workspaces as { id: string; name: string; description: string | null; created_at: string };
        return {
          id: w.id,
          name: w.name,
          description: w.description,
          createdAt: w.created_at,
          role: m.role as Role,
          memberCount: counts.get(w.id) ?? 1,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Give the workspace a name of at least 2 characters.").max(60),
        description: z.string().trim().max(240).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("workspaces")
      .insert({ name: data.name, description: data.description || null, created_by: userId })
      .select("id")
      .single();

    if (error) fail(error.message);
    return { id: created.id };
  });

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<WorkspaceDetail> => {
    const { supabase, userId } = context;

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, name, description, created_at")
      .eq("id", data.workspaceId)
      .maybeSingle();

    if (error) fail(error.message);
    if (!workspace) fail("This workspace doesn't exist, or you're not a member of it.");

    const { data: memberRows, error: membersError } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", data.workspaceId);

    if (membersError) fail(membersError.message);

    const memberIds = (memberRows ?? []).map((row) => row.user_id);
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (memberIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberIds);
      if (profileError) fail(profileError.message);
      for (const p of profileRows ?? []) {
        profileMap.set(p.id, { full_name: p.full_name, email: p.email });
      }
    }

    const members: Member[] = (memberRows ?? []).map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        role: row.role as Role,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        joinedAt: row.created_at,
      };
    });

    const myRole = members.find((m) => m.userId === userId)?.role;
    if (!myRole) fail("You're not a member of this workspace.");

    const { data: inviteRows, error: invitesError } = await supabase
      .from("workspace_invites")
      .select("id, email, role, created_at")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "pending");

    if (invitesError) fail(invitesError.message);

    const roleRank: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      createdAt: workspace.created_at,
      myRole,
      myUserId: userId,
      members: members.sort(
        (a, b) => roleRank[a.role] - roleRank[b.role] || (a.fullName ?? "").localeCompare(b.fullName ?? ""),
      ),
      invites: (inviteRows ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as Role,
        createdAt: row.created_at,
      })),
    };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().trim().toLowerCase().email("Enter a valid email address."),
        role: roleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isOwner, error: roleError } = await supabase.rpc("has_workspace_role", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
      _role: "owner",
    });
    if (roleError) fail(roleError.message);
    if (!isOwner) fail("Only workspace owners can invite people.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", data.email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMember) fail(`${data.email} is already a member of this workspace.`);

      const { error: insertError } = await supabaseAdmin
        .from("workspace_members")
        .insert({ workspace_id: data.workspaceId, user_id: existingProfile.id, role: data.role });
      if (insertError) fail(insertError.message);

      return { added: true as const, email: data.email };
    }

    const { error: inviteError } = await supabaseAdmin
      .from("workspace_invites")
      .upsert(
        {
          workspace_id: data.workspaceId,
          email: data.email,
          role: data.role,
          invited_by: userId,
          status: "pending",
        },
        { onConflict: "workspace_id,email" },
      );
    if (inviteError) fail(inviteError.message);

    return { added: false as const, email: data.email };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid(), workspaceId: z.string().uuid(), role: roleSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MutationResult> => {
    const { supabase, userId } = context;

    const { data: member, error: readError } = await supabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!member) return { ok: false, message: "That member no longer exists." };

    if (member.user_id === userId && member.role === "owner" && data.role !== "owner") {
      const { data: owners, error: ownersError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("role", "owner");
      if (ownersError) fail(ownersError.message);
      if ((owners ?? []).length <= 1)
        return { ok: false, message: "A workspace needs at least one owner. Promote someone else first." };
    }

    const { error } = await supabase
      .from("workspace_members")
      .update({ role: data.role })
      .eq("id", data.memberId);
    if (error) return { ok: false, message: "You don't have permission to change roles here." };

    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MutationResult> => {
    const { supabase } = context;

    const { data: member, error: readError } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("id", data.memberId)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!member) return { ok: true };

    if (member.role === "owner") {
      const { data: owners, error: ownersError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("role", "owner");
      if (ownersError) fail(ownersError.message);
      if ((owners ?? []).length <= 1)
        return { ok: false, message: "You can't remove the last owner of a workspace." };
    }

    const { error } = await supabase.from("workspace_members").delete().eq("id", data.memberId);
    if (error) return { ok: false, message: "You don't have permission to remove members here." };
    return { ok: true };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workspace_invites").delete().eq("id", data.inviteId);
    if (error) fail("You don't have permission to cancel this invite.");
    return { ok: true };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workspaces").delete().eq("id", data.workspaceId);
    if (error) fail("Only an owner can delete this workspace.");
    return { ok: true };
  });

export const listMyInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workspace_invites")
      .select("id, role, created_at, workspace_id, workspaces(name)")
      .eq("status", "pending");
    if (error) fail(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      role: row.role as Role,
      createdAt: row.created_at,
      workspaceId: row.workspace_id,
      workspaceName: (row.workspaces as { name: string } | null)?.name ?? "Workspace",
    }));
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = String((claims as { email?: string }).email ?? "").toLowerCase();

    const { data: invite, error } = await supabase
      .from("workspace_invites")
      .select("id, workspace_id, email, role")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (error) fail(error.message);
    if (!invite) fail("This invitation is no longer available.");
    if (invite.email.toLowerCase() !== email) fail("This invitation was sent to a different email address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin
      .from("workspace_members")
      .upsert(
        { workspace_id: invite.workspace_id, user_id: userId, role: invite.role },
        { onConflict: "workspace_id,user_id" },
      );
    if (insertError) fail(insertError.message);

    await supabaseAdmin.from("workspace_invites").delete().eq("id", invite.id);

    return { workspaceId: invite.workspace_id };
  });
