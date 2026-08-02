"use client"

import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  MapPin,
  Search,
  MoreHorizontal,
  Plane,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/constants"
import {
  brandVars,
  DEMANDES,
  NAV_GROUPS,
  NAV_ICONS,
  SOCIETE_NOM,
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
const HAIR = "rgba(55,53,47,0.09)"
const INPUT_BORDER = "rgba(55,53,47,0.15)"

const inputCls =
  "h-9 w-full rounded-[3px] border bg-white px-3 text-sm text-[#37352F] outline-none transition-shadow placeholder:text-[#9B9A97] focus:ring-1 focus:ring-(--brand)"

function ALogin() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-[380px] max-w-full">
        <div className="flex justify-center">
          <LogoMark size={48} radius={10} />
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">
          {SOCIETE_NOM}
        </h1>
        <p className="mt-1.5 text-center text-sm" style={{ color: INK_SEC }}>
          Connectez-vous à votre espace de travail
        </p>

        <form className="mt-8" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="a-email" className="mb-1.5 block text-sm">
            Email
          </label>
          <input
            id="a-email"
            type="email"
            placeholder="vous@exemple.ma"
            className={inputCls}
            style={{ borderColor: INPUT_BORDER }}
          />
          <label htmlFor="a-password" className="mt-4 mb-1.5 block text-sm">
            Mot de passe
          </label>
          <input
            id="a-password"
            type="password"
            placeholder="••••••••"
            className={inputCls}
            style={{ borderColor: INPUT_BORDER }}
          />
          <button
            type="submit"
            className="mt-6 h-9 w-full rounded-[3px] bg-(--brand) text-sm font-medium text-white shadow-[0_1px_2px_rgba(15,15,15,0.1)] transition-colors hover:bg-(--brand-dark)"
          >
            Continuer
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ backgroundColor: HAIR }} />
          <span className="text-xs uppercase" style={{ color: INK_MUT }}>
            Ou
          </span>
          <span className="h-px flex-1" style={{ backgroundColor: HAIR }} />
        </div>

        <button
          className="flex h-9 w-full items-center justify-center gap-2 rounded-[3px] border bg-white text-sm transition-colors hover:bg-[rgba(55,53,47,0.04)]"
          style={{ borderColor: INPUT_BORDER }}
        >
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
        </button>

        <div className="mt-8 space-y-1 text-center">
          <p className="text-xs" style={{ color: INK_MUT }}>
            Nouveau sur {SOCIETE_NOM} ?{" "}
            <span
              className="cursor-pointer font-medium underline-offset-2 hover:underline"
              style={{ color: INK }}
            >
              S&apos;inscrire
            </span>
          </p>
          <p className="text-xs" style={{ color: INK_MUT }}>
            Application de gestion des demandes de déplacement
          </p>
        </div>
      </div>
    </div>
  )
}

function SidebarRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.icon]
  return (
    <div
      className="group relative flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-sm transition-colors hover:bg-[rgba(55,53,47,0.06)]"
      style={active ? { backgroundColor: "rgba(0,0,0,0.03)" } : undefined}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className={cn("flex-1 truncate", active && "font-medium")}>
        {item.label}
      </span>
      <ChevronRight
        className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: INK_MUT }}
      />
    </div>
  )
}

