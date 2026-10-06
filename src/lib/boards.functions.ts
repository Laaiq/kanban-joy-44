import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "@/lib/workspaces.functions";

export type Card = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  labels: string[];
  position: number;
  tasks: CardTask[];
};

export type CardTask = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
};

export type Column = {
  id: string;
  name: string;
  position: number;
  cards: Card[];
};

export type BoardSummary = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  nextDue: string | null;
};

export type BoardDetail = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  myRole: Role;
  columns: Column[];
  people: { userId: string; name: string }[];
};

export type RoadmapItem = {
  key: string;
  kind: "card" | "task";
  parentTitle: string | null;
  cardId: string;
  title: string;
  description: string | null;
  boardId: string;
  boardName: string;
  columnName: string;
  dueDate: string | null;
  labels: string[];
  assigneeName: string | null;
};

export type Roadmap = {
  workspaceId: string;
  workspaceName: string;
  myRole: Role;
  boards: BoardSummary[];
  items: RoadmapItem[];
};

const uuid = z.string().uuid();

async function requireWorkspaceRole(
  supabase: { from: (t: string) => any },
  workspaceId: string,
  userId: string,
): Promise<Role> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We couldn't check your access to this workspace.");
  if (!data) throw new Error("You don't have access to this workspace.");
  return data.role as Role;
}

function assertEditor(role: Role) {
  if (role !== "owner" && role !== "editor") {
    throw new Error("Only owners and editors can change boards.");
  }
}

async function namesFor(
  supabase: { from: (t: string) => any },
  workspaceId: string,
): Promise<Map<string, string>> {
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (ids.length === 0) return new Map();
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const map = new Map<string, string>();
  for (const p of profiles ?? []) {
    map.set(p.id as string, (p.full_name as string | null) ?? (p.email as string | null) ?? "Member");
  }
  for (const id of ids) if (!map.has(id)) map.set(id, "Member");
  return map;
}

export const listBoards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const myRole = await requireWorkspaceRole(supabase, data.workspaceId, userId);

    const { data: boards, error } = await supabase
      .from("boards")
      .select("id, name, description, position, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error("We couldn't load the boards for this workspace.");

    const ids = (boards ?? []).map((b) => b.id);
    const counts = new Map<string, { count: number; nextDue: string | null }>();
    if (ids.length > 0) {
      const { data: cards } = await supabase.from("cards").select("board_id, due_date").in("board_id", ids);
      for (const card of cards ?? []) {
        const entry = counts.get(card.board_id) ?? { count: 0, nextDue: null };
        entry.count += 1;
        if (card.due_date && (!entry.nextDue || card.due_date < entry.nextDue)) entry.nextDue = card.due_date;
        counts.set(card.board_id, entry);
      }
    }

    return {
      myRole,
      boards: (boards ?? []).map<BoardSummary>((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        cardCount: counts.get(b.id)?.count ?? 0,
        nextDue: counts.get(b.id)?.nextDue ?? null,
      })),
    };
  });

export const createBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: uuid,
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(400).optional(),
        columns: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    assertEditor(await requireWorkspaceRole(supabase, data.workspaceId, userId));

    const { data: board, error } = await supabase
      .from("boards")
      .insert({
        workspace_id: data.workspaceId,
        name: data.name,
        description: data.description ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !board) throw new Error("We couldn't create that board. Please try again.");

    const names = data.columns?.length ? data.columns : ["Backlog", "In progress", "Review", "Done"];
    const { error: columnError } = await supabase
      .from("board_columns")
      .insert(names.map((name, index) => ({ board_id: board.id, name, position: index })));
    if (columnError) throw new Error("The board was created but its columns failed. Open it to add columns.");

    return { boardId: board.id as string };
  });

export const deleteBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ boardId: uuid, workspaceId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    assertEditor(await requireWorkspaceRole(supabase, data.workspaceId, userId));
    const { error } = await supabase.from("boards").delete().eq("id", data.boardId);
    if (error) throw new Error("We couldn't delete that board.");
    return { ok: true as const };
  });

