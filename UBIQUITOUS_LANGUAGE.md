# Ubiquitous Language — DemandeDeplacement

This glossary captures the canonical domain vocabulary for the DemandeDeplacement system. Terms are grouped by subdomain.

---

## Core Domain

| Term | Definition | Avoid |
|------|------------|-------|
| **Societe** | The organisation that deploys and operates this application instance. Exactly one per deployment. Controls visual identity and email branding. | Organisation, company, tenant |
| **DemandeDeplacement** | A business travel request submitted by an employee. Contains a point-in-time snapshot of employee data (name, department, position) so history is immutable. Has a lifecycle through a 5-stage approval pipeline. | Trip, request, travel form |
| **Utilisateur** | A person who uses the system. Has exactly one **Role**, belongs to exactly one **Departement**, and belongs to exactly one **Societe**. | User, account, person |
| **Departement** | An organizational unit within the Societe (e.g., HR, IT, Finance). | Division, team, unit |
| **Role** | The set of permissions and responsibilities assigned to a Utilisateur. One of: EMPLOYEE, MANAGER, FINANCE_ADMIN, GENERAL_DIRECTION. | Position, title, permission level |
| **VehiculeEntreprise** | A company-owned vehicle assignable to a DemandeDeplacement. | Company car, fleet vehicle |
| **Ville** | A Moroccan city selectable as a DemandeDeplacement destination. Defined as a static list bundled with the app (name + optional region). | City, town, locality |

---

## Workflow (Approval Pipeline)

| Term | Definition | Avoid |
|------|------------|-------|
| **Etape** | The current position of a DemandeDeplacement in the approval pipeline. One of: DRAFT, MANAGER_REVIEW, FINANCE_REVIEW, DIRECTION_REVIEW, FINAL. When rejected or withdrawn, the Etape does **not** change — the outcome is recorded in the **Decision**, not by moving stages. | Step, phase, status |
| **Decision** | The outcome recorded at an Etape. One of: PENDING, APPROVED, REJECTED, WITHDRAWN. APPROVED, REJECTED, and WITHDRAWN are **terminal** — once recorded, the DemandeDeplacement cannot transition further or be edited. A rejected/withdrawn trip requires a new DemandeDeplacement. | Outcome, result, verdict |
| **StatutDemande** | The single persisted enum column on DemandeDeplacement recording its state. One of: BROUILLON, SOUMISE, APPROUVEE_MANAGER, APPROUVEE_FINANCE, APPROUVEE, REJETEE_MANAGER, REJETEE_FINANCE, REJETEE_DIRECTION, RETIREE. **Etape + Decision are a derived in-memory read-model computed from StatutDemande** via `fromLegacyStatus`. New code reasons in Etape + Decision but persists via StatutDemande. | Treating Etape+Decision as source of truth; the enum is |
| **TypeTransport** | Mode of transport for a DemandeDeplacement. One of: VOITURE_PERSONNELLE, VOITURE_SOCIETE, BUS, AVION, TRAIN, AUTRE. | Transport mode, travel mode |
| **Motif** | Business reason for a DemandeDeplacement. Selected from fixed list: mission client, formation, réunion, livraison, maintenance, démarche administrative, autre. | Purpose, reason, objet |
| **EstimationFrais** | Projected cost breakdown of a DemandeDeplacement: transport, hébergement, repas, divers, and computed total. Part of the DemandeDeplacement, not a separate entity. | Budget, cost estimate, expenses |
| **Avance** | Optional cash advance requested before the trip. Comprises a flag (`avanceRequise`) and an amount (`montantAvance`). | Prepayment, advance payment, deposit |

---

## Pipeline Actors & Actions

