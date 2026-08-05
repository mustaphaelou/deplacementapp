"use client"

import { useState } from "react"
import { ArrowRight, Eye, EyeOff, Star } from "lucide-react"
import { cn } from "@/lib/utils"

// Variant C — "Inverted split, dark glass": 50/50 split flipped — dark glass
// form on the LEFT, brand panel on the RIGHT. Primary affordance is a
// passwordless magic link; the password field is hidden behind a toggle.
// SSO buttons are icon-only. No carousel — one featured quote.

const inputCls =
  "flex h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3.5 text-sm text-white shadow-xs outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"

export function VariantC() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [usePassword, setUsePassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = "Enter your email or username."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "That doesn't look like a valid email."
    if (usePassword && !password) next.password = "Enter your password."
    setErrors(next)
  }

  return (
    <div className="grid min-h-dvh bg-[#0B0F17] lg:grid-cols-2">
      <section className="relative flex flex-col justify-center overflow-hidden bg-[#0B0F17] px-6 py-14 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="absolute -top-32 -left-32 size-96 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute right-0 -bottom-32 size-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 font-bold text-white">
              U
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              ReUI
            </span>
          </div>

          <h1 className="mt-10 text-2xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            No passwords to remember — we&apos;ll email you a secure link.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="c-email"
                className="text-sm font-medium text-slate-200"
              >
                Email or username
              </label>
              <input
                id="c-email"
                type="text"
                placeholder="Email or username"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "c-email-error" : undefined}
                className={cn(
                  inputCls,
                  "mt-1.5",
                  errors.email && "border-red-400"
                )}
              />
              {errors.email && (
                <p id="c-email-error" className="mt-1.5 text-xs text-red-400">
                  {errors.email}
                </p>
              )}
            </div>

            {usePassword && (
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="c-password"
                    className="text-sm font-medium text-slate-200"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-sm font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="c-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "c-password-error" : undefined
                    }
                    className={cn(
                      inputCls,
                      "pr-11",
                      errors.password && "border-red-400"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-200"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4.5" />
                    ) : (
                      <Eye className="size-4.5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="c-password-error"
                    className="mt-1.5 text-xs text-red-400"
                  >
                    {errors.password}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              {usePassword ? "Sign in" : "Send magic link"}
              <ArrowRight className="size-4" />
            </button>
          </form>

          <button
            type="button"
            onClick={() => setUsePassword((u) => !u)}
            className="mt-4 text-sm font-medium text-slate-400 underline underline-offset-4 hover:text-slate-200"
          >
            {usePassword
              ? "Prefer a magic link instead"
              : "Use password instead"}
          </button>

          <div className="my-8 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">or continue with</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              aria-label="Continue with Google"
              className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
            >
              <svg className="size-4.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Continue with Apple"
              className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
            >
              <svg
                className="size-4.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Continue with GitHub"
              className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
            >
              <svg
                className="size-4.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-400">
            Need an account?{" "}
            <a
              href="#"
              className="font-semibold text-white underline underline-offset-4 hover:text-slate-300"
            >
              Sign up
            </a>
          </p>

          <p className="mt-10 text-center text-xs text-slate-500">
            © 2026 ReUI •{" "}
            <a href="#" className="hover:text-slate-400">
              Terms
            </a>{" "}
            •{" "}
            <a href="#" className="hover:text-slate-400">
              Privacy
            </a>{" "}
            •{" "}
            <a href="#" className="hover:text-slate-400">
              Help
            </a>
          </p>
        </div>
      </section>

      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1A1030] via-[#0B0F17] to-[#06202A] p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute top-1/4 -left-24 size-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
          <div className="absolute -right-32 bottom-0 size-96 rounded-full bg-cyan-500/20 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 font-bold">
            U
          </div>
          <span className="text-2xl font-bold tracking-tight">ReUI</span>
        </div>

        <figure className="relative max-w-md">
          <blockquote className="text-3xl leading-snug font-semibold tracking-tight">
            &ldquo;The first thing your team sees in the morning should not be a
            login screen that fights back.&rdquo;
          </blockquote>
          <figcaption className="mt-8 flex items-center gap-4">
            <div className="rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 p-0.5">
              <div className="flex size-11 items-center justify-center rounded-full bg-[#0B0F17] text-sm font-bold">
                JP
              </div>
            </div>
            <div>
              <p className="font-semibold">Jonah Price</p>
              <p className="text-sm text-slate-400">
                Product Lead at NimbleStage
              </p>
            </div>
          </figcaption>
        </figure>

        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">Excellent</span>
            <div className="flex" aria-label="5 out of 5 stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className="size-4 fill-emerald-500 text-emerald-500"
                />
              ))}
            </div>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Trustpilot
          </span>
        </div>
        <p className="relative mt-2 text-sm text-slate-400">
          Trusted by 14,800+ founders building production software.
        </p>
      </section>
    </div>
  )
}
