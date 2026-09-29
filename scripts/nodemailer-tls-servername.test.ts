import { describe, it, expect, afterEach } from "vitest"
import { dnsCache, resolveHostname } from "nodemailer/lib/shared"
import type { ResolvedHostname } from "nodemailer/lib/shared"

/**
 * GHSA-6vj9-mwq6-2f5v / CVE-2026-100701 — nodemailer 5.0.0 … 10.0.1 kept the
 * caller's TLS `servername` inside `dnsCache`, an entry keyed by DNS host
 * alone and shared by every transport in the process. The first transport to
 * resolve a host decided the `servername` that every later transport of that
 * process was handed, overwriting the value it had configured for itself.
 *
 * For a host reached over `secure: true` that means the wrong SNI, a peer
 * certificate checked against the wrong identity, and — behind an SNI-routed
 * relay — the SMTP AUTH credentials of a later caller delivered to whichever
 * virtual host the cached name selected. `rejectUnauthorized: true` does not
 * help: the wrong name is what the certificate was validly issued for.
 *
 * This file pins the fixed behaviour. It seeds the cache exactly as a first
 * (attacker) transport would have, then asks for the same host as a second
 * (victim) transport with its own name, and asserts the answer belongs to the
 * caller. No DNS is touched: a live cache entry short-circuits resolution, so
 * the case is deterministic and needs no network.
 *
 * The seed is deliberately hostile — it carries the `servername` that 10.0.2
 * removed from `DnsCacheValue`, so the object below needs a cast to build. That
 * cast is the point: the fixed declaration no longer admits the field, and a
 * cache entry must not be able to dictate the name a connection presents
 * whatever it happens to contain.
 */

/** Unique per run: `dnsCache` is process-global and the suite shares one process. */
const HOST = "smtp-shared-relay.dns-cache-pin.test"

/**
 * A host that resolves with no network, used to drive the cache WRITE path.
 * Reusing `localhost` is deliberate — nothing else in the suite resolves SMTP
 * hosts, and it keeps the miss deterministic offline.
 */
const WRITE_HOST = "localhost"

/**
 * The entry shape a vulnerable build wrote. Cast because `DnsCacheValue` in
 * 10.0.2+ has no `servername` to assign — if a future version reintroduces the
 * field, this file stops needing the cast and `tsc` says so.
 */
type VulnerableCacheEntry = {
  value: { addresses: string[]; servername?: string }
  expires: number
}

function seedAttackerEntry() {
  const entry: VulnerableCacheEntry = {
    value: { addresses: ["203.0.113.10"], servername: "attacker.test" },
    expires: Date.now() + 5 * 60 * 1000,
  }
  dnsCache.set(HOST, entry as unknown as Parameters<typeof dnsCache.set>[1])
}

/** Runs the cache-hit path and resolves with what the transport would receive. */
function resolveWith(options: { host: string; servername?: string }) {
  return new Promise<ResolvedHostname>((resolve, reject) => {
    resolveHostname(options, (err, value) =>
      err ? reject(err) : resolve(value as ResolvedHostname)
    )
  })
}

afterEach(() => {
  // `dnsCache` outlives the test, so both hosts are cleared: leaving a seeded
  // `localhost` entry behind would hand a poisoned name to any later suite in
  // this same process.
  dnsCache.delete(HOST)
  dnsCache.delete(WRITE_HOST)
})

describe("nodemailer DNS cache does not leak one transport's TLS servername to another", () => {
  it("returns the asking transport's own servername on a cache hit", async () => {
    seedAttackerEntry()

    const result = await resolveWith({ host: HOST, servername: "victim.test" })

    expect(result.cached).toBe(true)
    expect(result.servername).toBe("victim.test")
  })

  it("keeps resolving the host even when the cached entry names another identity", async () => {
    seedAttackerEntry()

    const result = await resolveWith({ host: HOST, servername: "victim.test" })

    // A poisoned name must not cost the caller its address either — a blank
    // host is the other way this cache can strand a connection.
    expect(result.host).toBe("203.0.113.10")
  })

  it("gives two callers different names for the same host", async () => {
    seedAttackerEntry()

    const [first, second] = await Promise.all([
      resolveWith({ host: HOST, servername: "first.test" }),
      resolveWith({ host: HOST, servername: "second.test" }),
    ])

    expect(first.servername).toBe("first.test")
    expect(second.servername).toBe("second.test")
  })

  it("does not let a cached name survive into the entry a later lookup writes", async () => {
    // Drive a genuine cache MISS so nodemailer itself writes the entry. Seeding
    // one and reading it back proves nothing about the write path — a cache hit
    // never rewrites what is stored, so a seeded `servername` would sit there
    // untouched on BOTH a vulnerable and a fixed build. `localhost` resolves
    // from the host's own resolver, so this needs no network.
    dnsCache.delete(WRITE_HOST)

    await resolveWith({ host: WRITE_HOST, servername: "victim.test" })

    // The fix purges `servername` from what is stored, so the next transport to
    // reach this host is handed its own name rather than this one's.
    const stored = dnsCache.get(WRITE_HOST) as unknown as VulnerableCacheEntry | undefined
    expect(stored?.value?.addresses).toEqual(["127.0.0.1"])
    expect(stored?.value?.servername).toBeUndefined()
  })

  it("gives a later caller its own name after a fresh lookup populated the cache", async () => {
    // First caller resolves the host with no explicit name, so the entry is
    // written by the ordinary path an operator's transport takes.
    dnsCache.delete(WRITE_HOST)
    await resolveWith({ host: WRITE_HOST })

    // Second caller asks with its own name and must receive it.
    const result = await resolveWith({ host: WRITE_HOST, servername: "victim.test" })

    expect(result.cached).toBe(true)
    expect(result.servername).toBe("victim.test")
  })
})
