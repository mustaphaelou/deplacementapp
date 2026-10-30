"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/page-header"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { formatCurrency, formatDate, formatDateTime } from "@/lib/constants"
import {
  toDemandePresentation,
  toDemandeDocumentView,
  TRANSPORT_LABELS,
} from "@/lib/demande-presentation"
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

  // The Motifs are read from the document projection, not from the storage
  // decoder: the stored values are slugs, and only the projection knows the
  // French label each one carries. A « Autre » entry, absent from the label
  // map, still comes out verbatim through the projection's fallback.
  const { motifs } = toDemandeDocumentView(demande)

  const presentation = toDemandePresentation(demande)
  const isRejected = presentation.decision.outcome === "rejected"
  const isWithdrawn = presentation.decision.outcome === "withdrawn"

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8">
      <PageHeader
        crumbs={[
          { label: "Demandes de déplacement", href: "/demandes" },
          `N° ${demande.numero}`,
        ]}
        title={`Demande ${demande.numero}`}
        subtitle={
          <>
            Créée le {formatDateTime(demande.creeLe)} par{" "}
            {demande.employePrenom} {demande.employeNom}
          </>
        }
        icon={FileText}
        action={
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
        }
      />

      <div className="mt-10 space-y-10">
        {/* Statut */}
        <section>
          <SectionHeading>Statut</SectionHeading>
          <div className="mt-5 flex flex-wrap items-center gap-1">
            {presentation.steps.map((step, i) => {
              const isPast = step.state === "past"
              const isCurrent = step.state === "current"
              const isLast = i === presentation.steps.length - 1
              // The connector is brand-tinted once the stage it leads to
              // has been reached (past or current).
              const nextReached =
                !isLast &&
                (presentation.steps[i + 1].state === "past" ||
                  presentation.steps[i + 1].state === "current")
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      isPast
                        ? "bg-primary/10 text-primary"
                        : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? <CheckCircle className="size-3" /> : null}
                    {step.label}
                  </div>
                  {!isLast && (
                    <ChevronRight
                      className={`mx-1 size-4 ${nextReached ? "text-primary" : "text-muted-foreground/30"}`}
                    />
                  )}
                </div>
              )
            })}
            {isRejected && (
              <Badge variant="destructive" className="ml-2">
                {presentation.decision.label}
              </Badge>
            )}
            {isWithdrawn && (
              <Badge variant="outline" className="ml-2">
                {presentation.decision.label}
              </Badge>
            )}
          </div>
          {/* Etape and Decision are distinct concepts (CONTEXT.md): where the
              demande is in the pipeline vs what was decided there. They are
              shown as separate values, never collapsed into one status. */}
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Étape</span>
            <span className="text-right font-medium">
              {presentation.etape.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Décision</span>
            <span className="text-right font-medium">
              {presentation.decision.label}
            </span>
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
