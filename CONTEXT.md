# Context: DemandeDeplacement (Travel Request)

A travel request system where employees submit trip requests that flow through a multi-stage approval pipeline.

## Language

### Core domain

**DemandeDeplacement**:
A request submitted by an employee to travel for business purposes. Has a lifecycle through a multi-stage approval pipeline.
_Avoid_: Trip, request, travel form

**Utilisateur**:
A person who uses the system. Has a role and belongs to exactly one Departement.
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
The current position of a DemandeDeplacement in the approval pipeline. One of: DRAFT, MANAGER_REVIEW, FINANCE_REVIEW, DIRECTION_REVIEW, FINAL.

**Decision**:
The outcome recorded at a given Etape. One of: PENDING, APPROVED, REJECTED, WITHDRAWN.

**StatutDemande (Legacy)**:
The single-field representation of a DemandeDeplacement's state. Retained for backward compatibility and computed from Etape + Decision. Examples: BROUILLON, SOUMISE, APPROUVEE_MANAGER, REJETEE_FINANCE, APPROUVEE, RETIREE.
_Avoid_: Using in new code; prefer Etape + Decision.

**TypeTransport**:
The mode of transport for a DemandeDeplacement. One of: VOITURE_PERSONNELLE, VOITURE_SOCIETE, BUS, AVION, TRAIN, AUTRE.

### Supporting

**Notification**:
A message sent to a Utilisateur about a DemandeDeplacement event, delivered via both an in-app alert and an email.

**AccuseLecture (Read Receipt)**:
A Notification automatically sent to the Manager of an Employee's Departement when that Employee marks a Notification related to a DemandeDeplacement as read (lu).


**JournalAudit**:
A timestamped record of who performed what action on which entity.

**AvatarProfil**:
An optional profile image uploaded by a Utilisateur. Stored as a file on the local filesystem under `/uploads/avatars/` with the URL path saved in `Utilisateur.avatarUrl`.
_Avoid_: Profile picture, profile photo, user image

**Document**:
A file attached to a DemandeDeplacement (e.g., invoice, receipt, PDF).

## Relationships

- A **DemandeDeplacement** is created by exactly one **Utilisateur** (the employee).
- A **DemandeDeplacement** can be assigned to at most one **Utilisateur** (the approver who last acted on it).
- A **DemandeDeplacement** may be associated with zero or one **VehiculeEntreprise**.
- A **DemandeDeplacement** has exactly one **Etape** and exactly one current **Decision**.
- A **Utilisateur** belongs to exactly one **Departement**.
- An **Utilisateur** can create zero or more **DemandeDeplacement** requests.
- A **Notification** pertains to exactly one **DemandeDeplacement** and one receiving **Utilisateur**.
- A **JournalAudit** entry pertains to one **Utilisateur** (the actor).
- A **Document** belongs to exactly one **DemandeDeplacement**.

## Example dialogue

> **Dev:** "When a manager rejects a demande, does the sequence start over?"
> **Domain expert:** "No — the demande stops. The employee must create a new one."
> **Dev:** "Can we show 'pending at manager' and 'pending at finance' using the same word?"
> **Domain expert:** "Not really. 'Pending' is too generic. One is waiting for the manager, the other for finance. Those are different places in the pipeline."

## Flagged ambiguities

- "approved" was used to mean both a stage-level outcome (manager said yes) and a terminal outcome (whole pipeline complete). Resolved by splitting into **Etape** (where we are) and **Decision** (what happened there). Terminal approval is `Etape: FINAL, Decision: APPROVED`.
- "status" / "statut" was used for both the single-field legacy representation and the conceptual state machine. Resolved: **StatutDemande** is the legacy computed field; **Etape** + **Decision** are the canonical model.
- "retirée" (withdrawn) was treated as a separate StatutDemande value. Resolved: withdrawal is a **Decision** (`WITHDRAWN`) and a terminal outcome, not a stage.