| Term | Definition | Avoid |
|------|------------|-------|
| **EMPLOYEE** | Role that acts at Etape DRAFT. May `submit` (advances to MANAGER_REVIEW) or `retirer` (records Decision=WITHDRAWN, terminates). `retirer` only permitted at DRAFT. | Employee, requester |
| **MANAGER** | Role that acts at MANAGER_REVIEW. May `approuver` (advances to FINANCE_REVIEW) or `rejeter` (terminates). | Supervisor, approver |
| **FINANCE_ADMIN** | Role that acts at FINANCE_REVIEW. May `approuver` (advances to DIRECTION_REVIEW) or `rejeter` (terminates). | Finance, finance approver |
| **GENERAL_DIRECTION** | Role that acts at DIRECTION_REVIEW. May `approuver` (advances to FINAL) or `rejeter` (terminates). | Direction, GM, general director |
| **submit** | Employee action at DRAFT: advances to MANAGER_REVIEW, records Decision=APPROVED at DRAFT. | Submit, send |
| **approuver** | Approver action at their Etape: advances to next Etape, records Decision=APPROVED at current Etape. | Approve, validate |
| **rejeter** | Approver action at their Etape: records Decision=REJECTED, terminates (terminal). | Reject, deny |
| **retirer** | Employee action at DRAFT only: records Decision=WITHDRAWN, terminates (terminal). | Withdraw, cancel, recall |

---

## Supporting Concepts

| Term | Definition | Avoid |
|------|------------|-------|
| **Assignataire** | The Utilisateur who last recorded an approve or reject Decision on a DemandeDeplacement. Persisted on `assigneAId`. NULL at DRAFT; set when first approver acts; updated on each subsequent approval or rejection. On terminal REJECTED: the rejecter. On terminal APPROVED: the GENERAL_DIRECTION member who gave final approval. Distinct from the Employe who created the demande. | Approver, assigné, assignee, last-actor |
| **Notification** | Message sent to a Utilisateur about a DemandeDeplacement event, delivered via in-app alert and email. MANAGER notifications scoped to employee's Departement; FINANCE_ADMIN and GENERAL_DIRECTION org-wide. | Alert, message, notice |
| **AccuseLecture** | Read receipt automatically sent to the MANAGER of an Employee's Departement when that Employee marks a DemandeDeplacement-related Notification as read. Only triggered when reader's Role=EMPLOYEE. | Read receipt, acknowledgment |
| **JournalAudit** | Timestamped record of a *committed* state change: who performed what action on which entity. Only successful transitions recorded — failed authorizations/guards throw before audit dispatch. | Audit log, history, trail |
| **AvatarProfil** | Optional profile image uploaded by a Utilisateur. Stored on local filesystem at `/uploads/avatars/` with URL path in `Utilisateur.avatarUrl`. | Profile picture, profile photo, user image |
| **Document** | File attached to a DemandeDeplacement (invoice, receipt, PDF). The `type` field is free-text (typically MIME type or label), not a fixed enum. | Attachment, file |
| **Amorçage** | Bootstrap lifecycle state while zero Societes exist. Not a persistent entity — detected by counting Societes. While in Amorçage, `/login` renders a setup wizard that creates the initial Societe, first Departements, and first Utilisateur (Role GENERAL_DIRECTION). After completion, Amorçage ends permanently. | Onboarding, initialization, installation |

---

## Branding & Identity

| Term | Definition | Avoid |
|------|------------|-------|
| **IdentiteVisuelle** | Configurable visual properties of a Societe: display name (`nom`), logo (`logoUrl`), favicon (`faviconUrl`), primary colour (`couleurPrimaire`). Used in UI header, sidebar, login, emails, generated PDFs. Changes logged in JournalAudit. | Theme, skin, branding |
| **NomExpediteurEmail** | Human-readable sender name for outgoing notification emails (e.g., "Acme Corp"). Configured per Societe. | From name, display name |
| **DomaineEmail** | Domain part of sender email address (e.g., "acme.com" → "noreply@acme.com"). Configured per Societe; falls back to SMTP_FROM env var. | Email suffix, mail domain |

---

## Deployment

