import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { demandeService, DemandeNotFoundError } from "@/lib/demande-service";
import { formatCurrency, formatDate, TRANSPORT_LABELS, STATUT_LABELS } from "@/lib/constants";
import { parseMotif, type DemandeWithRelations } from "@/lib/demande-types";

export default async function ImprimerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  let demande: DemandeWithRelations;
  try {
    demande = await demandeService.queries.findById(id);
  } catch (e) {
    if (e instanceof DemandeNotFoundError) redirect("/demandes");
    throw e;
  }

  const motifs = parseMotif(demande.motif);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 border-b-2 border-primary pb-4">
        <h1 className="text-2xl font-bold text-primary">HAY 2010 SARL</h1>
        <p className="text-sm text-muted-foreground">Formulaire de Demande de Déplacement</p>
        <p className="text-sm text-muted-foreground">N° {demande.numero}</p>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Statut</h2>
        <p className="text-sm">{STATUT_LABELS[demande.statut]}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Informations Employé</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-48 text-muted-foreground">Nom complet</td>
              <td>{demande.employePrenom} {demande.employeNom}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Poste</td>
              <td>{demande.employePoste}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Département</td>
              <td>{demande.employeDepartement}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Détails du Déplacement</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-48 text-muted-foreground">Motif(s)</td>
              <td>{motifs.join(", ")}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Date de départ</td>
              <td>{formatDate(demande.dateDepart)}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Date de retour</td>
              <td>{formatDate(demande.dateRetour)}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Destination</td>
              <td>{demande.destination}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Transport</td>
              <td>{TRANSPORT_LABELS[demande.typeTransport]}</td>
            </tr>
            {demande.vehicule && (
              <tr>
                <td className="text-muted-foreground">Véhicule</td>
                <td>{demande.vehicule.nom} ({demande.vehicule.immatriculation})</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Frais Estimés</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1">Transport</td>
              <td className="text-right">{formatCurrency(Number(demande.fraisTransport ?? 0))}</td>
            </tr>
            <tr>
              <td className="py-1">Hébergement</td>
              <td className="text-right">{formatCurrency(Number(demande.fraisHebergement ?? 0))}</td>
            </tr>
            <tr>
              <td className="py-1">Repas</td>
              <td className="text-right">{formatCurrency(Number(demande.fraisRepas ?? 0))}</td>
            </tr>
            <tr>
              <td className="py-1">Divers</td>
              <td className="text-right">{formatCurrency(Number(demande.fraisDivers ?? 0))}</td>
            </tr>
            <tr className="font-bold border-t">
              <td className="py-1">Total estimé</td>
              <td className="text-right">{formatCurrency(Number(demande.totalEstime ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {demande.avanceRequise && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Avance</h2>
          <p className="text-sm">Montant : {formatCurrency(Number(demande.montantAvance ?? 0))}</p>
        </section>
      )}

      {demande.description && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Description</h2>
          <p className="text-sm whitespace-pre-wrap">{demande.description}</p>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Document généré le {new Date().toLocaleDateString("fr-FR")} - HAY 2010 SARL
      </p>
    </div>
  );
}
