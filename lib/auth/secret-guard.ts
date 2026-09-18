/**
 * Startup guard for production secrets.
 *
 * Compose-level `${VAR:?}` gates (compose.prod.yml) refuse to start when a
 * secret is unset, but they cannot catch a *set-but-worthless* value such as
 * the `dev-only-*` placeholders from .env.example / compose.dev.yml. This
 * module is the second layer: in production it refuses to boot when the auth
 * secret is missing, is a known dev placeholder, or is too short to be a
 * real secret.
 *
 * Enforcement is intentionally limited to `NODE_ENV === "production"` so
 * local development and the test suite keep working with throwaway values.
 * The Next.js production *build* phase (`NEXT_PHASE ===
 * "phase-production-build"`) is exempt: page-data collection imports this
 * module without serving traffic, and the built server enforces the guard on
 * real startup.
 */

/** Substring marking a value as a dev-only placeholder. Case-insensitive. */
export const DEV_ONLY_MARKER = "dev-only"

/** Minimum accepted secret length in production. */
export const MIN_SECRET_LENGTH = 32

export function isDevOnlyValue(value: string): boolean {
  return value.toLowerCase().includes(DEV_ONLY_MARKER)
}

export interface SecretGuardOptions {
  minLength?: number
  rejectDevOnly?: boolean
}

/**
 * Resolve a secret from an explicit value or the environment, refusing to
 * start in production when the result is missing, dev-only, or too short.
 * Outside production (or during the Next build phase) the value passes
 * through untouched, preserving the dev/test workflow.
 */
export function resolveSecret(
  name: string,
  explicitValue: string | undefined,
  options: SecretGuardOptions = {},
): string | undefined {
  const value = explicitValue ?? process.env[name]
  if (process.env.NODE_ENV !== "production") return value
  if (process.env.NEXT_PHASE === "phase-production-build") return value
  const minLength = options.minLength ?? MIN_SECRET_LENGTH
  const rejectDevOnly = options.rejectDevOnly ?? true
  if (!value) {
    throw new Error(
      `${name} is required in production — set it in the environment (see .env.example). Refusing to start.`,
    )
  }
  if (rejectDevOnly && isDevOnlyValue(value)) {
    throw new Error(
      `${name} uses a dev-only placeholder value in production — generate a real secret (e.g. \`openssl rand -base64 32\`). Refusing to start.`,
    )
  }
  if (value.length < minLength) {
    throw new Error(
      `${name} must be at least ${minLength} characters in production. Refusing to start.`,
    )
  }
  return value
}

/** Resolve the Better Auth secret with the production startup guard applied. */
export function resolveAuthSecret(
  explicitValue?: string,
): string | undefined {
  return resolveSecret("BETTER_AUTH_SECRET", explicitValue)
}