export const getBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ boardId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<BoardDetail> => {
    const { supabase, userId } = context;
    const { data: board, error } = await supabase
      .from("boards")
      .select("id, workspace_id, name, description")
      .eq("id", data.boardId)
      .maybeSingle();
    if (error) throw new Error("We couldn't load this board.");
    if (!board) throw new Error("This board doesn't exist, or you don't have access to it.");

    const myRole = await requireWorkspaceRole(supabase, board.workspace_id, userId);

    const { data: columns } = await supabase
      .from("board_columns")
      .select("id, name, position")
      .eq("board_id", board.id)
      .order("position", { ascending: true });

    const { data: cards } = await supabase
      .from("cards")
      .select("id, column_id, title, description, assignee_id, due_date, labels, position")
      .eq("board_id", board.id)
      .order("position", { ascending: true });

    const people = await namesFor(supabase, board.workspace_id);

    const { data: taskRows } = await supabase
      .from("card_tasks")
      .select("id, card_id, title, due_date, done, position, created_at")
      .eq("board_id", board.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    const tasksByCard = new Map<string, CardTask[]>();
    for (const t of taskRows ?? []) {
      const list = tasksByCard.get(t.card_id) ?? [];
      list.push({ id: t.id, title: t.title, dueDate: t.due_date, done: t.done });
      tasksByCard.set(t.card_id, list);
    }

    return {
      id: board.id,
      workspaceId: board.workspace_id,
      name: board.name,
      description: board.description,
      myRole,
      people: [...people.entries()].map(([id, name]) => ({ userId: id, name })),
      columns: (columns ?? []).map<Column>((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
        cards: (cards ?? [])
          .filter((card) => card.column_id === column.id)
          .map<Card>((card) => ({
            id: card.id,
            columnId: card.column_id,
            title: card.title,
            description: card.description,
            assigneeId: card.assignee_id,
            assigneeName: card.assignee_id ? people.get(card.assignee_id) ?? null : null,
            dueDate: card.due_date,
            labels: card.labels ?? [],
            position: card.position,
            tasks: tasksByCard.get(card.id) ?? [],
          })),
      })),
    };
  });

export const createColumn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ boardId: uuid, name: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("board_columns")
      .select("id", { count: "exact", head: true })
      .eq("board_id", data.boardId);
    const { error } = await supabase
      .from("board_columns")
      .insert({ board_id: data.boardId, name: data.name, position: count ?? 0 });
    if (error) throw new Error("Only owners and editors can add columns.");
    return { ok: true as const };
  });

const cardInput = z.object({
  boardId: uuid,
  columnId: uuid,
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional(),
  assigneeId: uuid.nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  labels: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
});

export const createCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("column_id", data.columnId);
    const { error } = await supabase.from("cards").insert({
      board_id: data.boardId,
      column_id: data.columnId,
      title: data.title,
      description: data.description ?? null,
      assignee_id: data.assigneeId ?? null,
      due_date: data.dueDate ?? null,
      labels: data.labels ?? [],
      position: count ?? 0,
      created_by: userId,
    });
    if (error) throw new Error("Only owners and editors can add cards.");
    return { ok: true as const };
  });

export const updateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cardId: uuid,
        columnId: uuid.optional(),
        title: z.string().trim().min(2).max(140).optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        assigneeId: uuid.nullable().optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        labels: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      column_id?: string;
      title?: string;
      description?: string | null;
      assignee_id?: string | null;
      due_date?: string | null;
      labels?: string[];
    } = {};
    if (data.columnId !== undefined) patch["column_id"] = data.columnId;
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.description !== undefined) patch["description"] = data.description;
    if (data.assigneeId !== undefined) patch["assignee_id"] = data.assigneeId;
    if (data.dueDate !== undefined) patch["due_date"] = data.dueDate;
    if (data.labels !== undefined) patch["labels"] = data.labels;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { data: updated, error } = await supabase
      .from("cards")
      .update(patch)
      .eq("id", data.cardId)
      .select("id");
    if (error) throw new Error("We couldn't save that card.");
    if (!updated || updated.length === 0) throw new Error("Only owners and editors can change cards.");
    return { ok: true as const };
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cardId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cards").delete().eq("id", data.cardId);
    if (error) throw new Error("Only owners and editors can delete cards.");
    return { ok: true as const };
  });

