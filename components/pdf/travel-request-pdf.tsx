import ReactPDF from "@react-pdf/renderer"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { PdfRenderData } from "@/lib/pdf-types"

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
  table: {
    marginTop: 8,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 4,
  },
  tableHeader: {
    backgroundColor: "#f3f4f6",
    fontWeight: "bold",
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
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
  BROUILLON: "BROUILLON",
  SOUMISE: "SOUMISE",
  APPROUVEE_MANAGER: "APPROUVEE MANAGER",
  APPROUVEE_FINANCE: "APPROUVEE FINANCE",
  APPROUVEE: "APPROUVEE",
  REJETEE_MANAGER: "REJETEE MANAGER",
  REJETEE_FINANCE: "REJETEE FINANCE",
  REJETEE_DIRECTION: "REJETEE DIRECTION",
  RETIREE: "RETIREE",
}

const TRANSPORT_LABELS: Record<string, string> = {
  VOITURE_PERSONNELLE: "Voiture personnelle",
  VOITURE_SOCIETE: "Véhicule de société",
  BUS: "Bus",
  AVION: "Avion",
  TRAIN: "Train",
  AUTRE: "Autre",
}

function formatDate(date: Date): string {
  return format(new Date(date), "PPP", { locale: fr })
}

function formatDateTime(date: Date): string {
  return format(new Date(date), "dd MMM yyyy 'a' HH:mm", { locale: fr })
}

function getStatusColor(status: string): string {
  if (status.startsWith("APPROUVEE")) return "#16a34a"
  if (status.startsWith("REJETEE")) return "#dc2626"
  if (status === "SOUMISE") return "#d97706"
  return borders.medium
}

export function TravelRequestPdf({ data }: { data: PdfRenderData }) {
  const isDraft = data.statut === "BROUILLON"
  const statusLabel = STATUS_LABELS[data.statut] || data.statut
  const statusColor = getStatusColor(data.statut)
  const transportLabel = TRANSPORT_LABELS[data.typeTransport] || data.typeTransport

  return (
    <Document
      title={`Deplacement - ${data.destination}`}
      author="HAY 2010 SARL"
      subject={`Demande de deplacement: ${data.destination}`}
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
            <Text style={styles.metaValue}>{data.numero}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>STATUT</Text>
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
            <Text style={styles.metaValue}>{formatDateTime(data.creeLe)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DETAILS DU DEPLACEMENT</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <Text style={styles.fieldValue}>{data.destination}</Text>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Motif du deplacement</Text>
            <Text style={styles.fieldValue}>{data.motif.join(", ")}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date de depart</Text>
            <Text style={styles.fieldValue}>{formatDate(data.dateDepart)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date de retour</Text>
            <Text style={styles.fieldValue}>{formatDate(data.dateRetour)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mode de transport</Text>
            <Text style={styles.fieldValue}>{transportLabel}</Text>
          </View>

          {data.vehicule && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Vehicule</Text>
              <Text style={styles.fieldValue}>
                {data.vehicule.nom} ({data.vehicule.immatriculation})
              </Text>
            </View>
          )}

          {data.autreTransport && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Autre transport</Text>
              <Text style={styles.fieldValue}>{data.autreTransport}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>FRAIS ESTIMES</Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Type</Text>
            <Text style={styles.tableCell}>Montant</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Transport</Text>
            <Text style={styles.tableCell}>{data.couts.transport.toLocaleString("fr-FR")} EUR</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Hebergement</Text>
            <Text style={styles.tableCell}>{data.couts.hebergement.toLocaleString("fr-FR")} EUR</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Repas</Text>
            <Text style={styles.tableCell}>{data.couts.repas.toLocaleString("fr-FR")} EUR</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Divers</Text>
            <Text style={styles.tableCell}>{data.couts.divers.toLocaleString("fr-FR")} EUR</Text>
          </View>
          <View style={[styles.tableRow, { fontWeight: "bold" }]}>
            <Text style={styles.tableCell}>Total estime</Text>
            <Text style={styles.tableCell}>{data.couts.total.toLocaleString("fr-FR")} EUR</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>INFORMATIONS DU DEMANDEUR</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom complet</Text>
            <Text style={styles.fieldValue}>{data.employePrenom} {data.employeNom}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Poste</Text>
            <Text style={styles.fieldValue}>{data.employePoste}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Departement</Text>
            <Text style={styles.fieldValue}>{data.employeDepartement}</Text>
          </View>
          {data.assigneA && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Traite par</Text>
              <Text style={styles.fieldValue}>{data.assigneA.prenom} {data.assigneA.nom}</Text>
            </View>
          )}
        </View>

        {data.avanceRequise && (
          <>
            <Text style={styles.sectionTitle}>AVANCE</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Montant avance</Text>
              <Text style={styles.fieldValue}>
                {(data.montantAvance ?? 0).toLocaleString("fr-FR")} EUR
              </Text>
            </View>
          </>
        )}

        {data.description && (
          <>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <Text style={styles.fieldValue}>{data.description}</Text>
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
