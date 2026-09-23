import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { KineticBackground } from "@/components/kinetic-background";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Meridian" },
      { name: "description", content: "Sign in or create your Meridian account to manage workspaces and members." },
      { property: "og:title", content: "Sign in — Meridian" },
      { property: "og:description", content: "Sign in or create your Meridian account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/workspaces", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          toast.success("Check your email", { description: "Confirm your address to finish creating your account." });
          return;
        }
        navigate({ to: "/workspaces", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/workspaces", replace: true });
      }
    } catch (error) {
      toast.error(mode === "signup" ? "Couldn't create your account" : "Couldn't sign you in", {
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed", { description: result.error.message ?? "Please try again." });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/workspaces", replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <KineticBackground />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-volt/30 bg-volt/10 font-display text-lg font-bold text-volt">
            M
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-none tracking-tight">Meridian</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-mist">Workspaces · Roles</p>
          </div>
        </Link>

        <div className="glass-panel rounded-2xl p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-mist">
            {mode === "signin"
              ? "Pick up where your team left off."
              : "You'll get your own workspace to invite people into."}
          </p>

          {confirmSent ? (
            <div className="mt-5 rounded-xl border border-volt/30 bg-volt/10 p-4 text-sm text-ice">
              We sent a confirmation link to <span className="font-semibold">{email}</span>. Open it to activate your
              account, then come back and sign in.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {mode === "signup" && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="fullName">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Kim"
                    className="mt-1.5 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm text-foreground placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1.5 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm text-foreground placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.14em] text-mist" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1.5 w-full rounded-xl border border-border bg-ink2/70 px-3 py-2 text-sm text-foreground placeholder:text-mist/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-volt px-4 py-2.5 text-sm font-semibold text-ink shadow-volt transition-transform hover:-translate-y-px disabled:opacity-60"
              >
                {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>

              <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-[0.14em] text-mist/70">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full rounded-xl border border-border bg-frost/60 px-4 py-2.5 text-sm font-medium text-ice transition-colors hover:bg-accent disabled:opacity-60"
              >
                Continue with Google
              </button>
            </form>
          )}

          <p className="mt-5 text-xs text-mist">
            {mode === "signin" ? "New to Meridian?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setConfirmSent(false);
              }}
              className="font-semibold text-volt hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
