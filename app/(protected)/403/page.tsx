import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export default async function ForbiddenPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-7xl font-bold tracking-tighter text-muted-foreground/30">
        403
      </h1>
      <p className="text-lg font-medium">Acces refuse</p>
      <p className="text-sm text-muted-foreground">
        Vous n&apos;avez pas les droits necessaires pour acceder a cette page.
      </p>
      <Button render={<Link href="/dashboard" />}>
        Retour au tableau de bord
      </Button>
    </div>
  )
}
