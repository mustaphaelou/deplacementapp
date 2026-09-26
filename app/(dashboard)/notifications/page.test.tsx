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

    expect(html).toContain('class="divide-y"')
    expect(html).not.toContain("divide-y rounded-lg border")
    expect(html).not.toContain("bg-muted/40")
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

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Notifications page — the #258 responsive page header", () => {
  const header = async () => {
    const { default: NotificationsPage } = await import("./page")
    return renderToStaticMarkup(<NotificationsPage />)
  }

  it("scales the title 24px below md: and 40px from md: up", async () => {
    expect(await header()).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    expect(block).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
    // md: is the single shell breakpoint — no other variant may creep in.
    expect(block).not.toContain("sm:text-[")
    expect(block).not.toContain("lg:text-[")
    expect(block).not.toMatch(/(?:sm|lg):size-\d/)
  })

  it("truncates the breadcrumb to one line instead of wrapping it", async () => {
    const html = await header()
    const crumbs = html.slice(
      html.indexOf('aria-label="breadcrumb"'),
      html.indexOf('<div class="mt-6 flex items-center gap-4">')
    )

    // flex-nowrap on the list — twMerge drops the primitive's flex-wrap, so
    // `flex-nowrap` lands last and `flex-wrap` is gone from the output.
    expect(crumbs).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(crumbs).not.toContain("flex-wrap")
    // min-w-0 on the nav and the last item: a flex item's default min-width:auto
    // refuses to shrink below its content, so without these the ellipsis can
    // never engage.
    expect(crumbs).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(crumbs).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
    // truncate on the page itself, which is what renders the ellipsis.
    expect(crumbs).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("keeps the desktop anatomy byte-identical: mt-6 rhythm and the icon", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
  })
})
