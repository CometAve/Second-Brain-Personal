---
name: tailwind-styling
description: Apply when changing Second Brain Tailwind styles, responsive layouts, themes, or CVA variants. Preserve the separate styling boundaries of the frontend and extension Shadow DOM.
---

# Second Brain Tailwind Styling

Verified on 2026-09-24: both packages use Tailwind CSS / `@tailwindcss/vite` **4.3.3**, `tailwind-merge` **3.7.0**, `class-variance-authority` **0.7.1**, and `clsx` **2.1.1**. Use the target package's manifest and lockfile as the baseline; do not reintroduce v3 configuration examples.

## Style ownership and entry points

Paths are relative to the package named in the table.

| Surface | Entry points and existing behavior |
| --- | --- |
| Frontend | `src/index.css` uses `@import 'tailwindcss' source('./')`, `@source '../index.html'`, and HSL tokens mapped through `@theme inline`. It loads `tailwindcss-animate` **1.0.7** with `@plugin` and preserves v3 palette, Preflight, and hover behavior. |
| Extension pages | `src/index.css` uses OKLCH tokens, `tw-animate-css` **1.4.0**, and a `@custom-variant` for the `.dark` selector. The sidepanel manages its theme in `src/sidepanel/SidePanelApp.tsx`. |
| Extension overlay | `src/content-scripts/overlay.css` is imported with `?inline` and injected into a Shadow DOM. It declares default tokens on `:host, *` and dark overrides on `.dark, .dark *`, and has an internal `ThemeProvider` boundary. Drag search also uses separate Shadow DOMs and CSS strings; inspect its entry point when changing that surface. |

- Use the existing Vite plugin and CSS-based `@theme`, `@source`, and `@custom-variant` setup. Do not add `@tailwind base/components/utilities` or a `tailwind.config.js` as the default solution.
- Frontend HSL channel values and extension complete OKLCH colors are different token formats. Preserve their mappings and compatibility rules when changing styles.
- A `.dark` variable declaration in frontend CSS does not establish a manual theme toggle. The extension currently overrides the `dark` variant with a selector. Treat a change of theme behavior as a feature change.
- A content script must not add `.dark` to the host webpage's `document.documentElement` for its own theme. Check the overlay's internal container and actual portal mount location. The extension-owned sidepanel document is a separate case.

When editing semantic color tokens or porting styles between packages, read [token-format examples](references/color-tokens.md). Ordinary utility-class changes do not need that reference.

## Class generation and reusable components

- Use complete class strings that Tailwind can detect. Map variants to literal classes or CVA definitions instead of constructing `bg-${color}-500`. Runtime coordinates and dimensions can use inline styles or CSS variables.
- Reuse the existing `cn` helper: frontend has `src/lib/utils.ts` and `src/lib/cn.ts`; the extension has `src/lib/utils/utils.ts`. Follow the nearby code's import path. `twMerge(clsx(...))` does not resolve every conflict involving custom CSS.
- Use CVA for recurring component variants. The **0.7.1** API is `cva(base, { variants, defaultVariants, compoundVariants })` with `VariantProps`. Simple conditions can remain simple; do not introduce beta APIs.
- Follow the extension's separate `button.tsx` / `buttonVariants.ts` structure under `src/content-scripts/overlay/components/ui/`. `@radix-ui/react-slot` **1.3.3** is a direct extension dependency. Do not add frontend Slot imports based only on a transitive installation.
- When a styled wrapper changes native props, ref forwarding, `as`/`asChild`, or interaction semantics, read [native element contracts](../typescript-standards/references/native-element-contracts.md); styling and Slot composition alone do not establish accessible behavior.
- Let each package's existing Prettier Tailwind plugin order classes. Custom CSS, `@apply`, and inline styles are valid when suitable for the feature; do not impose a separate manual ordering rule.
- Standard breakpoint variants such as `sm:` and `md:` apply from their minimum width upward. Container queries are built into v4 and need no additional plugin. Check the changed surface at narrow widths, with visible focus, and in the relevant themes and Shadow DOM boundaries.

## Official English sources and installed evidence

- [Tailwind 4.3.3 release](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3), [v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide), and [class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files) establish the version, integration, and literal-class requirements.
- [v4.3 dark mode](https://tailwindcss.com/docs/dark-mode) and [responsive design / container queries](https://tailwindcss.com/docs/responsive-design) explain selector overrides and responsive behavior. Apply them within the project's ownership boundaries above.
- [tailwind-merge 3.7.0 release](https://github.com/dcastil/tailwind-merge/releases/tag/tailwind-merge@3.7.0). The installed package README states support for Tailwind 4.0–4.3.
- [CVA 0.7.1 source](https://github.com/joe-bell/cva/blob/v0.7.1/packages/class-variance-authority/src/index.ts), cross-checked against the installed `dist/index.d.ts`.
- [tailwindcss-animate 1.0.7 source](https://github.com/jamiebuilds/tailwindcss-animate/blob/v1.0.7/index.js), [Tailwind's JavaScript plugin compatibility directive](https://tailwindcss.com/docs/functions-and-directives#plugin), and [tw-animate-css 1.4.0 release](https://github.com/Wombosvideo/tw-animate-css/releases/tag/v1.4.0). The former is a JavaScript plugin; the latter exports CSS and is loaded with `@import`.
