"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  TRANSPORT_LABELS,
  ETAPE_LABELS,
  DECISION_LABELS,
} from "@/lib/constants"
import { parseMotif } from "@/lib/demande-types"
import type { DemandeDetail } from "@/lib/demande-types"
import {
  CheckCircle,
  XCircle,
  Download,
  Printer,
  Ban,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react"
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

const stepOrder = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Property({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{children}</p>
    </div>
  )
}

export function DemandeDetail({
  demande,
  canApprove,
  canReject,
  canWithdraw,
}: DemandeDetailProps) {
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

  const currentStepIndex = stepOrder.indexOf(demande.etape)
  const isRejected = demande.decision === "REJECTED"
  const isWithdrawn = demande.decision === "WITHDRAWN"

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8">
      {/* Page header */}
      <div>
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  href="/demandes"
                  className="transition-colors hover:text-foreground"
                >
                  Demandes de déplacement
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  N° {demande.numero}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadPdf}
                    aria-label="Télécharger le PDF"
                  >
                    <Download className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Télécharger le PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link href={`/demandes/${demande.id}/imprimer`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Imprimer"
                    >
                      <Printer className="size-4" />
                    </Button>
                  </Link>
                }
              />
              <TooltipContent>Imprimer</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              Demande {demande.numero}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Créée le {formatDateTime(demande.creeLe)} par{" "}
              {demande.employePrenom} {demande.employeNom}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
        {/* Statut */}
        <section>
          <SectionHeading>Statut</SectionHeading>
          <div className="mt-5 flex flex-wrap items-center gap-1">
            {stepOrder.map((step, i) => {
              const isDone = i <= currentStepIndex
              const isCurrent = i === currentStepIndex
              return (
                <div key={step} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      isDone
                        ? isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStepIndex ? (
                      <CheckCircle className="size-3" />
                    ) : null}
                    {ETAPE_LABELS[step]}
                  </div>
                  {i < stepOrder.length - 1 && (
                    <ChevronRight
                      className={`mx-1 size-4 ${i < currentStepIndex ? "text-primary" : "text-muted-foreground/30"}`}
                    />
                  )}
                </div>
              )
            })}
            {isRejected && (
              <Badge variant="destructive" className="ml-2">
                {DECISION_LABELS["REJECTED"]}
              </Badge>
            )}
            {isWithdrawn && (
              <Badge variant="outline" className="ml-2">
                {DECISION_LABELS["WITHDRAWN"]}
              </Badge>
            )}
          </div>
        </section>

        {/* Informations employé */}
        <section>
          <SectionHeading>Informations employé</SectionHeading>
          <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Property label="Nom complet">
              {demande.employePrenom} {demande.employeNom}
            </Property>
            <Property label="Poste">{demande.employePoste}</Property>
            <Property label="Département">
              {demande.employeDepartement}
            </Property>
            <Property label="Email">{demande.employe.email}</Property>
          </div>
        </section>

        {/* Détails du déplacement */}
        <section>
          <SectionHeading>Détails du déplacement</SectionHeading>
          <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Property label="Motif(s)">{motifs.join(", ")}</Property>
            <Property label="Transport">
              {TRANSPORT_LABELS[demande.typeTransport]}
            </Property>
            <Property label="Date de départ">
              {formatDate(demande.dateDepart)}
            </Property>
            <Property label="Date de retour">
              {formatDate(demande.dateRetour)}
            </Property>
            <Property label="Destination">{demande.destination}</Property>
            {demande.vehicule && (
              <Property label="Véhicule">
                {demande.vehicule.nom} ({demande.vehicule.immatriculation})
              </Property>
            )}
            {demande.autreTransport && (
              <Property label="Autre transport">{demande.autreTransport}</Property>
            )}
          </div>
        </section>

        {/* Frais estimés */}
        <section>
          <SectionHeading>Frais estimés</SectionHeading>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transport</span>
              <span>{formatCurrency(Number(demande.fraisTransport ?? 0))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hébergement</span>
              <span>
                {formatCurrency(Number(demande.fraisHebergement ?? 0))}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Repas</span>
              <span>{formatCurrency(Number(demande.fraisRepas ?? 0))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Divers</span>
              <span>{formatCurrency(Number(demande.fraisDivers ?? 0))}</span>
            </div>
            {demande.avanceRequise && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avance demandée</span>
                <span>{formatCurrency(Number(demande.montantAvance ?? 0))}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-bold">
              <span>Total estimé</span>
              <span>{formatCurrency(Number(demande.totalEstime ?? 0))}</span>
            </div>
          </div>
        </section>

        {/* Description */}
        {demande.description && (
          <section>
            <SectionHeading>Description</SectionHeading>
            <p className="mt-5 text-sm whitespace-pre-wrap">
              {demande.description}
            </p>
          </section>
        )}

        {/* Commentaires */}
        {(demande.commentaireManager ||
          demande.commentaireFinance ||
          demande.commentaireDirection) && (
          <section>
            <SectionHeading>Commentaires</SectionHeading>
            <div className="mt-2 divide-y divide-border">
              {demande.commentaireManager && (
                <div className="py-3">
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="mt-1 text-sm">{demande.commentaireManager}</p>
                </div>
              )}
              {demande.commentaireFinance && (
                <div className="py-3">
                  <p className="text-xs text-muted-foreground">Finance</p>
                  <p className="mt-1 text-sm">{demande.commentaireFinance}</p>
                </div>
              )}
              {demande.commentaireDirection && (
                <div className="py-3">
                  <p className="text-xs text-muted-foreground">Direction</p>
                  <p className="mt-1 text-sm">{demande.commentaireDirection}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        {(canApprove || canReject || canWithdraw) && (
          <section>
            <SectionHeading>Actions</SectionHeading>
            <div className="mt-5 space-y-4">
              {showRejectForm && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Commentaire de rejet (obligatoire) :
                  </p>
                  <Textarea
                    placeholder="Expliquez la raison du rejet..."
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {canApprove && (
                  <Button
                    onClick={() => handleAction("approuver")}
                    disabled={actionLoading !== null}
                    className="h-9 rounded-[3px]"
                  >
                    {actionLoading === "approuver" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    <CheckCircle className="size-4" />
                    Approuver
                  </Button>
                )}
                {canReject && !showRejectForm && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <XCircle className="size-4" />
                    Rejeter
                  </Button>
                )}
                {canReject && showRejectForm && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("rejeter")}
                      disabled={actionLoading !== null || !commentaire.trim()}
                    >
                      {actionLoading === "rejeter" && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Confirmer le rejet
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectForm(false)
                        setCommentaire("")
                      }}
                    >
                      Annuler
                    </Button>
                  </>
                )}
                {canWithdraw && (
                  <Button
                    variant="outline"
                    onClick={() => handleAction("retirer")}
                    disabled={actionLoading !== null}
                  >
                    <Ban className="size-4" />
                    Retirer la demande
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Chronologie */}
        <section>
          <SectionHeading>Chronologie</SectionHeading>
          <div className="mt-5 space-y-3">
            {demande.soumiseLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Soumise</span>
                <span>{formatDateTime(demande.soumiseLe)}</span>
              </div>
            )}
            {demande.approuveeManagerLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Approuvée par le manager
                </span>
                <span>{formatDateTime(demande.approuveeManagerLe)}</span>
              </div>
            )}
            {demande.approuveeFinanceLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Approuvée par la finance
                </span>
                <span>{formatDateTime(demande.approuveeFinanceLe)}</span>
              </div>
            )}
            {demande.approuveeDirectionLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Approuvée par la direction
                </span>
                <span>{formatDateTime(demande.approuveeDirectionLe)}</span>
              </div>
            )}
            {demande.rejeteeLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rejetée</span>
                <span>{formatDateTime(demande.rejeteeLe)}</span>
              </div>
            )}
            {demande.retireeLe && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Retirée</span>
                <span>{formatDateTime(demande.retireeLe)}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
