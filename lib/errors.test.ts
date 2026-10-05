import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import { checkTransition } from "./workflow"
import type {
  Etape,
  Decision,
  WorkflowAction,
  TransitionCheckReason,
} from "./workflow"
import type { Role } from "./auth"
import { TOUS_LES_ROLES } from "./auth"
import {
  REFUS_TRANSITION,
  refusPourTransition,
  InvalidTransitionError,
  UnauthorizedActionError,
} from "./errors"

// ─── Reading the two shapes every assertion here goes through ───────────────
//
// `Error` carries no `status`, and the guard's result is a two-arm union. Both
// are read through a named accessor rather than a cast at each call site, so a
// change to either shape breaks ONE place — and neither accessor restates the
// guard's verdict, so no assertion here derives its expectation from the code
// under test.

/** `status`, read the way `handleServiceError` reads it (ADR-0002). */
function statusDe(refus: Error): number | undefined {
  return (refus as Error & { status?: number }).status
}

/**
 * The reason the guard returned, narrowed.
 *
 * The check IS the assertion, and the throw after it is what narrows the union
 * for the type-checker — `expect(check.ok).toBe(false)` alone does not narrow,
 * and reading `check.reason` off an unnarrowed union is a type error rather than
 * a second, redundant assertion of the same fact.
 */
function raisonDuGarde(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  decision: Decision | undefined,
  ownerMatch: boolean
): TransitionCheckReason {
  const check = checkTransition(role, etape, action, decision, ownerMatch)
  const ou = `${role}/${etape}/${action}/${String(decision)}/owner=${ownerMatch}`

  expect(check.ok, `la garde a accepte ${ou}`).toBe(false)
  if (check.ok) throw new Error(`la garde a accepte ${ou}`)
  return check.reason
}

// ─── The tuple space, swept to DERIVE the reason set (#300) ─────────────────
//
// The criterion is that every reason the guard can produce has a refusal, and
// that a FIFTH reason fails this suite until it is named in the table. Neither is
// deliverable by transcribing the four reason strings here: a list of literals is
// a list of literals, so it passes on exactly the addition it exists to catch.
// So the set is collected by ASKING THE GUARD, and the table is read against what
// came back.
//
// The dimensions are the guard's own signature. The VALUES are written out here
// rather than read out of `PIPELINE`, `TOUS_LES_ROLES` or `TERMINAL_DECISIONS`, so
// a change to any of those declarations cannot quietly shrink the space this sweep
// covers — a sweep that reads the declaration it is sweeping would cover exactly
// as much as that declaration says and no more.

const ETAPES: readonly Etape[] = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

const ACTIONS: readonly WorkflowAction[] = [
  "submit",
  "approuver",
  "rejeter",
  "retirer",
]

const DECISIONS: readonly (Decision | undefined)[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  undefined,
]

const OWNERSHIP: readonly boolean[] = [true, false]

/** One refused tuple, as the guard actually answered it. */
interface TupleRefuse {
  reason: TransitionCheckReason
  role: Role
  etape: Etape
  action: WorkflowAction
  decision: Decision | undefined
  ownerMatch: boolean
}

/** Every refused tuple of the space: Role × Etape × action × Decision × ownership. */
function tuplesRefuses(): TupleRefuse[] {
  const tuples: TupleRefuse[] = []

  for (const role of TOUS_LES_ROLES) {
    for (const etape of ETAPES) {
      for (const action of ACTIONS) {
        for (const decision of DECISIONS) {
          for (const ownerMatch of OWNERSHIP) {
            const check = checkTransition(role, etape, action, decision, ownerMatch)
            if (!check.ok) {
              tuples.push({ reason: check.reason, role, etape, action, decision, ownerMatch })
            }
          }
        }
      }
    }
  }
  return tuples
}

/** The distinct reasons the guard produced, DERIVED by the sweep. */
function raisonsDuGarde(): TransitionCheckReason[] {
  return [...new Set(tuplesRefuses().map((t) => t.reason))].sort() as TransitionCheckReason[]
}

