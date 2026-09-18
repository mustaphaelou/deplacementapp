import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { BrandProvider } from "@/components/brand-provider"
import RotationGate from "@/components/rotation-gate"
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

  // #238 — forced rotation: while the holder still authenticates with an
  // administrator-issued temporary credential, the app shell (and every page
  // under it, including /profil) stays out of reach until they choose their
  // own password.  The gate reuses the self-service change endpoint, which
  // clears the flag and ends with a reconnect.
  if (user.doitChangerMotDePasse) {
    return <RotationGate email={user.email} />
  }

  const role = user.role
  const navItems = [
    ...NAV_ITEMS.common,
    ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? []),
  ]

  const societe = await getSocieteBranding()

  return (
    <BrandProvider>
      <DashboardShell
        navItems={navItems}
        societeNom={societe?.nom ?? DEFAULT_SOCIETE_NOM}
        societeLogoUrl={societe?.logoUrl ?? null}
      >
        {children}
      </DashboardShell>
    </BrandProvider>
  )
}
