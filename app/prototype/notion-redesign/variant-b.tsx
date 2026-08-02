"use client"

import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Menu,
  Search,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/constants"
import {
  brandVars,
  DEMANDES,
  DESTINATION_OPTIONS,
  MOTIF_OPTIONS,
  NAV_GROUPS,
  NAV_ICONS,
  SOCIETE_NOM,
  TRANSPORT_OPTIONS,
  UTILISATEUR,
  LogoMark,
  StatusPill,
  statusOf,
  type NavItem,
} from "./mock-data"
import type { Surface } from "./prototype-host"

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm shadow-xs outline-none transition-all placeholder:text-muted-foreground focus:border-(--brand) focus:ring-2 focus:ring-(--brand)/20"

function BLogin() {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-(--brand) p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark size={32} radius={8} />
          <span className="text-base font-semibold">{SOCIETE_NOM}</span>
        </div>
        <div>
          <p className="text-[32px] leading-snug font-semibold tracking-tight">
            Déplacements professionnels,
            <br />
            validés en toute simplicité.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Suivez vos demandes de déplacement du brouillon à l&apos;approbation
            finale, avec un suivi clair à chaque étape.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/20 pt-6">
            {[
              { value: "1 240", label: "Demandes traitées" },
              { value: "1,8 j", label: "Délai moyen" },
              { value: "96 %", label: "Approuvées" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="mt-0.5 text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/50">
          © 2026 {SOCIETE_NOM} — Tous droits réservés
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <LogoMark size={44} radius={12} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenue</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Connectez-vous à votre espace de travail
          </p>

          <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label
                htmlFor="b-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email
              </label>
              <input
                id="b-email"
                type="email"
                placeholder="vous@exemple.ma"
                className={inputCls}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="b-password" className="text-sm font-medium">
                  Mot de passe
                </label>
                <span className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Mot de passe oublié ?
                </span>
              </div>
              <input
                id="b-password"
                type="password"
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-(--brand) text-sm font-semibold text-white shadow-sm transition-colors hover:bg-(--brand-dark)">
              Se connecter
              <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou continuer avec
            <span className="h-px flex-1 bg-border" />
          </div>

          <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted">
            <svg className="size-4" viewBox="0 0 24 24">
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

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Nouveau sur {SOCIETE_NOM} ?{" "}
            <span className="font-medium text-foreground underline-offset-2 hover:underline">
              Créer un compte
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function BSidebar({ activeNav }: { activeNav: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <LogoMark size={30} radius={8} />
        <span className="flex-1 truncate text-[15px] font-semibold">
          {SOCIETE_NOM}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <p className="px-3 pt-4 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {group.section}
            </p>
            {group.items.map((item: NavItem) => {
              const Icon = NAV_ICONS[item.icon]
              const active = item.label === activeNav
              return (
                <div
                  key={item.label}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-(--brand)/10 font-medium text-[#0B5F55]"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-(--brand)" />
                  )}
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.label === "Mes Demandes" && (
                    <span className="rounded-full bg-(--brand)/10 px-1.5 text-[11px] font-semibold text-[#0B5F55]">
                      4
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-border p-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {UTILISATEUR.prenom[0]}
          {UTILISATEUR.nom[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {UTILISATEUR.prenom} {UTILISATEUR.nom}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {UTILISATEUR.role}
          </p>
        </div>
      </div>
    </aside>
  )
}

const FILTERS = ["Toutes", "Brouillons", "En attente", "Approuvées", "Rejetées"]

function BList() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes Demandes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {DEMANDES.length} demandes au total
          </p>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-lg bg-(--brand) px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-(--brand-dark)">
          <FileText className="size-4" />
          Nouvelle demande
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            className={cn(
              "h-8 rounded-full border px-3.5 text-sm transition-colors",
              i === 0
                ? "border-transparent bg-(--brand) font-medium text-white"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-2 sm:flex">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="Rechercher une demande..."
            className="h-8 w-52 border-b border-border bg-transparent text-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-(--brand)"
          />
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEMANDES.map((d) => {
          const status = statusOf(d)
          return (
            <div
              key={d.numero}
              className="group cursor-pointer rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusPill label={status.label} tone={status.tone} />
                <span className="text-xs text-muted-foreground">
                  {d.numero}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-[#0F766E]" />
                <h3 className="truncate text-lg font-semibold tracking-tight">
                  {d.destination}
                </h3>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {d.employe.prenom} {d.employe.nom}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {formatDate(d.dateDepart)} → {formatDate(d.dateRetour)}
              </p>
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase">
                    Total estimé
                  </p>
                  <p className="text-base font-semibold">
                    {formatCurrency(d.totalEstime)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {d.avance != null && (
                    <span className="flex items-center gap-1 rounded-full bg-(--brand)/10 px-2 py-0.5 text-[11px] font-medium text-[#0B5F55]">
                      <Wallet className="size-3" />
                      Avance
                    </span>
                  )}
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-(--brand) group-hover:text-white">
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BFormField({
  label,
  type,
  placeholder,
}: {
  label: string
  type: "text" | "date" | "select" | "number"
  placeholder?: string
}) {
  const common =
    "h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm shadow-xs outline-none transition-all placeholder:text-muted-foreground focus:border-(--brand) focus:ring-2 focus:ring-(--brand)/20"
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {type === "select" ? (
        <select className={cn(common, "appearance-none")}>
          <option value="">{placeholder}</option>
          {(label === "Destination"
            ? DESTINATION_OPTIONS
            : label === "Motif"
              ? MOTIF_OPTIONS
              : TRANSPORT_OPTIONS.map((o) => o.label)
          ).map((o: string) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          className={cn(common, type === "date" && "appearance-none")}
        />
      )}
    </div>
  )
}

function BForm() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">
        Nouvelle demande de déplacement
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Renseignez les informations du déplacement. L&apos;estimation et le
        suivi se mettent à jour en temps réel.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground uppercase">
              Déplacement
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <BFormField
                label="Destination"
                type="select"
                placeholder="Choisir une ville"
              />
              <BFormField
                label="Motif"
                type="select"
                placeholder="Choisir un motif"
              />
              <BFormField
                label="Type de transport"
                type="select"
                placeholder="Choisir un moyen"
              />
              <div className="grid grid-cols-2 gap-4">
                <BFormField label="Départ" type="date" />
                <BFormField label="Retour" type="date" />
              </div>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div>
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground uppercase">
              Estimation des frais
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <BFormField
                label="Transport (Dhs)"
                type="number"
                placeholder="0,00"
              />
              <BFormField
                label="Hébergement (Dhs)"
                type="number"
                placeholder="0,00"
              />
              <BFormField
                label="Repas (Dhs)"
                type="number"
                placeholder="0,00"
              />
              <BFormField
                label="Divers (Dhs)"
                type="number"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Estimation des frais</p>
            <dl className="mt-4 space-y-2.5 text-sm">
              {[
                ["Transport", "1 200,00 Dhs"],
                ["Hébergement", "0,00 Dhs"],
                ["Repas", "0,00 Dhs"],
                ["Divers", "0,00 Dhs"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <dt className="text-sm font-semibold">Total</dt>
              <dd className="text-lg font-bold text-[#0F766E]">
                {formatCurrency(1200)}
              </dd>
            </div>
          </div>

          <div className="rounded-xl border border-(--brand)/25 bg-(--brand)/5 p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="size-4 text-[#0F766E]" />
                Avance
              </p>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer size-4 appearance-none rounded-[4px] border border-border bg-background checked:border-(--brand) checked:bg-(--brand)"
                />
                <span className="pointer-events-none absolute top-1/2 left-[7px] -translate-y-1/2 text-[10px] text-white opacity-0 peer-checked:opacity-100">
                  ✓
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Une avance est versée avant le départ, sur approbation.
            </p>
            <input
              type="number"
              placeholder="Montant (Dhs)"
              className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm transition-all outline-none placeholder:text-muted-foreground focus:border-(--brand) focus:ring-2 focus:ring-(--brand)/20"
            />
          </div>

          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-(--brand) text-sm font-semibold text-white shadow-sm transition-colors hover:bg-(--brand-dark)">
            Enregistrer la demande
            <ArrowRight className="size-4" />
          </button>
          <button className="h-11 w-full rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Enregistrer en brouillon
          </button>
        </div>
      </div>
    </div>
  )
}

export function VariantB({
  surface,
  activeNav,
}: {
  surface: Surface
  activeNav: string
}) {
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-background"
      style={brandVars}
    >
      {surface === "login" ? (
        <BLogin />
      ) : (
        <div className="flex min-h-0 flex-1">
          <BSidebar activeNav={activeNav} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-5">
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg p-1.5 hover:bg-muted lg:hidden"
                  title="Menu"
                >
                  <Menu className="size-4" />
                </button>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Espace</span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{activeNav}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Rechercher"
                >
                  <Search className="size-4" />
                </button>
                <button
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Notifications"
                >
                  <Bell className="size-4" />
                </button>
                <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-(--brand)/10 text-xs font-semibold text-[#0B5F55]">
                  {UTILISATEUR.prenom[0]}
                  {UTILISATEUR.nom[0]}
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">
              {surface === "liste" ? <BList /> : <BForm />}
            </main>
          </div>
        </div>
      )}
    </div>
  )
}
