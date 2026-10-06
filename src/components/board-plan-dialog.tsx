import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { createBoardFromPlan, generateBoardPlan, type BoardPlan } from "@/lib/board-plan.functions";

const MIN_BRIEF = 40;

export function BoardPlanDialog({
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
  const [brief, setBrief] = useState("");
  const [plan, setPlan] = useState<BoardPlan | null>(null);
  const run = useServerFn(generateBoardPlan);
  const build = useServerFn(createBoardFromPlan);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const buildMutation = useMutation({
    mutationFn: async (p: BoardPlan) => {
      const result = await build({ data: { workspaceId, brief: brief.trim(), plan: p } });
      if (!result.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: async (result) => {
      toast.success("Board created", { description: `${result.cards} cards are ready to work on.` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["boards", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["roadmap", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
      setPlan(null);
      onClose();
      navigate({ to: "/workspaces/$workspaceId/boards/$boardId", params: { workspaceId, boardId: result.boardId } });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't create the board", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  const mutation = useMutation({
    mutationFn: async (input: { workspaceId: string; brief: string }) => {
      const result = await run({ data: input });
      if (!result.ok) throw new Error(result.message);
      return result.plan;
    },
    onSuccess: (result) => {
      setPlan(result);
      toast.success("Board plan ready", {
        description: `${result.columns.length} columns, ${result.columns.reduce((n, c) => n + c.cards.length, 0)} cards.`,
      });
    },
    onError: (error: unknown) =>
      toast.error("Couldn't build the plan", {
        description: error instanceof Error ? error.message : "Please try again.",
      }),
  });

  if (!open) return null;

  const tooShort = brief.trim().length < MIN_BRIEF;

  const close = () => {
    setPlan(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm">
      <div className="glass-panel max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-ink2/95 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Plan for {workspaceName}</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight">Turn a brief into a board plan</h2>
          </div>
          <button onClick={close} className="rounded-md px-2 text-lg leading-none text-mist hover:text-ice">
            ×
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (tooShort) return;
            mutation.mutate({ workspaceId, brief: brief.trim() });
          }}
        >
          <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="brief">
            Project brief
          </label>
          <textarea
            id="brief"
            rows={5}
            maxLength={4000}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="We're relaunching our marketing site in six weeks. Two designers, three engineers, a new pricing page and a migration off the old CMS…"
            className="w-full resize-y rounded-xl border border-border bg-ink/70 px-3 py-2.5 text-sm leading-relaxed placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-mist">
              {tooShort
                ? `Add a little more detail — at least ${MIN_BRIEF} characters.`
                : "Goals, timeline, team and constraints give the best plan."}
            </p>
            <button
              type="submit"
              disabled={mutation.isPending || tooShort}
              className="shrink-0 rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px disabled:opacity-50"
            >
              {mutation.isPending ? "Thinking…" : plan ? "Regenerate plan" : "Generate plan"}
            </button>
          </div>
        </form>

        {mutation.isPending ? (
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-panel animate-pulse rounded-xl p-4">
                <div className="h-3 w-32 rounded bg-frost" />
                <div className="mt-3 h-3 w-full rounded bg-frost/70" />
                <div className="mt-2 h-3 w-2/3 rounded bg-frost/50" />
              </div>
            ))}
          </div>
        ) : null}

        {plan && !mutation.isPending ? (
          <div className="mt-5 space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Suggested board</p>
              <h3 className="mt-1 font-display text-lg font-bold tracking-tight">{plan.boardName}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mist">{plan.summary}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {plan.columns.map((column) => (
                <div key={column.name} className="glass-panel rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-display text-sm font-bold tracking-tight text-ice">{column.name}</h4>
                    <span className="text-[11px] text-mist">{column.cards.length} cards</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-mist">{column.purpose}</p>
                  <ul className="mt-3 space-y-2">
                    {column.cards.map((card) => (
                      <li key={card.title} className="rounded-lg border border-border bg-ink/60 px-3 py-2">
                        <p className="text-sm font-semibold text-ice">{card.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-mist">{card.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {card.labels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-volt/40 bg-volt/10 px-2 py-0.5 text-[10px] text-volt"
                            >
                              {label}
                            </span>
                          ))}
                          <span className="text-[10px] uppercase tracking-[0.12em] text-mist">
                            {card.suggestedRole}
                            {card.dueInDays === null ? "" : ` · ${card.dueInDays}d`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {plan.risks.length > 0 ? (
              <div className="glass-panel rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Watch out for</p>
                <ul className="mt-2 space-y-1.5">
                  {plan.risks.map((risk) => (
                    <li key={risk} className="text-sm leading-relaxed text-mist">
                      · {risk}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
              <p className="text-[11px] leading-relaxed text-mist">
                Creates a board with these columns and cards. Due dates count from today; you can assign people afterwards.
              </p>
              <button
                type="button"
                onClick={() => buildMutation.mutate(plan)}
                disabled={buildMutation.isPending}
                className="shrink-0 rounded-xl bg-volt px-4 py-2 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px disabled:opacity-50"
              >
                {buildMutation.isPending ? "Creating board…" : "Create this board"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
