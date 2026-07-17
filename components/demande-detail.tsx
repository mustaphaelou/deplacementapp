"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { formatCurrency, formatDate, formatDateTime, TRANSPORT_LABELS, STATUT_LABELS, PURPOSE_OPTIONS } from "@/lib/constants"
import { parseMotif } from "@/lib/demande-types"
import type { DemandeDetail } from "@/lib/demande-types"
import { CheckCircle, XCircle, ArrowLeft, Download, Printer, Ban, ChevronRight, ChevronLeft, Loader2, Save } from "lucide-react"
import Link from "next/link"
import { useDemandeActions } from "@/hooks/use-demande-actions"

interface DemandeDetailProps {
  demande: DemandeDetail
  canApprove: boolean
  canReject: boolean
  canWithdraw: boolean
  isOwner: boolean
  userRole: string
}

const stepOrder = ["BROUILLON", "SOUMISE", "APPROUVEE_MANAGER", "APPROUVEE_FINANCE", "APPROUVEE"]
const rejectStatuses = ["REJETEE_MANAGER", "REJETEE_FINANCE", "REJETEE_DIRECTION"]

export function DemandeDetail({ demande, canApprove, canReject, canWithdraw, isOwner, userRole }: DemandeDetailProps) {
  const {
    commentaire,
    setCommentaire,
    actionLoading,
    showRejectForm,
    setShowRejectForm,
    handleAction,
    handleDownloadPdf,
  } = useDemandeActions(demande.id, demande.numero)

  const motifs = parseMotif(demande.motif)

  const currentStepIndex = stepOrder.indexOf(demande.statut)
  const isRejected = rejectStatuses.includes(demande.statut)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/demandes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Demande {demande.numero}</h1>
            <p className="text-sm text-muted-foreground">
              Créée le {formatDateTime(demande.creeLe)} par {demande.employePrenom} {demande.employeNom}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="mr-2 size-4" />
            PDF
          </Button>
          <Link href={`/demandes/${demande.id}/imprimer`}>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 size-4" />
              Imprimer
            </Button>
          </Link>
        </div>
      </div>

      {/* Workflow timeline */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-1">
            {stepOrder.map((step, i) => {
              const isDone = i <= currentStepIndex
              const isCurrent = i === currentStepIndex
              return (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                    isDone ? (isCurrent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary") : "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentStepIndex ? <CheckCircle className="size-3" /> : null}
                    {STATUT_LABELS[step]}
                  </div>
                  {i < stepOrder.length - 1 && (
                    <ChevronRight className={`mx-1 size-4 ${i < currentStepIndex ? "text-primary" : "text-muted-foreground/30"}`} />
                  )}
                </div>
              )
            })}
          </div>
          {isRejected && (
            <div className="mt-3">
              <Badge variant="destructive">{STATUT_LABELS[demande.statut]}</Badge>
            </div>
          )}
          {demande.statut === "RETIREE" && (
            <div className="mt-3">
              <Badge variant="outline">{STATUT_LABELS["RETIREE"]}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info employé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations employé</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nom complet</p>
            <p className="text-sm font-medium">{demande.employePrenom} {demande.employeNom}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Poste</p>
            <p className="text-sm font-medium">{demande.employePoste}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Département</p>
            <p className="text-sm font-medium">{demande.employeDepartement}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{demande.employe.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Détails du déplacement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails du déplacement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Motif(s)</p>
            <p className="text-sm font-medium">{motifs.join(", ")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Transport</p>
            <p className="text-sm font-medium">{TRANSPORT_LABELS[demande.typeTransport]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date de départ</p>
            <p className="text-sm font-medium">{formatDate(demande.dateDepart)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date de retour</p>
            <p className="text-sm font-medium">{formatDate(demande.dateRetour)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Destination</p>
            <p className="text-sm font-medium">{demande.destination}</p>
          </div>
          {demande.vehicule && (
            <div>
              <p className="text-xs text-muted-foreground">Véhicule</p>
              <p className="text-sm font-medium">{demande.vehicule.nom} ({demande.vehicule.immatriculation})</p>
            </div>
          )}
          {demande.autreTransport && (
            <div>
              <p className="text-xs text-muted-foreground">Autre transport</p>
              <p className="text-sm font-medium">{demande.autreTransport}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Frais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frais estimés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transport</span>
              <span>{formatCurrency(Number(demande.fraisTransport ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hébergement</span>
              <span>{formatCurrency(Number(demande.fraisHebergement ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Repas</span>
              <span>{formatCurrency(Number(demande.fraisRepas ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Divers</span>
              <span>{formatCurrency(Number(demande.fraisDivers ?? 0))}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Total estimé</span>
              <span>{formatCurrency(Number(demande.totalEstime ?? 0))}</span>
            </div>
          </div>
          {demande.avanceRequise && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Avance demandée</p>
              <p className="text-sm font-medium">{formatCurrency(Number(demande.montantAvance ?? 0))}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {demande.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{demande.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Comments timeline */}
      {(demande.commentaireManager || demande.commentaireFinance || demande.commentaireDirection) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demande.commentaireManager && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Manager</p>
                <p className="text-sm">{demande.commentaireManager}</p>
              </div>
            )}
            {demande.commentaireFinance && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Finance</p>
                <p className="text-sm">{demande.commentaireFinance}</p>
              </div>
            )}
            {demande.commentaireDirection && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Direction</p>
                <p className="text-sm">{demande.commentaireDirection}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {(canApprove || canReject || canWithdraw) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRejectForm && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Commentaire de rejet (obligatoire) :</p>
                <Textarea
                  placeholder="Expliquez la raison du rejet..."
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-3">
              {canApprove && (
                <Button onClick={() => handleAction("approuver")} disabled={actionLoading !== null}>
                  {actionLoading === "approuver" && <Loader2 className="mr-2 size-4 animate-spin" />}
                  <CheckCircle className="mr-2 size-4" />
                  Approuver
                </Button>
              )}
              {canReject && !showRejectForm && (
                <Button variant="destructive" onClick={() => setShowRejectForm(true)}>
                  <XCircle className="mr-2 size-4" />
                  Rejeter
                </Button>
              )}
              {canReject && showRejectForm && (
                <>
                  <Button variant="destructive" onClick={() => handleAction("rejeter")} disabled={actionLoading !== null || !commentaire.trim()}>
                    {actionLoading === "rejeter" && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Confirmer le rejet
                  </Button>
                  <Button variant="outline" onClick={() => { setShowRejectForm(false); setCommentaire("") }}>
                    Annuler
                  </Button>
                </>
              )}
              {canWithdraw && (
                <Button variant="outline" onClick={() => handleAction("retirer")} disabled={actionLoading !== null}>
                  <Ban className="mr-2 size-4" />
                  Retirer la demande
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chronologie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {demande.soumiseLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Soumise</span>
              <span>{formatDateTime(demande.soumiseLe)}</span>
            </div>
          )}
          {demande.approuveeManagerLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Approuvée par le manager</span>
              <span>{formatDateTime(demande.approuveeManagerLe)}</span>
            </div>
          )}
          {demande.approuveeFinanceLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Approuvée par la finance</span>
              <span>{formatDateTime(demande.approuveeFinanceLe)}</span>
            </div>
          )}
          {demande.approuveeDirectionLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Approuvée par la direction</span>
              <span>{formatDateTime(demande.approuveeDirectionLe)}</span>
            </div>
          )}
          {demande.rejeteeLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rejetée</span>
              <span>{formatDateTime(demande.rejeteeLe)}</span>
            </div>
          )}
          {demande.retireeLe && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Retirée</span>
              <span>{formatDateTime(demande.retireeLe)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
