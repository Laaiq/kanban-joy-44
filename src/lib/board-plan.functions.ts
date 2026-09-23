import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PlanCard = {
  title: string;
  description: string;
  labels: string[];
  suggestedRole: "owner" | "editor" | "viewer";
  dueInDays: number | null;
};

export type PlanColumn = {
  name: string;
  purpose: string;
  cards: PlanCard[];
};

export type BoardPlan = {
  boardName: string;
  summary: string;
  columns: PlanColumn[];
  risks: string[];
};

export type BoardPlanResult = { ok: true; plan: BoardPlan } | { ok: false; message: string };

const planSchema = z.object({
  boardName: z.string(),
  summary: z.string(),
  columns: z.array(
    z.object({
      name: z.string(),
      purpose: z.string(),
      cards: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          labels: z.array(z.string()),
          suggestedRole: z.enum(["owner", "editor", "viewer"]),
          dueInDays: z.number().nullable(),
        }),
      ),
    }),
  ),
  risks: z.array(z.string()),
});

const SYSTEM_PROMPT = [
  "You are a senior delivery lead who turns rough project briefs into Kanban board plans.",
  "Return 3 to 5 columns that describe a real workflow for this brief (not generic filler).",
  "Each column holds 2 to 5 cards. Card titles are short and action-oriented; descriptions are one or two sentences with a concrete definition of done.",
  "Use at most 3 short lowercase labels per card. dueInDays is a whole number of days from today, or null when timing is unclear.",
  "suggestedRole reflects who should drive the card: owner for decisions and approvals, editor for hands-on delivery, viewer for review-only items.",
  "Keep the whole plan under 18 cards and never invent facts that contradict the brief.",
].join(" ");

export const generateBoardPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        brief: z.string().trim().min(40).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<BoardPlanResult> => {
    const { supabase, userId } = context;

    const { data: membership, error: roleError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) return { ok: false, message: roleError.message };
    if (!membership || (membership.role !== "owner" && membership.role !== "editor")) {
      return { ok: false, message: "Only owners and editors can generate a board plan." };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, message: "AI is not configured for this workspace yet." };

    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM_PROMPT,
        prompt: `Project brief:\n\n${data.brief}`,
        output: Output.object({ schema: planSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const plan = await result.output;
      return { ok: true, plan };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { ok: false, message: "The plan came back incomplete. Try a slightly more detailed brief." };
      }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("402")) {
        return { ok: false, message: "AI credits are exhausted for this workspace. Top up to keep planning." };
      }
      if (message.includes("429")) {
        return { ok: false, message: "Too many plan requests right now. Give it a few seconds and try again." };
      }
      console.error("generateBoardPlan failed", error);
      return { ok: false, message: "Couldn't build a plan just now. Please try again." };
    }
  });
