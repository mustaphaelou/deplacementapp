import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { getDashboardPayload } from "@/lib/dashboard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NAV_ITEMS, type Role } from "@/lib/auth"

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  const role = user.role as Role
  const userId = user.id

  const navItems = [
    ...NAV_ITEMS.common,
    ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? []),
  ]

  let config: Awaited<ReturnType<typeof getDashboardPayload>>["config"]
  let demandes: Awaited<ReturnType<typeof getDashboardPayload>>["demandes"]
  try {
    const payload = await getDashboardPayload(userId, role)
    config = payload.config
    demandes = payload.demandes
  } catch (error) {
    console.error("Failed to load dashboard payload:", error)
    redirect("/login")
    return
  }

  return (
    <DashboardLayout config={config} navItems={navItems} demandes={demandes} />
  )
}
