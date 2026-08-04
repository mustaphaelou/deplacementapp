import Link from "next/link"
import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export default async function ForbiddenPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
        403
      </h1>
      <p className="text-lg font-medium">Accès refusé</p>
      <p className="text-sm text-muted-foreground">
        Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
      </p>
      <Button
        render={<Link href="/dashboard" />}
        className="h-9 rounded-[3px] shadow-[0_1px_2px_rgba(15,15,15,0.1)] [a]:hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]"
      >
        Retour au tableau de bord
      </Button>
    </div>
  )
}