export const getRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<Roadmap> => {
    const { supabase, userId } = context;
    const myRole = await requireWorkspaceRole(supabase, data.workspaceId, userId);

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (workspaceError || !workspace) throw new Error("We couldn't open this workspace.");

    const { data: boards, error } = await supabase
      .from("boards")
      .select("id, name, description, position, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error("We couldn't load the timeline for this workspace.");

    const boardIds = (boards ?? []).map((b) => b.id);
    const boardNames = new Map<string, string>((boards ?? []).map((b) => [b.id as string, b.name as string]));

    let cards: any[] = [];
    let columnNames = new Map<string, string>();
    let taskRows: { id: string; card_id: string; title: string; due_date: string | null; done: boolean }[] = [];
    if (boardIds.length > 0) {
      const [cardRes, columnRes, taskRes] = await Promise.all([
        supabase
          .from("cards")
          .select("id, board_id, column_id, title, description, due_date, labels, assignee_id")
          .in("board_id", boardIds),
        supabase.from("board_columns").select("id, name").in("board_id", boardIds),
        supabase.from("card_tasks").select("id, card_id, title, due_date, done").in("board_id", boardIds).eq("done", false),
      ]);
      taskRows = taskRes.data ?? [];
      cards = cardRes.data ?? [];
      columnNames = new Map((columnRes.data ?? []).map((c) => [c.id as string, c.name as string]));
    }

    const people = await namesFor(supabase, data.workspaceId);

    const counts = new Map<string, { count: number; nextDue: string | null }>();
    for (const card of cards) {
      const entry = counts.get(card.board_id) ?? { count: 0, nextDue: null };
      entry.count += 1;
      if (card.due_date && (!entry.nextDue || card.due_date < entry.nextDue)) entry.nextDue = card.due_date;
      counts.set(card.board_id, entry);
    }

    const cardById = new Map<string, any>(cards.map((c) => [c.id, c]));
    const cardItems = cards.map<RoadmapItem>((card) => ({
        key: card.id,
        kind: "card",
        parentTitle: null,
        cardId: card.id,
        title: card.title,
        description: card.description ?? null,
        boardId: card.board_id,
        boardName: boardNames.get(card.board_id) ?? "Board",
        columnName: columnNames.get(card.column_id) ?? "Column",
        dueDate: card.due_date ?? null,
        labels: card.labels ?? [],
        assigneeName: card.assignee_id ? people.get(card.assignee_id) ?? null : null,
      }));
    const taskItems = taskRows
      .filter((t) => cardById.has(t.card_id))
      .map<RoadmapItem>((t) => {
        const card = cardById.get(t.card_id);
        return {
          key: `task-${t.id}`,
          kind: "task",
          parentTitle: card.title,
          cardId: card.id,
          title: t.title,
          description: null,
          boardId: card.board_id,
          boardName: boardNames.get(card.board_id) ?? "Board",
          columnName: columnNames.get(card.column_id) ?? "Column",
          dueDate: t.due_date,
          labels: [],
          assigneeName: card.assignee_id ? people.get(card.assignee_id) ?? null : null,
        };
      });
    const items = [...cardItems, ...taskItems]
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      });

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      myRole,
      boards: (boards ?? []).map<BoardSummary>((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        cardCount: counts.get(b.id)?.count ?? 0,
        nextDue: counts.get(b.id)?.nextDue ?? null,
      })),
      items,
    };
  });
