"use client"

import {
  Bell,
  ChevronRight,
  Clock,
  MapPin,
  MoreHorizontal,
  Plane,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ETAPE_LABELS, formatCurrency, formatDate } from "@/lib/constants"
import {
  brandVars,
  DEMANDES,
  DESTINATION_OPTIONS,
  FORM_FIELDS,
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

const INK = "#37352F"
const INK_SEC = "#787774"
const INK_MUT = "#9B9A97"
const HAIR = "#F1F1EF"

function CLogin() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-24">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center">
          <LogoMark size={44} radius={10} />
        </div>
        <h1 className="mt-6 text-center text-[28px] font-bold tracking-[-0.01em]">
          Connexion
        </h1>
        <p className="mt-1.5 text-center text-sm" style={{ color: INK_SEC }}>
          Espace de travail {SOCIETE_NOM}
        </p>

        <form className="mt-10 space-y-7" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="c-email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="c-email"
              type="email"
              placeholder="vous@exemple.ma"
              className="w-full border-0 border-b border-[#D4D3CF] bg-transparent px-0 pt-1 pb-2 text-[15px] text-[#37352F] transition-colors outline-none placeholder:text-[#C3C2BF] focus:border-(--brand) focus:ring-0"
            />
          </div>
          <div>
            <label
              htmlFor="c-password"
              className="mb-1 block text-sm font-medium"
            >
              Mot de passe
            </label>
            <input
              id="c-password"
              type="password"
              placeholder="••••••••"
              className="w-full border-0 border-b border-[#D4D3CF] bg-transparent px-0 pt-1 pb-2 text-[15px] text-[#37352F] transition-colors outline-none placeholder:text-[#C3C2BF] focus:border-(--brand) focus:ring-0"
            />
          </div>
          <button
            type="submit"
            className="h-10 w-full rounded-[4px] bg-(--brand) text-sm font-medium text-white shadow-[0_1px_2px_rgba(15,15,15,0.1)] transition-colors hover:bg-(--brand-dark)"
          >
            Continuer
          </button>
        </form>

        <div
          className="my-8 flex items-center gap-3 text-xs uppercase"
          style={{ color: INK_MUT }}
        >
          <span
            className="h-px flex-1"
            style={{ backgroundColor: "#E3E2E0" }}
          />
          Ou
          <span
            className="h-px flex-1"
            style={{ backgroundColor: "#E3E2E0" }}
          />
        </div>

        <div className="divide-y" style={{ borderColor: HAIR }}>
          <button className="flex w-full items-center gap-3 rounded-[3px] py-3 pr-2 pl-1 text-sm transition-colors hover:bg-[#F7F6F3]">
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
            Continuer avec Google
            <ChevronRight
              className="ml-auto size-4"
              style={{ color: INK_MUT }}
            />
          </button>
          <button className="flex w-full items-center gap-3 rounded-[3px] py-3 pr-2 pl-1 text-sm transition-colors hover:bg-[#F7F6F3]">
            <div
              className="flex size-4 items-center justify-center rounded-full border text-[9px] font-semibold"
              style={{ borderColor: INK_SEC }}
            >
              SSO
            </div>
            Continuer avec SSO
            <ChevronRight
              className="ml-auto size-4"
              style={{ color: INK_MUT }}
            />
          </button>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: INK_MUT }}>
          Nouveau sur {SOCIETE_NOM} ?{" "}
          <span
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: INK }}
          >
            S&apos;inscrire
          </span>
        </p>
      </div>
    </div>
  )
}

