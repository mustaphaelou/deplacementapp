import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getDashboardData } from "@/lib/dashboard"
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { FinanceDashboard } from "@/components/dashboard/finance-dashboard"
import { DirectionDashboard } from "@/components/dashboard/direction-dashboard"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role
  const userId = session.user.id

  const data = await getDashboardData(userId, role)

  switch (role) {
    case "EMPLOYEE":
      return <EmployeeDashboard data={data} />
    case "MANAGER":
      return <ManagerDashboard data={data} />
    case "FINANCE_ADMIN":
      return <FinanceDashboard data={data} />
    case "GENERAL_DIRECTION":
      return <DirectionDashboard data={data} />
    default:
      redirect("/login")
  }
}
