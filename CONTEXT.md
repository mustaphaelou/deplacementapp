# Context: DemandeDeplacement (Travel Request)

## Domain Terms

- **DemandeDeplacement** — A travel request submitted by an employee. Has a lifecycle from draft (BROUILLON) through multi-level approval to final approval (APPROUVEE) or rejection.
- **Utilisateur** — A user of the system. Has a role and belongs to a Departement.
- **Departement** — Organizational department (e.g. HR, IT, Finance).
- **VehiculeEntreprise** — A company-owned vehicle that can be assigned to a travel request.
- **StatutDemande** — The status of a DemandeDeplacement in its workflow lifecycle.
- **TypeTransport** — The mode of transport for a travel request.
- **Notification** — An in-app notification sent to a Utilisateur about a DemandeDeplacement event.
- **JournalAudit** — An audit log entry recording who did what to which entity.
- **Document** — A file (e.g. PDF) attached to a DemandeDeplacement.

## Workflow

The DemandeDeplacement approval workflow is a three-stage pipeline:

1. **EMPLOYEE** creates a DemandeDeplacement (BROUILLON) and submits it (SOUMISE).
2. **MANAGER** reviews and approves (APPROUVEE_MANAGER) or rejects (REJETEE_MANAGER).
3. **FINANCE_ADMIN** reviews budget and approves (APPROUVEE_FINANCE) or rejects (REJETEE_FINANCE).
4. **GENERAL_DIRECTION** gives final approval (APPROUVEE) or rejects (REJETEE_DIRECTION).

At any point before submission, the EMPLOYEE can withdraw a BROUILLON (RETIREE).

## Roles

- **EMPLOYEE** — Creates and submits travel requests. Sees only their own demandes.
- **MANAGER** — Approves/rejects submitted demandes (first stage).
- **FINANCE_ADMIN** — Approves/rejects budget (second stage). Also manages users and vehicles.
- **GENERAL_DIRECTION** — Gives final approval (third stage). Also has admin oversight.

## Dashboard

The dashboard (route `/`) is the landing page after login. It shows role-specific summary statistics and recent demandes. Each role sees different data:
- EMPLOYEE: personal stats (total, drafts, pending, approved) + 5 recent demandes.
- MANAGER: pending count + 10 demandes awaiting approval.
- FINANCE_ADMIN: pending budget approvals count + 10 demandes awaiting financial review.
- GENERAL_DIRECTION: pending final approvals count + total committed budget + 10 demandes awaiting final approval.
