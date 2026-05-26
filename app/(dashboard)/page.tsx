import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getDashboardPayload } from "@/lib/dashboard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NAV_ITEMS } from "@/lib/roles"
import type { Role } from "@prisma/client"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role as Role
  const userId = session.user.id

  const navItems = [...NAV_ITEMS.common, ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? [])]

  try {
    const { config, demandes } = await getDashboardPayload(userId, role)
    return <DashboardLayout config={config} navItems={navItems} demandes={demandes} />
  } catch (error) {
    console.error("Failed to load dashboard payload:", error)
    redirect("/login")
  }
}
