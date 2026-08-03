import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { NAV_ITEMS } from "@/lib/auth"
import { getSocieteBranding } from "@/lib/societe"
import { DEFAULT_SOCIETE_NOM } from "@/lib/constants"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const role = user.role
  const navItems = [
    ...NAV_ITEMS.common,
    ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? []),
  ]

  const societe = await getSocieteBranding()

  return (
    <DashboardShell
      navItems={navItems}
      societeNom={societe?.nom ?? DEFAULT_SOCIETE_NOM}
      societeLogoUrl={societe?.logoUrl ?? null}
    >
      {children}
    </DashboardShell>
  )
}
