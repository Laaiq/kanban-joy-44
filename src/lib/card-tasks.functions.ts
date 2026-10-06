import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const createCardTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ cardId: uuid, title: z.string().trim().min(1).max(160), dueDate: date }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: card } = await supabase.from("cards").select("board_id").eq("id", data.cardId).maybeSingle();
    if (!card) throw new Error("This card no longer exists.");
    const { count } = await supabase
      .from("card_tasks")
      .select("id", { count: "exact", head: true })
      .eq("card_id", data.cardId);
    const { error } = await supabase.from("card_tasks").insert({
      card_id: data.cardId,
      board_id: card.board_id,
      title: data.title,
      due_date: data.dueDate,
      position: count ?? 0,
      created_by: userId,
    });
    if (error) throw new Error("Only owners and editors can add sub-tasks.");
    return { ok: true };
  });

export const updateCardTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: uuid,
        done: z.boolean().optional(),
        title: z.string().trim().min(1).max(160).optional(),
        dueDate: date.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { done?: boolean; title?: string; due_date?: string | null } = {};
    if (data.done !== undefined) patch.done = data.done;
    if (data.title !== undefined) patch.title = data.title;
    if (data.dueDate !== undefined) patch.due_date = data.dueDate;
    const { data: rows, error } = await context.supabase
      .from("card_tasks")
      .update(patch)
      .eq("id", data.taskId)
      .select("id");
    if (error || !rows?.length) throw new Error("Couldn't update this sub-task — you may have view-only access.");
    return { ok: true };
  });

export const deleteCardTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("card_tasks").delete().eq("id", data.taskId).select("id");
    if (error || !rows?.length) throw new Error("Couldn't delete this sub-task — you may have view-only access.");
    return { ok: true };
  });
