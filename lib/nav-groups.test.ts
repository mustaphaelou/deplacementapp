import { describe, it, expect } from "vitest"
import { groupNavItems, NAV_SECTIONS } from "@/lib/nav-groups"
import type { NavItem } from "@/lib/auth"

function item(href: string, label = href): NavItem {
  return { label, href, icon: "file-text", description: "" }
}

describe("groupNavItems", () => {
  it("splits a flat list into Espace and Administration by href prefix", () => {
    const groups = groupNavItems([
      item("/", "Tableau de bord"),
      item("/demandes", "Mes Demandes"),
      item("/administration/rapports", "Rapports"),
      item("/administration/utilisateurs", "Utilisateurs"),
    ])

    expect(groups.map((g) => g.section)).toEqual([
      NAV_SECTIONS.espace,
      NAV_SECTIONS.administration,
    ])
    expect(groups[0].items.map((i) => i.href)).toEqual(["/", "/demandes"])
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/administration/rapports",
      "/administration/utilisateurs",
    ])
  })

  it("keeps item order within each section", () => {
    const groups = groupNavItems([
      item("/demandes/rapports"),
      item("/demandes"),
      item("/administration/vehicules"),
      item("/administration/societe"),
    ])

    expect(groups[0].items.map((i) => i.href)).toEqual([
      "/demandes/rapports",
      "/demandes",
    ])
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/administration/vehicules",
      "/administration/societe",
    ])
  })

  it("omits sections with no items", () => {
    const groups = groupNavItems([item("/demandes")])
    expect(groups.map((g) => g.section)).toEqual([NAV_SECTIONS.espace])
  })

  it("matches the exact /administration href as well as prefixes", () => {
    const groups = groupNavItems([item("/administration"), item("/")])
    expect(groups[1].items.map((i) => i.href)).toEqual(["/administration"])
  })
})
