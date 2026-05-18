"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ViewIcon,
  Delete02Icon,
  UserLock01Icon,
  UserUnlock01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { resetUserPassword, deleteUser, toggleUserActive } from "@/app/actions/users"

interface UserRowActionsProps {
  userId: string
  userName: string
  isActive: boolean
  requestCount: number
}

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  async function handleReset() {
    setIsLoading(true)
    try {
      const result = await resetUserPassword(userId)

      if (result?.error) {
        toast.error(result.error)
      } else if (result?.success) {
        setNewPassword(result.tempPassword)
        toast.success("Mot de passe reinitialise")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la reinitialisation")
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setNewPassword(null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Reinitialiser le mot de passe">
            <HugeiconsIcon icon={ViewIcon} className="size-4" />
          </Button>
        }
      />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Un nouveau mot de passe temporaire sera genere pour {userName}.
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">Nouveau mot de passe</p>
              <p className="mt-2 font-mono text-xl font-bold tracking-widest">
                {newPassword}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Communiquez ce mot de passe a l&apos;utilisateur.
            </p>
            <DialogFooter>
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Etes-vous sur de vouloir reinitialiser le mot de passe de cet
              utilisateur ? L&apos;ancien mot de passe ne sera plus valide.
            </p>
            <DialogFooter showCloseButton>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={isLoading}
              >
                {isLoading ? "Reinitialisation..." : "Reinitialiser"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleToggle() {
    setIsLoading(true)
    try {
      await toggleUserActive(userId)
      toast.success(
        isActive ? "Utilisateur desactive" : "Utilisateur reactive"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'operation")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={isActive ? "Desactiver" : "Activer"}
      onClick={handleToggle}
      disabled={isLoading}
    >
      <HugeiconsIcon
        icon={isActive ? UserLock01Icon : UserUnlock01Icon}
        className="size-4"
      />
    </Button>
  )
}

export function DeleteUserButton({ userId, userName, requestCount }: UserRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const canDelete = requestCount === 0

  async function handleDelete() {
    setIsLoading(true)
    try {
      await deleteUser(userId)
      toast.success("Utilisateur supprime")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title={canDelete ? "Supprimer" : "Suppression impossible (demandes existantes)"}
            disabled={!canDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </Button>
        }
      />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
          <DialogDescription>
            Etes-vous sur de vouloir supprimer definitivement {userName} ?
            Cette action est irreversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