function ASidebar({ activeNav }: { activeNav: string }) {
  return (
    <aside
      className="flex w-60 shrink-0 flex-col bg-[#F7F6F3]"
      style={{ boxShadow: "inset -1px 0 0 0 #f0efed" }}
    >
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1">
        <LogoMark size={20} radius={4} />
        <span className="flex-1 truncate text-sm font-medium">
          {SOCIETE_NOM}
        </span>
        <ChevronDown className="size-3" style={{ color: INK_MUT }} />
        <button
          className="rounded-[3px] p-1 transition-colors hover:bg-[rgba(55,53,47,0.06)]"
          title="Réduire la barre latérale"
        >
          <ChevronsLeft className="size-3.5" style={{ color: INK_SEC }} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 py-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <div
              className="mt-3 mb-1 px-2 text-[11px] font-medium tracking-[0.06em] uppercase"
              style={{ color: INK_SEC }}
            >
              {group.section}
            </div>
            {group.items.map((item) => (
              <SidebarRow
                key={item.label}
                item={item}
                active={item.label === activeNav}
              />
            ))}
          </div>
        ))}
      </nav>
      <div
        className="flex items-center gap-2 border-t px-2 py-2"
        style={{ borderColor: "#E3E2E0" }}
      >
        <div className="flex size-6 items-center justify-center rounded-[3px] bg-[#F1F1EF] text-[11px] font-semibold">
          {UTILISATEUR.prenom[0]}
          {UTILISATEUR.nom[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {UTILISATEUR.prenom} {UTILISATEUR.nom}
          </p>
          <p className="truncate text-xs" style={{ color: INK_MUT }}>
            {UTILISATEUR.role}
          </p>
        </div>
        <ChevronsLeft
          className="size-3.5 rotate-180"
          style={{ color: INK_MUT }}
        />
      </div>
    </aside>
  )
}

function ActionIcon({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      className="flex size-8 items-center justify-center rounded-[3px] transition-colors hover:bg-[rgba(55,53,47,0.06)]"
    >
      {children}
    </button>
  )
}

