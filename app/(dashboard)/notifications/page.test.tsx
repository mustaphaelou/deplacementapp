import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const { mockUseAuthUser, mockRefreshBell } = vi.hoisted(() => ({
  mockUseAuthUser: vi.fn(),
  mockRefreshBell: vi.fn(),
}))

vi.mock("@/lib/auth/client", () => ({
  useAuthUser: mockUseAuthUser,
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
}))

vi.mock("@/components/notification-context", () => ({
  useNotificationContext: () => ({ refreshBell: mockRefreshBell }),
}))

mockUseAuthUser.mockReturnValue({
  user: {
    id: "u-1",
    name: "Yasmine Benali",
    email: "yasmine@example.ma",
    role: "EMPLOYEE",
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  },
})

const UNREAD = {
  id: "n-1",
  titre: "Demande approuvée",
  message: "Votre demande D-2026-001 a été approuvée.",
  lu: false,
  creeLe: "2026-08-04T10:00:00",
  demandeId: "d-1",
}

const READ = { ...UNREAD, id: "n-2", titre: "Ancienne notification", lu: true }

describe("Notifications page", () => {
  it("renders the prototype header anatomy: breadcrumb, 40px title, subtitle", async () => {
    const { default: NotificationsPage } = await import("./page")
    const html = renderToStaticMarkup(<NotificationsPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    // Owned by components/page-header.tsx (the h1's md: breakpoint), pinned in
    // full at components/page-header.test.tsx.
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Notifications")
    expect(html).not.toContain('aria-label="Menu"')
    expect(html).not.toContain('data-slot="card"')
  })

  it("flattens the list: hairline dividers, no outer rounded border, no read background", async () => {
    const { NotificationList } = await import("./page")
    const html = renderToStaticMarkup(
      <NotificationList
        notifications={[UNREAD, READ]}
        marking={new Set()}
        onMarkAsRead={() => {}}
      />
    )

    // The list's OWN row separators: this page's NotificationList renders the
    // divide-y wrapper itself (notifications/page.tsx), not the header module
    // and not @/components/display. These stay because the hairline-not-a-card
    // rule is a property of this list, not of the page header.
    expect(html).toContain('class="divide-y"')
    expect(html).not.toContain("divide-y rounded-lg border")
    expect(html).not.toContain("bg-muted/40")
    // The unread/read dot tone and the title weight, from the same list.
    expect(html).toContain("bg-primary")
    expect(html).toContain("bg-muted-foreground/30")
    expect(html).toContain("font-medium text-foreground")
    expect(html).toContain("font-normal text-muted-foreground/70")
  })

  it("keeps the Eye action and Voir link per notification", async () => {
    const { NotificationList } = await import("./page")
    const html = renderToStaticMarkup(
      <NotificationList
        notifications={[UNREAD]}
        marking={new Set()}
        onMarkAsRead={() => {}}
      />
    )

    expect(html).toContain("Marquer comme lue")
    expect(html).toContain("Voir")
    expect(html).toContain(`/demandes/${UNREAD.demandeId}`)
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Notifications page — the shared page header", () => {
  it("renders the page's title", async () => {
    const { default: NotificationsPage } = await import("./page")
    const html = renderToStaticMarkup(<NotificationsPage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    expect(html).toContain(">Espace</span>")
    expect(html).toContain("non lue(s)</p>")
  })
})
