import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-7xl font-bold tracking-tighter text-muted-foreground/30">
        404
      </h1>
      <p className="text-lg font-medium">Page introuvable</p>
      <p className="text-sm text-muted-foreground">
        La page que vous recherchez n&apos;existe pas ou a ete deplacee.
      </p>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>
        Retour au tableau de bord
      </Button>
    </div>
  )
}
