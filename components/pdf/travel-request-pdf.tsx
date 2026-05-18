import ReactPDF from "@react-pdf/renderer"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const { Document, Page, Text, View, StyleSheet } = ReactPDF

const borders = {
  black: "#000000",
  light: "#cccccc",
  medium: "#666666",
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: borders.black,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: borders.black,
    borderBottomStyle: "solid",
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 13,
    color: "#333333",
    fontWeight: "bold",
  },
  metaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: borders.light,
    borderBottomStyle: "solid",
  },
  metaLabel: {
    fontSize: 8,
    color: borders.medium,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: borders.light,
    borderBottomStyle: "solid",
    paddingBottom: 4,
    color: "#222222",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  field: {
    width: "50%",
    marginBottom: 10,
    paddingRight: 12,
  },
  fieldFull: {
    width: "100%",
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 8,
    color: borders.medium,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: 10,
  },
  approvalRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    borderBottomStyle: "solid",
  },
  approvalIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    marginTop: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  approvalIconApproved: {
    color: "#16a34a",
    fontWeight: "bold",
  },
  approvalIconRejected: {
    color: "#dc2626",
    fontWeight: "bold",
  },
  approvalContent: {
    flex: 1,
  },
  approvalDecision: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 1,
  },
  approvalMeta: {
    fontSize: 8,
    color: borders.medium,
    marginBottom: 2,
  },
  approvalComment: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#444444",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: borders.medium,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: borders.light,
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  noData: {
    fontSize: 9,
    color: borders.medium,
    fontStyle: "italic",
  },
})

const watermarkStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    transform: "rotate(-30deg)",
  },
  text: {
    fontSize: 72,
    color: "#000000",
    opacity: 0.06,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
})

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "BROUILLON",
  PENDING: "EN ATTENTE",
  APPROVED: "APPROUVEE",
  REJECTED: "REJETEE",
  ARCHIVED: "ARCHIVEE",
}

const DECISION_LABELS: Record<string, string> = {
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
}

interface ApprovalWithApprover {
  id: string
  decision: string
  comment: string | null
  createdAt: Date
  approver: { id: string; name: string }
}

interface RequestData {
  id: string
  destination: string
  purpose: string
  departureDate: Date
  returnDate: Date
  transportMode: string
  accommodation: string | null
  estimatedBudget: unknown
  status: string
  createdAt: Date
  requester: { id: string; name: string; email: string }
  manager: { id: string; name: string } | null
  approvals: ApprovalWithApprover[]
}

function formatDate(date: Date): string {
  return format(new Date(date), "PPP", { locale: fr })
}

function formatDateTime(date: Date): string {
  return format(new Date(date), "dd MMM yyyy 'a' HH:mm", { locale: fr })
}

function getStatusColor(status: string): string {
  switch (status) {
    case "APPROVED":
      return "#16a34a"
    case "REJECTED":
      return "#dc2626"
    case "PENDING":
      return "#d97706"
    default:
      return borders.medium
  }
}

export function TravelRequestPdf({ request }: { request: RequestData }) {
  const isDraft = request.status === "DRAFT"
  const isRejected = request.status === "REJECTED"
  const statusLabel = STATUS_LABELS[request.status] || request.status
  const statusColor = getStatusColor(request.status)

  return (
    <Document
      title={`Deplacement - ${request.destination}`}
      author="HAY 2010 SARL"
      subject={`Demande de deplacement: ${request.destination}`}
      creator="HAY 2010 SARL - Systeme de Gestion des Deplacements"
    >
      <Page size="A4" style={styles.page}>
        {isDraft && (
          <View style={watermarkStyles.wrapper} fixed>
            <Text style={watermarkStyles.text}>BROUILLON</Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.companyName}>HAY 2010 SARL</Text>
          <Text style={styles.docTitle}>FORMULAIRE DE DEPLACEMENT</Text>
        </View>

        <View style={styles.metaBar}>
          <View>
            <Text style={styles.metaLabel}>REFERENCE</Text>
            <Text style={styles.metaValue}>{request.id}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>STATUT</Text>
            {/* Using inline style for dynamic color since StyleSheet.create doesn't support dynamic values well */}
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 3,
                backgroundColor: statusColor,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "bold" }}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.metaLabel}>DATE DE CREATION</Text>
            <Text style={styles.metaValue}>{formatDateTime(request.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DETAILS DU DEPLACEMENT</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <Text style={styles.fieldValue}>{request.destination}</Text>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Motif du deplacement</Text>
            <Text style={styles.fieldValue}>{request.purpose}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date de depart</Text>
            <Text style={styles.fieldValue}>{formatDate(request.departureDate)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date de retour</Text>
            <Text style={styles.fieldValue}>{formatDate(request.returnDate)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mode de transport</Text>
            <Text style={styles.fieldValue}>{request.transportMode}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Hebergement</Text>
            <Text style={styles.fieldValue}>{request.accommodation || "\u2014"}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Budget estime</Text>
            <Text style={styles.fieldValue}>
              {request.estimatedBudget
                ? `${Number(request.estimatedBudget).toLocaleString("fr-FR")} EUR`
                : "\u2014"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>INFORMATIONS DU DEMANDEUR</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom</Text>
            <Text style={styles.fieldValue}>{request.requester.name}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{request.requester.email}</Text>
          </View>
          {request.manager && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Traite par</Text>
              <Text style={styles.fieldValue}>{request.manager.name}</Text>
            </View>
          )}
        </View>

        {request.approvals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>HISTORIQUE DES DECISIONS</Text>
            {request.approvals.map((approval) => (
              <View key={approval.id} style={styles.approvalRow}>
                <View style={styles.approvalIcon}>
                  <Text
                    style={
                      approval.decision === "APPROVED"
                        ? styles.approvalIconApproved
                        : styles.approvalIconRejected
                    }
                  >
                    {approval.decision === "APPROVED" ? "\u2714" : "\u2718"}
                  </Text>
                </View>
                <View style={styles.approvalContent}>
                  <Text style={styles.approvalDecision}>
                    {DECISION_LABELS[approval.decision]} par {approval.approver.name}
                  </Text>
                  <Text style={styles.approvalMeta}>
                    {formatDateTime(approval.createdAt)}
                  </Text>
                  {approval.comment && (
                    <Text style={styles.approvalComment}>{approval.comment}</Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {request.approvals.length === 0 && !isDraft && (
          <>
            {isRejected ? (
              <>
                <Text style={styles.sectionTitle}>DECISION</Text>
                <Text style={styles.noData}>Cette demande a ete rejetee sans commentaire.</Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>DECISION</Text>
                <Text style={styles.noData}>Aucune decision n{"\u2019"}a encore ete prise sur cette demande.</Text>
              </>
            )}
          </>
        )}

        {isDraft && (
          <>
            <Text style={styles.sectionTitle}>ATTENTION</Text>
            <Text style={styles.noData}>
              Ce document est un BROUILLON. Il n{"\u2019"}a pas encore ete soumis pour validation.
            </Text>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>
            HAY 2010 SARL - Formulaire de Deplacement - Genere le{" "}
            {formatDateTime(new Date())} - Document non contractuel
          </Text>
        </View>
      </Page>
    </Document>
  )
}
