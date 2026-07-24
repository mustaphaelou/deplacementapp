# Context: DemandeDeplacement (Travel Request)

A travel request system where employees submit trip requests that flow through a multi-stage approval pipeline.

## Language

### Core domain

**Societe**:
The organisation that deploys and operates this instance of the application. Every deployment belongs to exactly one Societe. The Societe controls the visual identity (name, logo, colour, favicon) and email branding (sender name, domain) of the instance. Created during Amorçage and mutable via the administration settings.
_Includes_: Société, entreprise, association, administration, etc.
_Avoid_: Organisation, company, tenant

**DemandeDeplacement**:
A request submitted by an employee to travel for business purposes. Has a lifecycle through a multi-stage approval pipeline. Contains an intentional point-in-time snapshot of the employee's data (name, department, position) so historical requests are unaffected by future employee transfers or title changes.
_Avoid_: Trip, request, travel form

**Utilisateur**:
A person who uses the system. Has a role, belongs to exactly one Departement, and belongs to exactly one Societe.
_Avoid_: User, account, person

**Departement**:
An organizational unit within the company (e.g. HR, IT, Finance).
_Avoid_: Division, team, unit

**Role**:
The set of permissions and responsibilities assigned to a Utilisateur. One of EMPLOYEE, MANAGER, FINANCE_ADMIN, GENERAL_DIRECTION.
_Avoid_: Position, title, permission level

**VehiculeEntreprise**:
A company-owned vehicle that can be assigned to a DemandeDeplacement.
_Avoid_: Company car, fleet vehicle

**Ville**:
A Moroccan city that can be selected as the destination of a DemandeDeplacement. Defined as a static list bundled with the app rather than a database table or external API. Each entry has a name and an optional region for grouping.
_Avoid_: City, town, locality

### Workflow

**Etape (Stage)**:
The current position of a DemandeDeplacement in the approval pipeline. One of: DRAFT, MANAGER_REVIEW, FINANCE_REVIEW, DIRECTION_REVIEW, FINAL. When a demande is rejected or withdrawn, the Etape stays where it was — the outcome is recorded in the Decision, not by moving to a new stage. Withdrawal (`retirer`) is only permitted while the demande is still at DRAFT (i.e. before the first `submit`); once submitted, the Employee can no longer recall it — to abandon the trip they must ask the current approver to reject it.
_Avoid_: Step, phase, status

**Decision**:
The outcome recorded at a given Etape. One of: PENDING, APPROVED, REJECTED, WITHDRAWN. APPROVED, REJECTED, and WITHDRAWN are **terminal** — once recorded, the DemandeDeplacement cannot transition any further and cannot be edited or resubmitted. To pursue the trip after a REJECTED or WITHDRAWN outcome, the Employee creates a *new* DemandeDeplacement; the rejected/withdrawn record is retained unchanged for history.

### Pipeline actors

At each Etape exactly one Role is permitted to act. The pairing is fixed:

- **DRAFT** → EMPLOYEE (the owner). EMPLOYEE may `submit` (advances to MANAGER_REVIEW) or `retirer` (records Decision WITHDRAWN, terminates). `retirer` is only permitted here — once submitted, the demande leaves the Employee's hands.
- **MANAGER_REVIEW** → MANAGER. MANAGER may `approuver` (advances to FINANCE_REVIEW) or `rejeter` (records Decision REJECTED, terminates).
- **FINANCE_REVIEW** → FINANCE_ADMIN. FINANCE_ADMIN may `approuver` (advances to DIRECTION_REVIEW) or `rejeter` (terminates).
- **DIRECTION_REVIEW** → GENERAL_DIRECTION. GENERAL_DIRECTION may `approuver` (advances to FINAL) or `rejeter` (terminates).
- **FINAL** → no Role may act. Terminal state.

Once a Decision of APPROVED, REJECTED, or WITHDRAWN is recorded at any Etape, no further transitions are permitted from that Etape.

**StatutDemande (persisted state)**:
The single persisted column on a DemandeDeplacement row that records its current state. One of: BROUILLON, SOUMISE, APPROUVEE_MANAGER, APPROUVEE_FINANCE, APPROUVEE, REJETEE_MANAGER, REJETEE_FINANCE, REJETEE_DIRECTION, RETIREE. **Etape + Decision are a derived in-memory read-model computed from StatutDemande** via `fromLegacyStatus`, not the other way around. New code is encouraged to reason in terms of Etape + Decision (clearer) but must persist via StatutDemande; the `toLegacyStatus` function maps the other direction for writes.
_Avoid_: Treating Etape + Decision as the source of truth; the enum is.

**TypeTransport**:
The mode of transport for a DemandeDeplacement. One of: VOITURE_PERSONNELLE, VOITURE_SOCIETE, BUS, AVION, TRAIN, AUTRE.

**Motif**:
The business reason for a DemandeDeplacement. Selected from a fixed list: mission client, formation, réunion, livraison, maintenance, démarche administrative, autre.
_Avoid_: Purpose, reason, objet

**EstimationFrais**:
The projected cost breakdown of a DemandeDeplacement: transport, hébergement, repas, divers, and a computed total. Part of the DemandeDeplacement, not a separate entity.
_Avoid_: Budget, cost estimate, expenses

**Avance**:
An optional cash advance the employee requests before the trip. Comprises a flag (`avanceRequise`) and an amount (`montantAvance`).
_Avoid_: Prepayment, advance payment, deposit

### Supporting

