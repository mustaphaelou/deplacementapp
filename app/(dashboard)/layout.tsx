import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { NAV_ITEMS } from "@/lib/roles"

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={navItems} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
