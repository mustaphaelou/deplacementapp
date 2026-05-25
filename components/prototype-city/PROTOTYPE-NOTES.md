# Prototype: Destination field UX variations

## Question

What UX variations improve the destination city picker for DemandeDeplacement?

## How to run

```bash
npm run dev
```

Navigate to `/demandes/nouvelle`. Use the floating bar at the bottom (or `←`/`→` arrow keys) to switch between 3 variants.

## Variants

| Key | Name | Description |
|-----|------|-------------|
| A | Toggle fallback | Combobox + "Hors Maroc" toggle that switches to free-text input |
| B | Region filter pills | Combobox with clickable region chips above the list to pre-filter |
| C | Quick-select grid | Grid of 10 popular cities + compact searchable list (mobile-friendly) |

## Verdict

<!-- Fill in after reviewing with the team -->

### Winner

[Which variant or combination was chosen]

### Rationale

[Why this variant won — concrete reasons tied to the original question]

### Action items

- [ ] Promote the winning variant to a real component
- [ ] Delete the losing variants and the switcher
- [ ] Remove PROTOTYPE-NOTES.md