**Assignataire**:
The Utilisateur who last recorded an approve or reject Decision on a DemandeDeplacement. Persisted on `assigneAId`. NULL while the demande is still in DRAFT (no approver has acted yet); set when the first approver acts and updated on each subsequent approval. On a terminal REJECTED demande the Assignataire is the rejecter; on a terminal APPROVED demande it is the GENERAL_DIRECTION member who gave the final approval. The Assignataire is distinct from the Employe who created the demande.
_Avoid_: Approver, assigné, assignee, last-actor

**Notification**:
A message sent to a Utilisateur about a DemandeDeplacement event, delivered via both an in-app alert and an email. MANAGER notifications are scoped to the employee's Departement; FINANCE_ADMIN and GENERAL_DIRECTION notifications are org-wide.

**AccuseLecture (Read Receipt)**:
A Notification automatically sent to the MANAGER of an Employee's Departement when that Employee marks a Notification related to a DemandeDeplacement as read (lu). Dispatched only when the reader's Role is EMPLOYEE and the Notification is linked to a DemandeDeplacement — reads by MANAGER, FINANCE_ADMIN, or GENERAL_DIRECTION (or reads of demande-less notifications) produce no AccuseLecture.


**JournalAudit**:
A timestamped record of a *committed* state change: who performed what action on which entity. Only successful transitions are recorded — attempts that fail authorization or transition guards (wrong role, invalid action, missing record) throw before the audit dispatch and produce no JournalAudit entry.

**AvatarProfil**:
An optional profile image uploaded by a Utilisateur. Stored as a file on the local filesystem under `/uploads/avatars/` with the URL path saved in `Utilisateur.avatarUrl`.
_Avoid_: Profile picture, profile photo, user image

**Document**:
A file attached to a DemandeDeplacement (e.g., invoice, receipt, PDF). The `type` field is free-text (typically a MIME type or descriptive label), not a fixed enum.

**Amorçage (Setup)**:
The bootstrap lifecycle state of the system while zero Societes exist. It is not a persistent entity — it is a lifecycle state, detected by counting Societes. While in Amorçage, the /login page renders a setup wizard instead of the sign-in form; the wizard creates the initial Societe, the first Departements, and the first Utilisateur (Role GENERAL_DIRECTION), after which the system leaves Amorçage permanently and the wizard never appears again.
_Avoid_: Onboarding, initialization, installation

### Branding

**IdentiteVisuelle (Visual Identity)**:
The set of configurable visual properties of a Societe: its display name (`nom`), logo image (`logoUrl`), favicon image (`faviconUrl`), and primary colour (`couleurPrimaire`). These values are used in the UI header, sidebar, login page, emails, and generated PDFs. Changes are logged in JournalAudit.
_Avoid_: Theme, skin, branding

**NomExpediteurEmail (Email Sender Name)**:
The human-readable name shown as the sender of outgoing notification emails (e.g. "Acme Corp" instead of the app placeholder). Configured per Societe.
_Avoid_: From name, display name

**DomaineEmail (Email Domain)**:
The domain part of the sender email address, e.g. "acme.com" produces "noreply@acme.com". Configured per Societe. Falls back to the SMTP_FROM env var if not set.
_Avoid_: Email suffix, mail domain

## Relationships

- A **Societe** has one or more **Utilisateurs** and one or more **Departements**.
- A **DemandeDeplacement** is created by exactly one **Utilisateur** (the employee).
- A **DemandeDeplacement** can be assigned to at most one **Utilisateur** (the **Assignataire** — the approver who last acted on it).
- A **DemandeDeplacement** may be associated with zero or one **VehiculeEntreprise**.
- A **DemandeDeplacement** has exactly one **Etape** and exactly one current **Decision**.
- A **Utilisateur** belongs to exactly one **Departement** and exactly one **Societe**.
- A **Departement** belongs to exactly one **Societe**.
- An **Utilisateur** can create zero or more **DemandeDeplacement** requests.
- A **Notification** pertains to exactly one **DemandeDeplacement** and one receiving **Utilisateur**.
- A **JournalAudit** entry pertains to one **Utilisateur** (the actor).
- A **Document** belongs to exactly one **DemandeDeplacement**.

## Example dialogue

> **Dev:** "When a manager rejects a demande, does the sequence start over?"
> **Domain expert:** "No — REJECTED is terminal. The employee must create a new DemandeDeplacement if they want to pursue the trip. The original stays at MANAGER_REVIEW with Decision=REJECTED."
> **Dev:** "Can we show 'pending at manager' and 'pending at finance' using the same word?"
> **Domain expert:** "Not really. 'Pending' is too generic. One is waiting for the manager, the other for finance. Those are different places in the pipeline."

## Flagged ambiguities

- "approved" was used to mean both a stage-level outcome (manager said yes) and a terminal outcome (whole pipeline complete). Resolved by splitting into **Etape** (where we are) and **Decision** (what happened there). Terminal approval is `Etape: FINAL, Decision: APPROVED`.
- "status" / "statut" was used for both the single-field legacy representation and the conceptual state machine. Resolved: **StatutDemande** is the *persisted* source of truth (the actual stored column); **Etape** + **Decision** are the *conceptual* read-model computed from it. New code reasons in Etape + Decision but persists via StatutDemande.
- "retirée" (withdrawn) was treated as a separate StatutDemande value. Resolved: withdrawal is a **Decision** (`WITHDRAWN`) and a terminal outcome, not a stage.
