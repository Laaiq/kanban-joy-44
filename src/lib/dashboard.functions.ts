import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Dashboard = {
  workspaceName: string;
  totalCards: number;
  overdue: number;
  doneCards: number;
  avgDaysToDone: number | null;
  avgOpenAgeDays: number | null;
  topAssignees: { name: string; count: number }[];
  unassigned: number;
  boards: { id: string; name: string; total: number; overdue: number; done: number }[];
};

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Dashboard> => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("You're not a member of this workspace.");

    const { data: workspace } = await supabase.from("workspaces").select("name").eq("id", data.workspaceId).maybeSingle();
    const { data: boards, error } = await supabase
      .from("boards")
      .select("id, name")
      .eq("workspace_id", data.workspaceId)
      .order("position");
    if (error) throw new Error("We couldn't load this dashboard.");
    const boardIds = (boards ?? []).map((b) => b.id);

    let cards: { board_id: string; column_id: string; assignee_id: string | null; due_date: string | null; created_at: string; updated_at: string }[] = [];
    let columns: { id: string; board_id: string; position: number }[] = [];
    if (boardIds.length) {
      const [c, col] = await Promise.all([
        supabase.from("cards").select("board_id, column_id, assignee_id, due_date, created_at, updated_at").in("board_id", boardIds),
        supabase.from("board_columns").select("id, board_id, position").in("board_id", boardIds),
      ]);
      if (c.error || col.error) throw new Error("We couldn't load this dashboard.");
      cards = c.data ?? [];
      columns = col.data ?? [];
    }

    // The last column of each board counts as "done".
    const doneColumn = new Map<string, { id: string; position: number }>();
    for (const col of columns) {
      const cur = doneColumn.get(col.board_id);
      if (!cur || col.position > cur.position) doneColumn.set(col.board_id, { id: col.id, position: col.position });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const doneDurations: number[] = [];
    const openAges: number[] = [];
    const assigneeCounts = new Map<string, number>();
    const perBoard = new Map<string, { total: number; overdue: number; done: number }>();
    let overdue = 0;
    let unassigned = 0;

    for (const card of cards) {
      const isDone = doneColumn.get(card.board_id)?.id === card.column_id;
      const b = perBoard.get(card.board_id) ?? { total: 0, overdue: 0, done: 0 };
      b.total += 1;
      if (isDone) {
        b.done += 1;
        doneDurations.push((Date.parse(card.updated_at) - Date.parse(card.created_at)) / DAY);
      } else {
        openAges.push((now - Date.parse(card.created_at)) / DAY);
        if (card.due_date && card.due_date < today) {
          overdue += 1;
          b.overdue += 1;
        }
      }
      perBoard.set(card.board_id, b);
      if (card.assignee_id) assigneeCounts.set(card.assignee_id, (assigneeCounts.get(card.assignee_id) ?? 0) + 1);
      else unassigned += 1;
    }

    const ids = [...assigneeCounts.keys()];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email || "Member");
    }

    const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

    return {
      workspaceName: workspace?.name ?? "Workspace",
      totalCards: cards.length,
      overdue,
      doneCards: doneDurations.length,
      avgDaysToDone: avg(doneDurations),
      avgOpenAgeDays: avg(openAges),
      topAssignees: [...assigneeCounts.entries()]
        .map(([id, count]) => ({ name: names.get(id) ?? "Member", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      unassigned,
      boards: (boards ?? []).map((b) => ({ id: b.id, name: b.name, ...(perBoard.get(b.id) ?? { total: 0, overdue: 0, done: 0 }) })),
    };
  });
