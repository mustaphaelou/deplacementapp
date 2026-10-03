/**
 * What the best-effort entry reports when one of its writes fails, and the
 * channel it reports on.
 *
 * The two entry points promise different things on failure, and the difference
 * is the reason this file exists. `dispatchRows` propagates the failure so the
 * caller's transaction undoes the whole write; `dispatch` absorbs it, because a
 * read receipt the caller has already recorded must not be undone by a mail
 * server that is down. Absorbing is only honest if the failure is REPORTED —
 * a failure nobody can see is the same as no report at all, which is what
 * returning a tally nobody read used to amount to.
 *
 * The module cannot call `handleServiceError` itself: that function returns a
 * `NextResponse`, and a lib module with no request has nowhere to return one
 * to. What it CAN do is speak the language that handler answers in — an error
 * carrying a numeric `status` and a message, which is the whole of what
 * `handleServiceError` reads (ADR 0002). So the report carries
 * {@link NotificationWriteError}: a failure a route's existing handler already
 * knows how to answer, delivered on a channel the caller names and can observe,
 * rather than on an HTTP response nobody asked for.
 *
 * The reporter is a collaborator rather than a `console.error` at the call
 * site, for the same reason the handle is a parameter and not constructor
 * state: a caller that wants a different one must be able to hand it over. The
 * default is what production uses, and it logs.
 */

export class NotificationWriteError extends Error {
  /**
   * A Notification write that did not happen is a server-side failure.
   *
   * The status is load-bearing rather than decorative: it is the only thing
   * `handleServiceError` reads besides the message. An error without one is an
   * unknown error to that handler, and it answers « Erreur interne » — the
   * refusal stops naming its cause. See ADR 0022.
   */
  readonly status = 500

  /** The Utilisateur whose Notification did not get written. */
  readonly utilisateurId: string

  constructor(utilisateurId: string, cause: unknown) {
    super(
      `Notification write failed for Utilisateur ${utilisateurId}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    )
    this.name = "NotificationWriteError"
    this.utilisateurId = utilisateurId
    this.cause = cause
  }
}

/**
 * Where a failed write goes. The default logs; a caller — or a test — that
 * wants the report somewhere else hands its own function in.
 */
export type NotificationFailureReporter = (
  failure: NotificationWriteError
) => void

/**
 * The default report: the same console the domain error handler falls back to
 * for an error it cannot name.
 */
export const reportNotificationFailure: NotificationFailureReporter = (
  failure
) => {
  console.error("[Notification]", failure.message, failure.cause)
}