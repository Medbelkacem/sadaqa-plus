# Sadaqa+ brand

Source identity sheets. These are the reference; the interface is built to
match them, not the other way round.

| File | Shows |
|---|---|
| `identity-1-logo.png` | Primary lock-up, dark-ground, monochrome and Arabic variants |
| `identity-2-symbol-palette.png` | The symbol's meaning, icon sizes, and the palette with hex values |
| `identity-3-hero-dark.png` | Deep-green hero with the "+" pattern |
| `identity-4-hero-light.png` | Cream hero |
| `identity-5-install-banner.png` | Install banner on green |
| `identity-6-app-icon.png` | App icon tile and centred lock-up |

## The symbol

> Two crossing bars: the green one gives, the amber one receives. Their
> intersection is the third colour — what the meeting produces. It is also the
> "+" of Sadaqa+.

Implemented as inline SVG in `src/components/brand/logo.tsx`, so it inherits
the theme, stays crisp at any size, costs no request, and needs no CSP
exception. The intersection square is drawn explicitly rather than relying on
a blend mode, because print and email would drop the blend.

## Palette

| Name | Hex | Role in the interface |
|---|---|---|
| Vert profond | `#05372A` | Ink on light grounds; hero panel; tooltip ground |
| Vert Sadaqa | `#00795A` | Primary action, links, success, brand tile |
| Vert clair | `#3FCF9B` | Primary action **in dark mode**; accents on deep green |
| Ambre | `#E8A33D` | The "+", the invitation, the primary CTA **on dark grounds** |
| Crème | `#FBF8F2` | Page ground in light mode; type on deep green |

Wired up as design tokens in `src/app/globals.css`. Components reference the
semantic tokens (`--primary`, `--accent`, …), never the raw hex.

### One rule worth knowing

Ambre measures **2.03:1** against Crème — below the 3:1 floor a UI component
needs to show its own boundary. So:

- On **dark or deep-green grounds**, amber is a filled button. That is what the
  identity sheets show, and it is why.
- On **light grounds**, a filled amber control carries a `#B87A18` border
  (3.4:1) to supply the boundary the fill cannot. See the `accent` button
  variant.
- Amber as *text* on cream is never used at body size.

Dark mode is a separately chosen palette rather than an inversion: the ground
goes to a very deep green (`#04231B`), so the brand hues stay in the same
family and amber stays warm against it.

## Regenerating the icons

```bash
node scripts/generate-icons.mjs
```

Writes `public/icons/*` and `src/app/favicon.ico`. Output is committed, so
neither the build nor the deployment depends on an image toolchain. Run it only
when the mark changes.