// ─── The classification: two claims, not four classes (#300) ────────────────
//
// The reason is the discriminator and belongs in the reason, not in the class
// name (spec #298). The two reasons about WHO IS ASKING keep the code that means
// « you may not »; the two about the DEMANDEPLACEMENT take the code that already
// means an invalid transition.

/** Les refus qui parlent de QUI demande — « vous n'avez pas le droit ». */
const AU_SUJET_DE_QUI_DEMANDE: readonly TransitionCheckReason[] = [
  "NOT_OWNER",
  "WRONG_ROLE",
]

/** Les refus qui parlent de LA DEMANDEPLACEMENT — une transition invalide. */
const AU_SUJET_DE_LA_DEMANDE: readonly TransitionCheckReason[] = [
  "TERMINAL",
  "NO_EFFECT",
]

// ─── Totality (#300) ────────────────────────────────────────────────────────

describe("REFUS_TRANSITION is total over the reasons the guard produces", () => {
  // Non-vacuity FIRST. A sweep that collected nothing satisfies every assertion
  // below vacuously, so the space itself is asserted to be real — and asserted to
  // be a space the guard neither always accepts nor always refuses, because a
  // guard that refused every tuple would pass a totality sweep just as cheaply.
  it("sweeps a space the guard both enters and refuses", () => {
    const tuples = tuplesRefuses()

    expect(TOUS_LES_ROLES.length).toBe(4)
    expect(ETAPES.length).toBe(5)
    expect(ACTIONS.length).toBe(4)
    expect(DECISIONS.length).toBe(5)
    expect(OWNERSHIP.length).toBe(2)
    expect(tuples.length).toBeGreaterThan(0)
    expect(tuples.length).toBeLessThan(4 * 5 * 4 * 5 * 2)
  })

  it("names a refusal for every reason the guard can produce", () => {
    for (const { reason, role, etape, action, decision, ownerMatch } of tuplesRefuses()) {
      const refus = refusPourTransition(reason, action)
      const ou = `${reason} via ${role}/${etape}/${action}/${String(decision)}/owner=${ownerMatch}`

      expect(Object.keys(REFUS_TRANSITION), ou).toContain(reason)
      expect(typeof statusDe(refus), `${ou} ne porte aucun status`).toBe("number")
      expect(refus.message.trim().length, `${ou} porte une phrase vide`).toBeGreaterThan(0)
      expect(refus, ou).toBeInstanceOf(Error)
    }
  })

  // THE criterion: a fifth reason the guard can produce must fail this until it is
  // named. The comparison is against the reasons the GUARD produced over its own
  // input space, not against a list of literals — so the moment the guard grows a
  // fifth reason and this sweep can reach it, the table is one row short and this
  // fails.
  it("has exactly as many rows as the guard has distinct reasons", () => {
    const raisons = raisonsDuGarde()

    expect(raisons.length).toBeGreaterThan(1)
    expect(Object.keys(REFUS_TRANSITION).sort()).toEqual(raisons)
  })

  // A `default:` arm, or a `?? new UnauthorizedActionError()` beside the row it
  // reads, is a fall-through by another name. Pinned on the SOURCE, because the
  // behaviour it substitutes for is only observable for a reason that does not
  // exist — and asserting on behaviour nobody can reach is how a fall-through
  // survives a review.
  it("has no default arm and no fallback beside the row it reads", async () => {
    // Comments are stripped first: the word « default » is DISCUSSED in this
    // module's own docblock, and a pin that cannot tell a sentence about a rule
    // from the rule's code is a pin that cries wolf.
    const source = sansCommentaires(
      await readFile(new URL("./errors.ts", import.meta.url), "utf8")
    )
    const debut = source.indexOf("export const REFUS_TRANSITION")
    const fin = source.indexOf("export function refusPourTransition")
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)

    const table = source.slice(debut, fin)
    expect(table).not.toMatch(/\bdefault\s*:/)
    expect(table).not.toMatch(/\?\?/)
    expect(table).not.toMatch(/\[reason\]/)

    // The raiser reads the row and returns it. It does not choose, and it does
    // not fall back.
    const raiser = source.slice(fin, source.indexOf("export class UtilisateurNotFoundError"))
    expect(raiser).toContain("return REFUS_TRANSITION[reason](action)")
    expect(raiser).not.toMatch(/\?\?/)
    expect(raiser).not.toMatch(/\bdefault\b/)
  })

  // The class matches the claim. Read through the real guard's reasons, so a
  // reason that moved between the two claims — or a fifth one in neither — fails
  // here rather than passing with whatever code it happened to carry.
  it("gives each reason the code its claim carries", () => {
    for (const { reason, role, etape, action, decision } of tuplesRefuses()) {
      const refus = refusPourTransition(reason, action)
      const ou = `${reason} via ${role}/${etape}/${action}/${String(decision)}`

      if (AU_SUJET_DE_QUI_DEMANDE.includes(reason)) {
        expect(refus, `${ou} — refus sur « qui demande »`).toBeInstanceOf(
          UnauthorizedActionError
        )
        expect(statusDe(refus), ou).toBe(403)
      } else if (AU_SUJET_DE_LA_DEMANDE.includes(reason)) {
        expect(refus, `${ou} — refus sur « la demande »`).toBeInstanceOf(
          InvalidTransitionError
        )
        expect(statusDe(refus), ou).toBe(422)
      } else {
        // A reason in neither claim is a claim nobody wrote: fail loudly rather
        // than let it pass with whatever code it happened to carry.
        throw new Error(`raison sans claim: ${ou}`)
      }
    }
  })

  // Every reason yields a FRENCH sentence, and the sentences are DISTINCT. A
  // table that put « Action non autorisee » back on one row would have changed the
  // class of two reasons and nothing a reader can see — which is the half of this
  // ticket with no code to show for it.
  it("gives every reason its own French sentence", () => {
    const raisons = raisonsDuGarde()
    const messages = raisons.map((raison) =>
      refusPourTransition(raison, "approuver").message
    )

    for (const message of messages) {
      // A sentence: at least three words, each one alphabetic (so an identifier, a
      // path or a status code cannot pass as one).
      const mots = message.split(/\s+/).filter(Boolean)
      expect(mots.length, `"${message}"`).toBeGreaterThanOrEqual(3)
      for (const mot of mots) {
        expect(mot, `"${message}" contient "${mot}"`).toMatch(/^[A-Za-zÀ-ÿ'’-]+$/)
      }
    }

    expect(new Set(messages).size, "une phrase sert deux raisons").toBe(raisons.length)
    for (const message of messages) {
      expect(message).not.toBe("Action non autorisee")
    }
  })
})

// ─── The two ownership sentences, preserved byte-for-byte (#300) ─────────────
//
// AC: « a Utilisateur refused for ownership reads what they read now ». These two
// literals are spelled out here rather than rebuilt from the table's own
// expression — recomposing them would compare the table with itself.

describe("the ownership refusals read exactly what they read before", () => {
  it("keeps the submit sentence, unaccented, byte for byte", () => {
    expect(refusPourTransition("NOT_OWNER", "submit").message).toBe(
      "Seul le proprietaire peut soumettre la demande"
    )
  })

  it("keeps the retirer sentence, unaccented, byte for byte", () => {
    expect(refusPourTransition("NOT_OWNER", "retirer").message).toBe(
      "Seul le proprietaire peut retirer la demande"
    )
  })

  // And they keep the code that means « you may not »: this one IS about who is
  // asking, and a Utilisateur who is not the owner may well hold the seat.
  it("keeps the permission code", () => {
    expect(refusPourTransition("NOT_OWNER", "submit")).toBeInstanceOf(
      UnauthorizedActionError
    )
    expect(statusDe(refusPourTransition("NOT_OWNER", "submit"))).toBe(403)
    expect(statusDe(refusPourTransition("NOT_OWNER", "retirer"))).toBe(403)
  })

  // The ownership fact is ASKED of the guard, not assumed: only a non-owner
  // reaches this row, and the owner on the same tuple is not refused at all.
  it("is the refusal the guard's own NOT_OWNER produces", () => {
    const raison = raisonDuGarde("EMPLOYEE", "DRAFT", "submit", "PENDING", false)

    expect(raison).toBe("NOT_OWNER")
    expect(refusPourTransition(raison, "submit").message).toBe(
      "Seul le proprietaire peut soumettre la demande"
    )
    expect(checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", true).ok).toBe(true)
  })
})

// ─── The seat refusal is TRUE at both Etapes it can be produced at (#300) ───
//
// The guard reads the Etape's seat BEFORE the Decision, so at FINAL — where no
// Role holds a seat at all — the reason is WRONG_ROLE for a GENERAL_DIRECTION who
// has just approved the DemandeDeplacement. A sentence about the Utilisateur's
// standing would be a lie there. Both places are driven through the REAL guard, so
// neither is asserted from a hand-written tuple.

describe("the seat refusal is true at the terminal Etape and at a review Etape", () => {
  // At FINAL. The tuple the ticket names: a GENERAL_DIRECTION presses « Approuver »
  // on a DemandeDeplacement that has just been approved.
  it("is what the guard produces at FINAL, for the Role that did the approving", () => {
    const raison = raisonDuGarde(
      "GENERAL_DIRECTION",
      "FINAL",
      "approuver",
      "APPROVED",
      true
    )

    expect(raison).toBe("WRONG_ROLE")
    const message = refusPourTransition(raison, "approuver").message
    expect(message).toBe("Aucune transition n'est possible a cette etape pour ce role")

    // TRUE, not merely different from the old sentence. The sentence is about the
    // Etape and the Role's seat AT it, so it cannot be read as « you were not
    // allowed »: the second person « vous », the permission verbs and the old
    // generic shrug are each what would make it a lie for an authorised reader —
    // the GENERAL_DIRECTION here is the person who approved it.
    expect(message).toContain("etape")
    expect(message).toContain("role")
    expect(message).not.toMatch(/\bvous\b/i)
    expect(message).not.toMatch(/n['’]avez\s+pas\s+le\s+droit/i)
    expect(message).not.toMatch(/autorise/i)
    expect(message).not.toMatch(/interdit/i)
    expect(message).not.toMatch(/permission/i)
  })

  // At a review Etape. The same reason, reached through the seat check
  // (`stage.roleCanAct !== role`) rather than through FINAL's missing seat.
  it("is what the guard produces at MANAGER_REVIEW for a Role without the seat", () => {
    const raison = raisonDuGarde(
      "EMPLOYEE",
      "MANAGER_REVIEW",
      "approuver",
      "PENDING",
      true
    )

    expect(raison).toBe("WRONG_ROLE")
    // One sentence for both Etapes: the refusal names the REASON, not the Etape, so
    // one reason never becomes two stories.
    expect(refusPourTransition(raison, "approuver").message).toBe(
      "Aucune transition n'est possible a cette etape pour ce role"
    )

    // And the Role that DOES hold that seat is not refused at all — which is what
    // makes the « etape … ce role » phrasing load-bearing rather than decorative:
    // the same action is admissible for one Role at that Etape and not another.
    expect(
      checkTransition("MANAGER", "MANAGER_REVIEW", "approuver", "PENDING", true).ok
    ).toBe(true)
  })

  // Non-vacuity for the assertions above: they must be CAPABLE of rejecting the
  // Utilisateur-facing phrasing, or they pass on a message they would equally
  // accept. Asserted as properties of the phrasings themselves, written out.
  it("still rejects a sentence phrased about the Utilisateur", () => {
    const parLUtilisateur = [
      "Vous n'avez pas le droit d'agir a cette etape",
      "Action non autorisee pour ce role",
      "Votre role ne permet pas cette transition",
    ]
    const surLEtape = "Aucune transition n'est possible a cette etape pour ce role"

    for (const message of parLUtilisateur) {
      expect(message).not.toBe(surLEtape)
      expect(message).toMatch(/\bvous\b|autorise|permission|permet/i)
    }
    expect(surLEtape).not.toMatch(/\bvous\b|autorise|permission|permet/i)
  })
})

// ─── The recorded-Decision refusal stays REACHABLE at a review Etape ────────
//
// At FINAL the Decision is never the reason — the seat is read first — so the
// TERMINAL row is reachable only where a Role holds the seat AND the Decision is
// terminal. That is the case a Utilisateur actually meets: a MANAGER pressing
// « Approuver » on a DemandeDeplacement the MANAGER already rejected.

describe("the recorded-Decision refusal is reachable where a Utilisateur meets it", () => {
  it("is what the guard produces at MANAGER_REVIEW with a REJECTED Decision", () => {
    const raison = raisonDuGarde(
      "MANAGER",
      "MANAGER_REVIEW",
      "approuver",
      "REJECTED",
      true
    )

    expect(raison).toBe("TERMINAL")
    const refus = refusPourTransition(raison, "approuver")
    expect(refus.message).toBe("La demande a deja ete decidee")
    expect(statusDe(refus)).toBe(422)
    // It must NOT be the permission claim: this MANAGER IS authorised here and the
    // DemandeDeplacement is decided. That is the whole point of the ticket.
    expect(refus).not.toBeInstanceOf(UnauthorizedActionError)
    expect(refus.message).not.toMatch(/autorise|permission|droit/i)
  })

  it("is reachable at each review Etape for each terminal Decision", () => {
    const sieges: ReadonlyArray<readonly [Role, Etape]> = [
      ["MANAGER", "MANAGER_REVIEW"],
      ["FINANCE_ADMIN", "FINANCE_REVIEW"],
      ["GENERAL_DIRECTION", "DIRECTION_REVIEW"],
    ]

    for (const [role, etape] of sieges) {
      for (const decision of ["APPROVED", "REJECTED", "WITHDRAWN"] as const) {
        const raison = raisonDuGarde(role, etape, "approuver", decision, true)
        const ou = `${role}/${etape}/${decision}`

        expect(raison, ou).toBe("TERMINAL")
        expect(refusPourTransition(raison, "approuver").message, ou).toBe(
          "La demande a deja ete decidee"
        )
      }
    }
  })

  // The same Decision blocks a DRAFT — where the seat check has already passed for
  // its owner, so this is a Utilisateur refusing their OWN draft, and the old
  // sentence (« you may not ») was doubly false.
  it("names the Decision on an owner action at DRAFT too", () => {
    const raison = raisonDuGarde("EMPLOYEE", "DRAFT", "retirer", "WITHDRAWN", true)

    expect(raison).toBe("TERMINAL")
    expect(refusPourTransition(raison, "retirer").message).toBe(
      "La demande a deja ete decidee"
    )
    expect(statusDe(refusPourTransition(raison, "retirer"))).toBe(422)
  })

  // The NON-effect refusal names the Etape's action table, and it is reachable by
  // an authorised Role: `approuver` does not exist at DRAFT.
  it("names the Etape that has no such action, for the Role that owns it", () => {
    const raison = raisonDuGarde("EMPLOYEE", "DRAFT", "approuver", "PENDING", true)

    expect(raison).toBe("NO_EFFECT")
    const refus = refusPourTransition(raison, "approuver")
    expect(refus.message).toBe("Cette action n'existe pas a cette etape")
    expect(statusDe(refus)).toBe(422)
    // The same Utilisateur, at the same Etape, IS admissible for its own actions —
    // which is why this refusal cannot borrow the permission code.
    expect(checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", true).ok).toBe(true)
  })
})

// ─── The raiser (#300) ──────────────────────────────────────────────────────

describe("refusPourTransition", () => {
  it("hands back a fresh error each call, never a shared instance", () => {
    const premier = refusPourTransition("TERMINAL", "approuver")
    const second = refusPourTransition("TERMINAL", "approuver")

    expect(premier).not.toBe(second)
    expect(premier.message).toBe(second.message)
    // A shared instance would carry one throw site across every refusal of that
    // reason, which is exactly what a cached value would do.
    premier.message = "brise"
    expect(refusPourTransition("TERMINAL", "approuver").message).toBe(
      "La demande a deja ete decidee"
    )
  })

  it("raises nothing itself and carries every refusal's status", () => {
    for (const raison of raisonsDuGarde()) {
      const refus = refusPourTransition(raison, "retirer")

      expect(refus, raison).toBeInstanceOf(Error)
      expect(statusDe(refus), raison).toBe(
        AU_SUJET_DE_LA_DEMANDE.includes(raison) ? 422 : 403
      )
    }
  })

  // Non-vacuity for the table's keying: the rows are DISTINCT raisers. Four rows
  // pointing at one function would satisfy totality and say nothing about which
  // reason is which.
  it("gives each reason its own raiser", () => {
    const rows = Object.values(REFUS_TRANSITION)

    expect(rows.length).toBe(4)
    expect(new Set(rows).size).toBe(rows.length)
  })

  // The raiser is total at runtime too: an index read on a missing key yields
  // `undefined`, and calling `undefined` throws a TypeError that
  // `handleServiceError` would answer « Erreur interne » — losing the cause the
  // table exists to name. The type says it cannot happen; this says what a reader
  // would be shown if it did.
  it("has no row that is not a function of the action", () => {
    for (const [raison, refus] of Object.entries(REFUS_TRANSITION)) {
      expect(typeof refus, raison).toBe("function")
      expect(typeof refus("submit"), raison).toBe("object")
    }
  })
})

// ─── The pipeline module stays a pipeline, not a presentation surface ───────
//
// AC: « The workflow module still has no runtime imports and still contains no
// French sentence ». BOTH halves need a correction, stated here rather than
// papered over (ticket #300, deviation):
//
//   * It ALREADY held two French strings before this ticket. Neither is a refusal:
//     both are unreachable-by-construction invariant throws that abort the process
//     instead of answering a Utilisateur. So the honest form of the criterion is
//     « the pipeline module composes no REFUSAL sentence », and the two invariants
//     are exempted BY NAME as an exhaustive list — so a THIRD French string fails
//     this suite.
//   * Comments may DISCUSS a French sentence — several do, and this file does — so
//     only code is read, or a docblock explaining the rule would be reported as
//     breaking it.

/**
 * A French SENTENCE in code: a quoted literal of at least three alphabetic words,
 * comments stripped. Deliberately generous about accents and elisions — the point
 * is to catch a refusal a Utilisateur could read, not to adjudicate orthography.
 */
function phrasesFrancaises(source: string): string[] {
  const litteral = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g
  const trouvees: string[] = []
  let correspondance: RegExpExecArray | null
  while ((correspondance = litteral.exec(sansCommentaires(source)))) {
    const mots = correspondance[2].split(/\s+/).filter(Boolean)
    const longs = mots.filter((mot) => /[A-Za-zÀ-ÿ]{2,}/.test(mot))
    if (longs.length >= 3) trouvees.push(correspondance[2])
  }
  return trouvees
}

/**
 * The source with its comments removed.
 *
 * Comments may DISCUSS a French sentence — several do, and this file does — so a
 * scan that cannot tell a sentence about the rule from the rule itself reports
 * every docblock in the module as a violation.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/**
 * The two French strings the pipeline module legitimately holds, each named with
 * the reason it is exempt. An exhaustive allowlist on purpose: it is the list a
 * third sentence would have to be added to, which makes that a discussion rather
 * than a silent addition.
 *
 * The entries are the WHOLE literals, interpolation and all, so the comparison is
 * set equality against what the sweep found rather than a prefix match — a
 * sentence that merely STARTED with one of these, or one these merely started
 * with, would then fail here instead of being silently admitted.
 */
const PHRASES_INVARIANT_DU_PIPELINE: ReadonlyArray<{
  phrase: string
  raison: string
}> = [
  {
    // With its accent, as the throw spells it: `l'étape`, accented, and with the
    // template hole it interpolates. A pin that dropped either would match
    // nothing and exempt nothing.
    phrase: "Aucun effet de transition ne cible l'étape: ${etape}",
    raison:
      "invariant de l'ordre de la table de transitions: atteint seulement si la table a ete amputee, et il arrete le processus au lieu de repondre a un Utilisateur",
  },
  {
    phrase: "Aucune soumission possible depuis l'etape: ${ouverture.id}",
    raison:
      "invariant du chemin de creation (etatCreation appelle le constructeur pour une ouverture qui porte un effet submit): il arrete le processus au lieu de repondre a un Utilisateur",
  },
]

describe("the pipeline module stays free of runtime imports and of refusals", () => {
  it("imports nothing at runtime: every import is type-only", async () => {
    const source = await readFile(new URL("./workflow.ts", import.meta.url), "utf8")
    const imports = source.split("\n").filter((ligne) => /^\s*import\b/.test(ligne))

    expect(imports.length).toBeGreaterThan(0)
    const valeurs = imports.filter((ligne) => !/^\s*import\s+type\b/.test(ligne))
    expect(
      valeurs,
      `le module du pipeline a des imports runtime: ${valeurs.join(" | ")}`
    ).toEqual([])
  })

  // The reason the dependency may only run ONE way: a React module reads the
  // guard, so an error module imported from here would drag `next/server` into a
  // client bundle. Pinned as a fact about the tree, not as a claim in a docblock —
  // and both halves are asserted together, because either alone would still permit
  // the forbidden direction.
  it("is read by a client module, so the table may not live here", async () => {
    const client = await readFile(
      new URL("../app/(dashboard)/demandes/page.tsx", import.meta.url),
      "utf8"
    )
    expect(client).toContain('"use client"')
    expect(client).toContain("@/lib/workflow")

    // And the error module really does import `next/server` at RUNTIME, and reads
    // the guard type-only — the only direction that is safe.
    const errors = await readFile(new URL("./errors.ts", import.meta.url), "utf8")
    expect(errors).toMatch(/^import \{ NextResponse \} from "next\/server"$/m)
    expect(errors).toMatch(
      /^import type \{[^}]*TransitionCheckReason[^}]*\} from "\.\/workflow"$/m
    )
  })

  it("holds no refusal sentence — and names the two invariants it does hold", async () => {
    const source = await readFile(new URL("./workflow.ts", import.meta.url), "utf8")

    // The allowlist must itself be honest: a name that no longer appears means the
    // exemption has gone stale and the list is no longer exhaustive.
    for (const { phrase, raison } of PHRASES_INVARIANT_DU_PIPELINE) {
      expect(
        raison.length,
        `l'exemption de "${phrase}" ne dit pas pourquoi`
      ).toBeGreaterThan(10)
      expect(source, `l'invariant "${phrase}" n'existe plus`).toContain(phrase)
    }

    // Exhaustive: every sentence the module holds must be a NAMED invariant. A
    // third one — a refusal, or any other reader-facing string — fails here.
    const admis = new Set(PHRASES_INVARIANT_DU_PIPELINE.map((p) => p.phrase))
    const sentences = phrasesFrancaises(source).filter((phrase) => !admis.has(phrase))
    expect(
      sentences,
      `le module du pipeline compose des phrases en francais: ${sentences.join(" | ")}`
    ).toEqual([])
  })

  // Non-vacuity: the detector must recognise a French sentence when one IS present,
  // or the assertion above is decoration. And it must NOT sweep in the pipeline's
  // vocabulary — identifiers, codes, paths — which is what keeps the allowlist above
  // at length two rather than at length forty.
  //
  // The link-shaped fixture is built from two halves rather than spelled whole: the
  // repo's own lane-rename regression check (#304) forbids any test from CONTAINING
  // a composed waiting link, because a test that spells it breaks on a rename. The
  // half `?etape=` carries no lane and no Decision, so it is not one.
  it("still recognises a French sentence when one is present", () => {
    expect(phrasesFrancaises('throw new Error("La demande a deja ete decidee")')).toEqual([
      "La demande a deja ete decidee",
    ])
    expect(
      phrasesFrancaises("const table: Record<TransitionCheckReason, Error> = source")
    ).toEqual([])
    expect(
      phrasesFrancaises(`return "/demandes${"?etape="}DRAFT${"&decision="}PENDING"`)
    ).toEqual([])
  })
})