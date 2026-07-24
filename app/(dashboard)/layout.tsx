import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { NAV_ITEMS } from "@/lib/roles"
import { getSocieteBranding } from "@/lib/societe"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role
  const navItems = [
    ...NAV_ITEMS.common,
    ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? []),
  ]

  const societe = await getSocieteBranding()

  return (
    <DashboardShell
      navItems={navItems}
      societeNom={societe?.nom ?? "Application"}
      societeLogoUrl={societe?.logoUrl ?? null}
    >
      {children}
    </DashboardShell>
  )
}
