let cachedIdentity: SocieteIdentity | null = null
let warnedOnce = false

export interface SocieteIdentity {
  nomExpediteurEmail: string
  domaineEmail: string
}

export async function loadSocieteIdentity(): Promise<SocieteIdentity> {
  if (cachedIdentity) return cachedIdentity

  const { db } = await import("../db")
  const { societes } = await import("../db/schema")

  try {
    const [result] = await db.select().from(societes).limit(1)

    if (result?.nomExpediteurEmail && result?.domaineEmail) {
      cachedIdentity = {
        nomExpediteurEmail: result.nomExpediteurEmail,
        domaineEmail: result.domaineEmail,
      }
      return cachedIdentity
    }

    return getEnvFallback()
  } catch {
    if (!warnedOnce) {
      console.warn(
        "[SocieteIdentity] Database unreachable — using SMTP env fallback",
      )
      warnedOnce = true
    }
    return getEnvFallback()
  }
}

function getEnvFallback(): SocieteIdentity {
  cachedIdentity = {
    nomExpediteurEmail: process.env.SMTP_FROM_NAME ?? "Notification",
    domaineEmail: process.env.SMTP_FROM ?? "noreply@exemple.ma",
  }
  return cachedIdentity
}

export function clearCache(): void {
  cachedIdentity = null
  warnedOnce = false
}
