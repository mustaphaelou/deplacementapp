/**
 * The channel the best-effort entry reports on.
 *
 * The two entry points promise different things on failure, and the difference
 * is the reason this file exists. `dispatchRows` propagates the failure so the
 * caller's transaction undoes the whole write; `dispatch` absorbs it, because a
 * read receipt the caller has already recorded must not be undone by a mail
 * server that is down. Absorbing is only honest if the failure is REPORTED — a
 * failure nobody can see is the same as no report at all, which is what
 * returning a tally nobody read used to amount to.
 *
 * The module cannot call `handleServiceError` itself: that function returns a
 * `NextResponse`, and a lib module with no request has nowhere to return one
 * to. What it CAN do is speak the language that handler answers in — an error
 * carrying a numeric `status` and a message, which is the whole of what
 * `handleServiceError` reads (ADR 0002).
 *
 * Those errors are DECLARED in `lib/errors.ts`, because ADR-0002 consolidates
 * domain error classes there and these are domain errors by that ADR's own
 * definition. They are re-exported here because this file is the module's seam:
 * a caller reaching for the reporter has no reason to know which file declares
 * the type it is handed.
 */

import { NotificationMailError, NotificationWriteError } from "../errors"

export { NotificationMailError, NotificationWriteError }

/**
 * Where a failed write goes. The default logs; a caller — or a test — that
 * wants the report somewhere else hands its own function in.
 */
export type NotificationFailureReporter = (
  failure: NotificationWriteError | NotificationMailError
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