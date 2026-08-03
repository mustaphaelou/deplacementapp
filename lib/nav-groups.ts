import type { NavItem } from "@/lib/auth"

export const NAV_SECTIONS = {
  espace: "Espace",
  administration: "Administration",
} as const

export interface NavGroup {
  section: string
  items: NavItem[]
}

export function groupNavItems(items: NavItem[]): NavGroup[] {
  const espace: NavItem[] = []
  const administration: NavItem[] = []

  for (const item of items) {
    if (
      item.href === "/administration" ||
      item.href.startsWith("/administration/")
    ) {
      administration.push(item)
    } else {
      espace.push(item)
    }
  }

  const groups: NavGroup[] = []
  if (espace.length > 0) groups.push({ section: NAV_SECTIONS.espace, items: espace })
  if (administration.length > 0)
    groups.push({ section: NAV_SECTIONS.administration, items: administration })
  return groups
}
