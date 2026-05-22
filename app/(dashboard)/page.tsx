import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  getEmployeeDashboard,
  getManagerDashboard,
  getFinanceDashboard,
  getDirectionDashboard,
} from "@/lib/dashboard"
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { FinanceDashboard } from "@/components/dashboard/finance-dashboard"
import { DirectionDashboard } from "@/components/dashboard/direction-dashboard"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role
  const userId = session.user.id

  switch (role) {
    case "EMPLOYEE": {
      const data = await getEmployeeDashboard(userId)
      return <EmployeeDashboard data={data} />
    }
    case "MANAGER": {
      const data = await getManagerDashboard()
      return <ManagerDashboard data={data} />
    }
    case "FINANCE_ADMIN": {
      const data = await getFinanceDashboard()
      return <FinanceDashboard data={data} />
    }
    case "GENERAL_DIRECTION": {
      const data = await getDirectionDashboard()
      return <DirectionDashboard data={data} />
    }
    default:
      redirect("/login")
  }
}