function CRail({ activeNav }: { activeNav: string }) {
  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center border-r py-3"
      style={{ borderColor: "#E3E2E0", backgroundColor: "#F7F6F3" }}
    >
      <LogoMark size={28} radius={7} />
      <nav className="mt-5 flex flex-col items-center gap-1">
        {NAV_GROUPS.flatMap((g) => g.items).map((item: NavItem) => {
          const Icon = NAV_ICONS[item.icon]
          const active = item.label === activeNav
          return (
            <button
              key={item.label}
              title={item.label}
              className={cn(
                "flex size-9 items-center justify-center rounded-[4px] transition-colors",
                active
                  ? "bg-(--brand)/12 text-[#0F766E]"
                  : "text-[#787774] hover:bg-[rgba(55,53,47,0.06)] hover:text-[#37352F]"
              )}
            >
              {Icon ? <Icon className="size-[18px]" /> : null}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto">
        <div
          className="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {UTILISATEUR.prenom[0]}
          {UTILISATEUR.nom[0]}
        </div>
      </div>
    </aside>
  )
}

function CTopBar({ breadcrumb }: { breadcrumb: string[] }) {
  return (
    <div className="flex items-center justify-between">
      <div
        className="flex items-center gap-1.5 text-[13px]"
        style={{ color: INK_SEC }}
      >
        {breadcrumb.map((part, i) => (
          <span key={part} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="size-3" style={{ color: INK_MUT }} />
            )}
            <span
              className={cn(
                i === breadcrumb.length - 1 && "font-medium text-[#37352F]"
              )}
            >
              {part}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <button
          className="rounded-[4px] p-1.5 transition-colors hover:bg-[rgba(55,53,47,0.06)]"
          title="Rechercher"
        >
          <Search className="size-4" style={{ color: INK_SEC }} />
        </button>
        <button
          className="rounded-[4px] p-1.5 transition-colors hover:bg-[rgba(55,53,47,0.06)]"
          title="Notifications"
        >
          <Bell className="size-4" style={{ color: INK_SEC }} />
        </button>
        <button
          className="rounded-[4px] p-1.5 transition-colors hover:bg-[rgba(55,53,47,0.06)]"
          title="Plus d'options"
        >
          <MoreHorizontal className="size-4" style={{ color: INK_SEC }} />
        </button>
      </div>
    </div>
  )
}

function CPageTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="mt-9">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-[4px] bg-(--brand)/10">
          {icon}
        </div>
        <h1 className="text-[30px] font-bold tracking-[-0.01em]">{title}</h1>
      </div>
      {subtitle && (
        <p className="mt-2 text-sm" style={{ color: INK_SEC }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

const GROUP_ORDER = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

function CList() {
  const groups = GROUP_ORDER.map((etape) => ({
    etape,
    label: ETAPE_LABELS[etape] ?? etape,
    items: DEMANDES.filter(
      (d) => d.etape === etape && d.decision === "PENDING"
    ),
  }))
    .concat([
      {
        etape: "APPROVED",
        label: "Approuvées",
        items: DEMANDES.filter((d) => d.decision === "APPROVED"),
      },
      {
        etape: "REJECTED",
        label: "Rejetées",
        items: DEMANDES.filter((d) => d.decision === "REJECTED"),
      },
    ])
    .filter((g) => g.items.length > 0)

  return (
    <div>
      <CTopBar
        breadcrumb={["Espace", "Demandes de déplacement", "Mes Demandes"]}
      />
      <CPageTitle
        icon={
          <Plane className="size-[18px]" style={{ color: "var(--brand)" }} />
        }
        title="Mes Demandes"
        subtitle="Toutes vos demandes de déplacement, triées par étape du circuit."
      />
      <div className="mt-8">
        {groups.map((group) => (
          <div key={group.etape} className="mt-7 first:mt-0">
            <div
              className="flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] uppercase"
              style={{ color: INK_SEC }}
            >
              {group.label}
              <span style={{ color: INK_MUT }}>{group.items.length}</span>
            </div>
            {group.items.map((d) => {
              const status = statusOf(d)
              return (
                <div
                  key={d.numero}
                  className="group flex cursor-pointer items-center gap-3 border-b py-3 transition-colors hover:bg-[rgba(55,53,47,0.024)]"
                  style={{ borderColor: HAIR }}
                >
                  <div
                    className="flex size-[30px] shrink-0 items-center justify-center rounded-[4px]"
                    style={{
                      backgroundColor:
                        status.tone === "success"
                          ? "rgba(15,118,110,0.12)"
                          : status.tone === "danger"
                            ? "rgba(180,35,24,0.1)"
                            : status.tone === "pending"
                              ? "rgba(139,94,14,0.12)"
                              : "#F1F1EF",
                    }}
                  >
                    <MapPin
                      className="size-4"
                      style={{
                        color:
                          status.tone === "success"
                            ? "#0F6E4F"
                            : status.tone === "danger"
                              ? "#B42318"
                              : status.tone === "pending"
                                ? "#8B5E0E"
                                : INK_SEC,
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#37352F]">
                      {d.employe.prenom} {d.employe.nom} — {d.destination}
                    </p>
                    <p
                      className="mt-0.5 truncate text-[13px]"
                      style={{ color: INK_SEC }}
                    >
                      {d.numero} · {formatDate(d.dateDepart)} →{" "}
                      {formatDate(d.dateRetour)} ·{" "}
                      {formatCurrency(d.totalEstime)}
                    </p>
                  </div>
                  <StatusPill
                    label={status.label}
                    tone={status.tone}
                    className="hidden sm:inline-flex"
                  />
                  <ChevronRight
                    className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: INK_MUT }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function CForm() {
  return (
    <div>
      <CTopBar
        breadcrumb={["Espace", "Demandes de déplacement", "Nouvelle Demande"]}
      />
      <CPageTitle
        icon={
          <MapPin className="size-[18px]" style={{ color: "var(--brand)" }} />
        }
        title="Nouvelle Demande"
        subtitle="Décrivez le déplacement ci-dessous. Les propriétés vides seront ignorées."
      />
      <div className="mt-7">
        {FORM_FIELDS.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-6 border-b py-3.5"
            style={{ borderColor: HAIR }}
          >
            <label className="w-44 shrink-0 text-sm" style={{ color: INK_SEC }}>
              {f.label}
            </label>
            {f.type === "select" ? (
              <select
                className="flex-1 border-0 bg-transparent px-0 py-0 text-[15px] text-[#37352F] outline-none focus:ring-0"
                style={{ color: INK }}
              >
                <option value="">{f.placeholder}</option>
                {(f.label === "Destination"
                  ? DESTINATION_OPTIONS
                  : f.label === "Motif"
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
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder || "—"}
                className="flex-1 border-0 bg-transparent px-0 py-0 text-[15px] text-[#37352F] outline-none placeholder:text-[#C3C2BF] focus:ring-0"
              />
            )}
          </div>
        ))}
        <div
          className="flex items-center gap-6 py-3.5"
          style={{ borderColor: HAIR }}
        >
          <span className="w-44 shrink-0 text-sm" style={{ color: INK_SEC }}>
            Avance requise
          </span>
          <input type="checkbox" className="size-4 accent-(--brand)" />
        </div>
      </div>
      <div className="mt-7 flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-sm"
          style={{ color: INK_SEC }}
        >
          <Clock className="size-4" />
          Enregistrer en brouillon
        </button>
        <div className="flex items-center gap-2">
          <button className="h-8 rounded-[3px] px-3 text-sm transition-colors hover:bg-[rgba(55,53,47,0.06)]">
            Annuler
          </button>
          <button className="h-8 rounded-[3px] bg-(--brand) px-4 text-sm font-medium text-white transition-colors hover:bg-(--brand-dark)">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export function VariantC({
  surface,
  activeNav,
}: {
  surface: Surface
  activeNav: string
}) {
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-white text-[#37352F]"
      style={brandVars}
    >
      {surface === "login" ? (
        <CLogin />
      ) : (
        <div className="flex min-h-0 flex-1">
          <CRail activeNav={activeNav} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-8 py-10">
              {surface === "liste" ? <CList /> : <CForm />}
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
