/**
 * The administration page's submit-body construction, extracted from the
 * dialog so it can be pinned against the intake schema in a unit test: the
 * exact payload the form produces must pass the schema that guards the route.
 * The form carries no Société id — provisioning resolves the deployment's
 * Societe behind the seam (ADR-0018).
 */

export interface UtilisateurFormValues {
  email: string
  nom: string
  prenom: string
  poste: string
  role: string
  departementId: string
  telephone: string
  motDePasse: string
  googleAuthEnabled: boolean
}

export function buildUtilisateurPayload(
  form: UtilisateurFormValues,
  editingUserId: string | null = null
) {
  return editingUserId ? { ...form, id: editingUserId } : form
}
