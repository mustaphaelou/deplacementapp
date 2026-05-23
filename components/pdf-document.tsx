import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { formatCurrency, formatDate, TRANSPORT_LABELS, STATUT_LABELS } from "@/lib/constants"
import type { PdfRenderData } from "@/lib/pdf-types"

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

export default function PdfDocument({ data }: { data: PdfRenderData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>HAY 2010 SARL</Text>
          <Text style={styles.subtitle}>Formulaire de Demande de Déplacement</Text>
          <Text style={styles.subtitle}>N° {data.numero}</Text>
        </View>

        <Text style={styles.sectionTitle}>Statut</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Statut actuel :</Text>
          <Text style={styles.value}>{STATUT_LABELS[data.statut]}</Text>
        </View>

        <Text style={styles.sectionTitle}>Informations Employé</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom complet :</Text>
          <Text style={styles.value}>{data.employePrenom} {data.employeNom}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Poste :</Text>
          <Text style={styles.value}>{data.employePoste}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Département :</Text>
          <Text style={styles.value}>{data.employeDepartement}</Text>
        </View>

        <Text style={styles.sectionTitle}>Détails du Déplacement</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Motif(s) :</Text>
          <Text style={styles.value}>{data.motif.join(", ")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date de départ :</Text>
          <Text style={styles.value}>{formatDate(data.dateDepart)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date de retour :</Text>
          <Text style={styles.value}>{formatDate(data.dateRetour)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Destination :</Text>
          <Text style={styles.value}>{data.destination}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Transport :</Text>
          <Text style={styles.value}>{TRANSPORT_LABELS[data.typeTransport]}</Text>
        </View>
        {data.vehicule && (
          <View style={styles.row}>
            <Text style={styles.label}>Véhicule :</Text>
            <Text style={styles.value}>{data.vehicule.nom} ({data.vehicule.immatriculation})</Text>
          </View>
        )}
        {data.autreTransport && (
          <View style={styles.row}>
            <Text style={styles.label}>Autre transport :</Text>
            <Text style={styles.value}>{data.autreTransport}</Text>
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
            <Text style={styles.tableCell}>{formatCurrency(data.couts.transport)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Hébergement</Text>
            <Text style={styles.tableCell}>{formatCurrency(data.couts.hebergement)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Repas</Text>
            <Text style={styles.tableCell}>{formatCurrency(data.couts.repas)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>Divers</Text>
            <Text style={styles.tableCell}>{formatCurrency(data.couts.divers)}</Text>
          </View>
          <View style={[styles.tableRow, { fontWeight: "bold" }]}>
            <Text style={styles.tableCell}>Total estimé</Text>
            <Text style={styles.tableCell}>{formatCurrency(data.couts.total)}</Text>
          </View>
        </View>

        {data.avanceRequise && (
          <>
            <Text style={styles.sectionTitle}>Avance</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Montant avance :</Text>
              <Text style={styles.value}>{formatCurrency(data.montantAvance ?? 0)}</Text>
            </View>
          </>
        )}

        {data.description && (
          <>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text>{data.description}</Text>
          </>
        )}

        <Text style={styles.footer}>
          Document généré le {new Date().toLocaleDateString("fr-FR")} - HAY 2010 SARL
        </Text>
      </Page>
    </Document>
  )
}
