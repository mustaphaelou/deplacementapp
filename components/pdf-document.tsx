import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { formatCurrency, formatDate, TRANSPORT_LABELS, STATUT_LABELS } from "@/lib/constants"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise } from "@prisma/client"

type DemandeWithRelations = DemandeDeplacement & {
  employe: Utilisateur
  vehicule: VehiculeEntreprise | null
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: "#1e40af", paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1e40af", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginTop: 16, marginBottom: 8, color: "#1e40af" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 160, color: "#666" },
  value: { flex: 1 },
  table: { marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  tableHeader: { backgroundColor: "#f3f4f6", fontWeight: "bold" },
  tableCell: { flex: 1, paddingHorizontal: 4 },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, textAlign: "center", color: "#999", fontSize: 8 },
})

function parseMotif(motif: string): string[] {
  try {
    return JSON.parse(motif)
  } catch {
    return [motif]
  }
}

export default function PdfDocument({ demande }: { demande: DemandeWithRelations }) {
  const motifs = parseMotif(demande.motif)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>HAY 2010 SARL</Text>
          <Text style={styles.subtitle}>Formulaire de Demande de Déplacement</Text>
          <Text style={styles.subtitle}>N° {demande.numero}</Text>
        </View>

        <Text style={styles.sectionTitle}>Statut</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Statut actuel :</Text>
          <Text style={styles.value}>{STATUT_LABELS[demande.statut]}</Text>
        </View>

        <Text style={styles.sectionTitle}>Informations Employé</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom complet :</Text>
          <Text style={styles.value}>{demande.employePrenom} {demande.employeNom}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Poste :</Text>
          <Text style={styles.value}>{demande.employePoste}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Département :</Text>
          <Text style={styles.value}>{demande.employeDepartement}</Text>
        </View>

        <Text style={styles.sectionTitle}>Détails du Déplacement</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Motif(s) :</Text>
          <Text style={styles.value}>{motifs.join(", ")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date de départ :</Text>
          <Text style={styles.value}>{formatDate(demande.dateDepart)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date de retour :</Text>
          <Text style={styles.value}>{formatDate(demande.dateRetour)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Destination :</Text>
          <Text style={styles.value}>{demande.destination}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Transport :</Text>
          <Text style={styles.value}>{TRANSPORT_LABELS[demande.typeTransport]}</Text>
        </View>
        {demande.vehicule && (
          <View style={styles.row}>
            <Text style={styles.label}>Véhicule :</Text>
            <Text style={styles.value}>{demande.vehicule.nom} ({demande.vehicule.immatriculation})</Text>
          </View>
        )}
        {demande.autreTransport && (
          <View style={styles.row}>
            <Text style={styles.label}>Autre transport :</Text>
            <Text style={styles.value}>{demande.autreTransport}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Frais Estimés</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Type</Text>
            <Text style={styles.tableCell}>Montant</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Transport</Text>
            <Text style={styles.tableCell}>{formatCurrency(Number(demande.fraisTransport ?? 0))}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Hébergement</Text>
            <Text style={styles.tableCell}>{formatCurrency(Number(demande.fraisHebergement ?? 0))}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Repas</Text>
            <Text style={styles.tableCell}>{formatCurrency(Number(demande.fraisRepas ?? 0))}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Divers</Text>
            <Text style={styles.tableCell}>{formatCurrency(Number(demande.fraisDivers ?? 0))}</Text>
          </View>
          <View style={[styles.tableRow, { fontWeight: "bold" }]}>
            <Text style={styles.tableCell}>Total estimé</Text>
            <Text style={styles.tableCell}>{formatCurrency(Number(demande.totalEstime ?? 0))}</Text>
          </View>
        </View>

        {demande.avanceRequise && (
          <>
            <Text style={styles.sectionTitle}>Avance</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Montant avance :</Text>
              <Text style={styles.value}>{formatCurrency(Number(demande.montantAvance ?? 0))}</Text>
            </View>
          </>
        )}

        {demande.description && (
          <>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text>{demande.description}</Text>
          </>
        )}

        <Text style={styles.footer}>
          Document généré le {new Date().toLocaleDateString("fr-FR")} - HAY 2010 SARL
        </Text>
      </Page>
    </Document>
  )
}