| Term | Definition | Avoid |
|------|------------|-------|
| **Release** | A deployable snapshot of the application: a git tag `vX.Y.Z` pushed to main. Derives GHCR image tags (`vX.Y.Z`, `X.Y`), the GitHub Release object, and the changelog. `latest` is a rolling alias for main, not a Release. The `package.json` version is decorative. | Calling a main push, the `latest` image, or the `package.json` version a "Release" |
| **Publish Gate** | The verification sequence every image must pass before being pushed to GHCR: the unit checks (`lint` + `typecheck` + the unit test suite, incl. the `npm ls --omit=dev` dependency-tree check) plus the reusable image smoke test (`scripts/smoke-test.sh`), whose exit code is 0 iff the deployment set is runnable. In CI the gate is structural — the publish workflow's `publish-check` job `needs:` the `verify` job, then smoke-tests the loaded amd64 images before any push; the `build-and-push` matrix job (one row per image in the image map) cannot push until `publish-check` is green; a failed step publishes nothing and creates no GitHub Release. Pull requests run the unit checks only. CI and local development share one verification path (`scripts/test-docker-build.sh`). | Smoke test (the check alone), docker build test |

---

## Relationships

- A **Societe** has one or more **Utilisateurs** and one or more **Departements**.
- A **DemandeDeplacement** is created by exactly one **Utilisateur** (the employee).
- A **DemandeDeplacement** is assigned to at most one **Utilisateur** (the **Assignataire** — the approver who last acted).
- A **DemandeDeplacement** may be associated with zero or one **VehiculeEntreprise**.
- A **DemandeDeplacement** has exactly one **Etape** and exactly one current **Decision**.
- A **Utilisateur** belongs to exactly one **Departement** and exactly one **Societe**.
- A **Departement** belongs to exactly one **Societe**.
- A **Utilisateur** can create zero or more **DemandeDeplacement** requests.
- A **Notification** pertains to exactly one **DemandeDeplacement** and one receiving **Utilisateur**.
- A **JournalAudit** entry pertains to one **Utilisateur** (the actor).
- A **Document** belongs to exactly one **DemandeDeplacement**.

---

## Example Dialogue

> **Dev:** "When a manager rejects a demande, does the sequence start over?"
> **Domain expert:** "No — REJECTED is terminal. The employee must create a new DemandeDeplacement if they want to pursue the trip. The original stays at MANAGER_REVIEW with Decision=REJECTED."
>
> **Dev:** "Can we show 'pending at manager' and 'pending at finance' using the same word?"
> **Domain expert:** "Not really. 'Pending' is too generic. One is waiting for the manager, the other for finance. Those are different places in the pipeline — different **Etape** values."
>
> **Dev:** "So if the GENERAL_DIRECTION approves, the Assignataire becomes that GENERAL_DIRECTION member?"
> **Domain expert:** "Exactly. The Assignataire is always the person who *last acted*. On final approval it's the GENERAL_DIRECTION member; on rejection it's whoever rejected."
>
> **Dev:** "What happens if an employee tries to withdraw after submitting?"
> **Domain expert:** "They can't. `retirer` is only permitted at DRAFT. Once submitted, the demande has left their hands — they'd need to ask the current approver to reject it."
>
> **Dev:** "So StatutDemande is the source of truth, but we reason in Etape + Decision?"
> **Domain expert:** "Yes. New code uses Etape + Decision for clarity, but persists via StatutDemande using `toLegacyStatus`. The enum is the single stored column."

---

## Flagged Ambiguities

- **"Approved"** was used to mean both a stage-level outcome (manager said yes) and a terminal outcome (whole pipeline complete). Resolved by splitting into **Etape** (where we are) and **Decision** (what happened there). Terminal approval = `Etape: FINAL, Decision: APPROVED`.
- **"Status" / "statut"** was used for both the single-field legacy representation and the conceptual state machine. Resolved: **StatutDemande** is the *persisted* source of truth (the actual stored column); **Etape** + **Decision** are the *conceptual* read-model computed from it. New code reasons in Etape + Decision but persists via StatutDemande.
- **"Retirée" (withdrawn)** was treated as a separate StatutDemande value. Resolved: withdrawal is a **Decision** (`WITHDRAWN`) and a terminal outcome, not a stage.
- **"Approver"** was used ambiguously for both the Role permitted at a stage and the Assignataire who last acted. Resolved: **Role** defines who *can* act at each Etape; **Assignataire** is the Utilisateur who *did* act last.
- **"Status"** in UI labels sometimes meant Etape, sometimes Decision, sometimes StatutDemande. Resolved: UI should use **Etape** for "where are we in the pipeline" and **Decision** for "what happened at the current stage"; never show raw StatutDemande to users.