# Design System

## Direction

Warm ivory/cream backgrounds, near-black text, sand/stone/warm-brown/blush support tones, and muted champagne-gold accents. Editorial serif typography leads hero and story headings; clean sans-serif typography serves navigation, prices, controls, forms, filters, checkout, and administration.

## Current prototype observations

The prototype uses Cormorant Garamond and Playfair Display for display typography, DM Sans for UI, an ivory background, organic SVG card outlines, asymmetric editorial imagery, and responsive breakpoints near 600px, 760px, 992px, and 993px.

## Implemented foundation

### Tokens

`src/styles/tokens.css` owns the current colour, typography, spacing, layout, shape, elevation, and motion tokens. The palette is grounded in repeated prototype values: ivory `#f7efe5`, near-black `#171512`, muted brown `#756b5d`, and champagne accent `#8d743d`/`#dfca9d`.

### Typography

No local font files are present. The existing prototype's Cormorant Garamond and DM Sans are loaded through `next/font/google`, which self-hosts them in the production application. Cormorant Garamond is the display face; DM Sans is the interface face. Responsive display and section sizes are tokenized with `clamp()`. `--text-hero-display` is a dedicated, centrally owned Hero scale: it preserves the prototype's two-line editorial heading in its narrower desktop column without changing the general display role.

### CSS ownership

- `globals.css`: Tailwind import, reset/base rules, document defaults, and global keyboard focus only.
- `tokens.css`: named design values only.
- `typography.css`: role-based global type classes only.
- `animations.css`: restrained fade-up utility and reduced-motion override only.
- CSS Modules: component-local visual implementation and future bespoke editorial composition.
- Tailwind v4: routine layout, spacing, grid/flex, responsive, and visibility utilities. It must not replace named editorial tokens or component modules.

### Shared primitives

`src/components/ui/` contains only reusable primitives justified by planned homepage and commerce surfaces: `Button`, `Container`, `Section`, `SectionHeading`, and `TextLink`. They use semantic native elements and tokenized states; they are not homepage sections.

### Responsive, accessibility, and motion conventions

The foundation is mobile-first: containers use fluid page gutters and a shared maximum width; type and section spacing scale with `clamp()`. New breakpoints must be added only when component layout needs a discrete change. Keyboard focus is visible globally, disabled controls communicate their state, and animations respect `prefers-reduced-motion`. Hover may refine an interaction but cannot be the sole means of use.

## Approved owner decision

Cormorant Garamond (editorial/display) and DM Sans (UI/forms/commerce) are the current approved ATHAR visual pairing. Keep the pairing unless a real technical defect or a future owner-approved brand change requires revision. Prototype imagery remains separately subject to production licensing verification.