function PageHeader({
  breadcrumb,
  title,
  subtitle,
  icon,
  action,
}: {
  breadcrumb: string[]
  title: string
  subtitle?: string
  icon: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1.5 text-sm"
          style={{ color: INK_SEC }}
        >
          {breadcrumb.map((part, i) => (
            <span key={part} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="size-3" style={{ color: INK_MUT }} />
              )}
              <span
                className={cn(
                  i === breadcrumb.length - 1 && "font-medium",
                  i === breadcrumb.length - 1 ? "text-[#37352F]" : ""
                )}
              >
                {part}
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ActionIcon title="Notifications">
            <Bell className="size-4" />
          </ActionIcon>
          <ActionIcon title="Plus d'options">
            <MoreHorizontal className="size-4" />
          </ActionIcon>
          {action}
        </div>
      </div>
      <div className="mt-8 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-[3px] bg-(--brand)/10">
          {icon}
        </div>
        <div>
          <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: INK_SEC }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function AList() {
  return (
    <main className="flex-1 overflow-y-auto px-12 py-8">
      <PageHeader
        breadcrumb={["Espace", "Demandes de déplacement", "Mes Demandes"]}
        title="Mes Demandes"
        subtitle={`${DEMANDES.length} demandes`}
        icon={<Plane className="size-6" style={{ color: "var(--brand)" }} />}
        action={
          <button className="flex h-8 items-center gap-1.5 rounded-[3px] bg-(--brand) px-3 text-sm font-medium text-white transition-colors hover:bg-(--brand-dark)">
            Nouvelle demande
          </button>
        }
      />
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {["Toutes", "En attente", "Finalisées"].map((tab, i) => (
            <button
              key={tab}
              className={cn(
                "h-8 rounded-[3px] px-3 text-sm transition-colors",
                i === 0
                  ? "bg-[#F1F1EF] font-medium"
                  : "hover:bg-[rgba(55,53,47,0.06)]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            style={{ color: INK_MUT }}
          />
          <input
            placeholder="Rechercher"
            className="h-8 w-60 rounded-[3px] border bg-white pr-3 pl-8 text-sm outline-none placeholder:text-[#9B9A97] focus:ring-1 focus:ring-(--brand)"
            style={{ borderColor: "rgba(55,53,47,0.15)" }}
          />
        </div>
      </div>
      <div
        className="mt-3 overflow-x-auto border-y text-sm"
        style={{ borderColor: HAIR }}
      >
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: HAIR }}>
              {["N°", "Employé", "Destination", "Dates", "Total", "Statut"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-2 py-2 font-normal"
                    style={{ color: "rgba(55,53,47,0.6)" }}
                  >
                    {h}
                  </th>
                )
              )}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {DEMANDES.map((d) => {
              const status = statusOf(d)
              return (
                <tr
                  key={d.numero}
                  className="group cursor-pointer transition-colors hover:bg-[rgba(55,53,47,0.024)]"
                >
                  <td className="px-2 py-2.5 font-medium">{d.numero}</td>
                  <td className="px-2 py-2.5">
                    {d.employe.prenom} {d.employe.nom}
                  </td>
                  <td className="px-2 py-2.5">{d.destination}</td>
                  <td className="px-2 py-2.5">
                    {formatDate(d.dateDepart)} → {formatDate(d.dateRetour)}
                  </td>
                  <td className="px-2 py-2.5">
                    {formatCurrency(d.totalEstime)}
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusPill label={status.label} tone={status.tone} />
                  </td>
                  <td className="px-2 py-2.5">
                    <ChevronRight
                      className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: INK_MUT }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function Field({
  label,
  type,
  placeholder,
  span2,
}: {
  label: string
  type: "text" | "date" | "select" | "number"
  placeholder?: string
  span2?: boolean
}) {
  const common = `h-9 w-full rounded-[3px] border bg-white px-3 text-sm text-[#37352F] outline-none transition-shadow placeholder:text-[#9B9A97] focus:ring-1 focus:ring-(--brand)`
  return (
    <div className={cn(span2 && "col-span-2")}>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {type === "select" ? (
        <select
          className={cn(common, "appearance-none")}
          style={{ borderColor: INPUT_BORDER }}
        >
          <option value="">{placeholder}</option>
        </select>
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          className={cn(common, type === "date" && "appearance-none")}
          style={{ borderColor: INPUT_BORDER }}
        />
      )}
    </div>
  )
}

function AForm() {
  return (
    <main className="flex-1 overflow-y-auto px-12 py-8">
      <PageHeader
        breadcrumb={["Espace", "Demandes de déplacement", "Nouvelle Demande"]}
        title="Nouvelle Demande"
        subtitle="Renseignez les informations du déplacement. Certains champs peuvent être pré-remplis automatiquement."
        icon={<MapPin className="size-6" style={{ color: "var(--brand)" }} />}
        action={
          <button className="flex h-8 items-center gap-1.5 rounded-[3px] bg-(--brand) px-3 text-sm font-medium text-white transition-colors hover:bg-(--brand-dark)">
            Enregistrer
          </button>
        }
      />
      <div className="mt-10 max-w-[720px]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Déplacement</h2>
          <span className="h-px flex-1" style={{ backgroundColor: HAIR }} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Field
            label="Destination"
            type="select"
            placeholder="Choisir une ville"
          />
          <Field label="Motif" type="select" placeholder="Choisir un motif" />
          <Field
            label="Type de transport"
            type="select"
            placeholder="Choisir un moyen"
          />
          <Field label="Date de départ" type="date" />
          <Field label="Date de retour" type="date" />
        </div>

        <div className="mt-10 flex items-center gap-3">
          <h2 className="text-sm font-semibold">Estimation des frais</h2>
          <span className="h-px flex-1" style={{ backgroundColor: HAIR }} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Field label="Transport (Dhs)" type="number" placeholder="0,00" />
          <Field label="Hébergement (Dhs)" type="number" placeholder="0,00" />
          <Field label="Repas (Dhs)" type="number" placeholder="0,00" />
          <Field label="Divers (Dhs)" type="number" placeholder="0,00" />
        </div>

        <div className="mt-10 flex items-center gap-3">
          <h2 className="text-sm font-semibold">Avance</h2>
          <span className="h-px flex-1" style={{ backgroundColor: HAIR }} />
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-(--brand)" />
          Je souhaite demander une avance
        </label>
        <div className="mt-4">
          <Field
            label="Montant de l'avance (Dhs)"
            type="number"
            placeholder="0,00"
          />
        </div>

        <div className="mt-10 flex items-center gap-2">
          <button className="h-9 rounded-[3px] px-4 text-sm transition-colors hover:bg-[rgba(55,53,47,0.06)]">
            Annuler
          </button>
          <button className="h-9 rounded-[3px] bg-(--brand) px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgba(15,15,15,0.1)] transition-colors hover:bg-(--brand-dark)">
            Enregistrer la demande
          </button>
        </div>
      </div>
    </main>
  )
}

export function VariantA({
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
        <ALogin />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ASidebar activeNav={activeNav} />
          {surface === "liste" ? <AList /> : <AForm />}
        </div>
      )}
    </div>
  )
}
