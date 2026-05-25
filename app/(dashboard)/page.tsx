import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  getEmployeeDashboard,
  getManagerDashboard,
  getFinanceDashboard,
  getDirectionDashboard,
} from "@/lib/dashboard"
import { buildEmployeeConfig, buildManagerConfig, buildFinanceConfig, buildDirectionConfig } from "@/lib/dashboard-config"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NAV_ITEMS } from "@/lib/roles"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role
  const userId = session.user.id

  const navItems = [...NAV_ITEMS.common, ...(NAV_ITEMS[role as keyof typeof NAV_ITEMS] ?? [])]

  switch (role) {
    case "EMPLOYEE": {
      const data = await getEmployeeDashboard(userId)
      const config = buildEmployeeConfig(data.stats)
      return <DashboardLayout config={config} navItems={navItems} demandes={data.demandes} />
    }
    case "MANAGER": {
      const data = await getManagerDashboard()
      const config = buildManagerConfig(data.enAttente)
      return <DashboardLayout config={config} navItems={navItems} demandes={data.demandes} />
    }
    case "FINANCE_ADMIN": {
      const data = await getFinanceDashboard()
      const config = buildFinanceConfig(data.enAttente)
      return <DashboardLayout config={config} navItems={navItems} demandes={data.demandes} />
    }
    case "GENERAL_DIRECTION": {
      const data = await getDirectionDashboard()
      const config = buildDirectionConfig(data.enAttente, data.budgetTotal)
      return <DashboardLayout config={config} navItems={navItems} demandes={data.demandes} />
    }
    default:
      redirect("/login")
  }
}
