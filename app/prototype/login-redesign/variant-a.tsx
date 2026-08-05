"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, Star } from "lucide-react"
import { cn } from "@/lib/utils"

// Variant A — "Split hero": the ReUI spec, verbatim. Dark 50% brand panel
// (gradient glows, logo, testimonial carousel, Trustpilot proof) + light 50%
// form panel. Left panel hidden on mobile.

const TESTIMONIALS = [
  {
    quote:
      "ReUI gave us one calm place to sign in — no more password roulette across six tools. Onboarding new hires went from an afternoon to ten minutes.",
    name: "Jonah Price",
    title: "Product Lead at NimbleStage",
    initials: "JP",
  },
  {
    quote:
      "The magic-link flow cut our support tickets in half. Teams stop asking 'which login was that again?' — it just works, every time.",
    name: "Maya Chen",
    title: "CTO at Fieldwork",
    initials: "MC",
  },
  {
    quote:
      "We rolled ReUI out to 400 people on a Monday. Zero complaints, zero lockouts. That has literally never happened with any other tool.",
    name: "Adrian Nowak",
    title: "Founder at Lumen",
    initials: "AN",
  },
]

function BrandPanel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % TESTIMONIALS.length),
      6000
    )
    return () => clearInterval(t)
  }, [])

  const visible = [
    TESTIMONIALS[(index - 1 + TESTIMONIALS.length) % TESTIMONIALS.length],
    TESTIMONIALS[index],
    TESTIMONIALS[(index + 1) % TESTIMONIALS.length],
  ]

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0B0F17] p-12 text-white lg:flex">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="absolute top-1/3 -right-40 size-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 size-96 rounded-full bg-purple-600/20 blur-3xl" />
        <svg
          className="absolute inset-0 h-full w-full opacity-20"
          viewBox="0 0 800 800"
          fill="none"
        >
          <path
            d="M0 640c160-120 320 80 480-40s240-80 320 40"
            stroke="url(#a-glow)"
            strokeWidth="2"
          />
          <path
            d="M0 520c180 60 260-160 440-100s260 40 360-20"
            stroke="url(#a-glow)"
            strokeWidth="2"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="a-glow" x1="0" y1="0" x2="800" y2="800">
              <stop stopColor="#E879F9" />
              <stop offset="0.5" stopColor="#818CF8" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 font-bold">
          U
        </div>
        <span className="text-lg font-semibold tracking-tight">ReUI</span>
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Access With Trust</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Give teams a calm, confident first touch before work begins. Secure
          access, backed by trusted proof.
        </p>

        <div
          className="relative mt-10 h-56"
          role="region"
          aria-label="Customer testimonials"
        >
          {visible.map((t, i) => {
            const isActive = i === 1
            const offset = i - 1
            return (
              <div
                key={t.name}
                aria-hidden={!isActive}
                className={cn(
                  "absolute inset-x-0 top-0 rounded-2xl p-6 transition-all duration-500",
                  isActive
                    ? "z-10 translate-x-0 scale-100 bg-white text-slate-900 shadow-xl"
                    : "z-0 translate-x-24 bg-white/10 opacity-50",
                  offset === -1 && !isActive && "-translate-x-24"
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2",
                    !isActive && "opacity-60"
                  )}
                >
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                </div>
                <p
                  className={cn(
                    "mt-3 text-sm leading-relaxed",
                    isActive ? "text-slate-700" : "text-slate-300"
                  )}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-white/20 text-white"
                    )}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        !isActive && "text-slate-200"
                      )}
                    >
                      {t.name}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        isActive ? "text-slate-500" : "text-slate-400"
                      )}
                    >
                      {t.title}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="mt-6 flex gap-2"
          role="tablist"
          aria-label="Testimonial slides"
        >
          {TESTIMONIALS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show testimonial from ${t.name}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      </div>

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
        <span className="text-sm font-semibold tracking-tight">Trustpilot</span>
      </div>
      <p className="relative mt-2 text-sm text-slate-400">
        Trusted by 14,800+ founders building production software.
      </p>
    </div>
  )
}

const inputCls =
  "flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    if (!password) next.password = "Enter your password."
    setErrors(next)
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-white px-6 py-12 sm:px-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-sm font-bold text-white">
              U
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              ReUI
            </span>
          </div>
          <div className="mt-8 h-px bg-slate-100" />
        </div>

        <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sign in with your workspace credentials.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="a-email"
                className="text-sm font-medium text-slate-900"
              >
                Email or username
              </label>
            </div>
            <input
              id="a-email"
              type="text"
              placeholder="Email or username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "a-email-error" : undefined}
              className={cn(
                inputCls,
                "mt-1.5",
                errors.email && "border-red-400"
              )}
            />
            {errors.email && (
              <p id="a-email-error" className="mt-1.5 text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="a-password"
                className="text-sm font-medium text-slate-900"
              >
                Password
              </label>
              <a
                href="#"
                className="text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-600"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative mt-1.5">
              <input
                id="a-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "a-password-error" : undefined
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
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4.5" />
                ) : (
                  <Eye className="size-4.5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="a-password-error" className="mt-1.5 text-xs text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:outline-none"
          >
            Sign in
          </button>
        </form>

        <div className="my-8 flex items-center gap-3" role="separator">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-500">Or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:outline-none"
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
            Google
          </button>
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:outline-none"
          >
            <svg
              className="size-4.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
            </svg>
            Apple
          </button>
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:outline-none"
          >
            <svg
              className="size-4.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            GitHub
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Need an account?{" "}
          <a
            href="#"
            className="font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600"
          >
            Sign up
          </a>
        </p>

        <p className="mt-10 text-center text-xs text-slate-400">
          © 2026 ReUI •{" "}
          <a href="#" className="hover:text-slate-600">
            Terms
          </a>{" "}
          •{" "}
          <a href="#" className="hover:text-slate-600">
            Privacy
          </a>{" "}
          •{" "}
          <a href="#" className="hover:text-slate-600">
            Help
          </a>
        </p>
      </div>
    </div>
  )
}

export function VariantA() {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <BrandPanel />
      <AuthForm />
    </div>
  )
}
