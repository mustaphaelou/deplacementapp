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
