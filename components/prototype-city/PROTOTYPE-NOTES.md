# Prototype: Destination field UX variations

## Question

What UX variations improve the destination city picker for DemandeDeplacement?

## How to run (prototype only)

```bash
npm run dev
```

Navigate to `/demandes/nouvelle`.

## Variants tested

| Key | Name | Description |
|-----|------|-------------|
| A | Toggle fallback | Combobox + "Hors Maroc" toggle that switches to free-text input |
| B | Region filter pills | Combobox with clickable region chips above the list to pre-filter |
| C | Quick-select grid | Grid of 10 popular cities + compact searchable list (mobile-friendly) |

## Verdict

### Winner

**Variant A — Toggle fallback**

### Rationale

- Simple, minimal structural change to the existing form
- The "Hors Maroc" toggle directly addresses the only real gap (non-Moroccan destinations)
- No need to rework the combobox itself — the toggle wraps it cleanly
- Region pills (B) add clutter for an edge case; quick-select grid (C) is too different from the rest of the form's UX patterns

### Folded into production

The toggle logic was integrated directly into `demande-form.tsx` wrapping the existing `<CityCombobox>`.

### Deleted

- `variant-b-filter.tsx`
- `variant-c-quickselect.tsx`
- `prototype-city-field.tsx`
- `prototype-switcher.tsx`
- `variant-a-toggle.tsx` (logic absorbed into `demande-form.tsx`)
