# Color-token mappings in Tailwind 4.3.3

Use this reference when editing semantic colors or moving styles between the web app and extension. Identical variable names do not mean identical value formats. These excerpts illustrate the current `background` token; preserve the surrounding imports, dark overrides, and other tokens.

## Frontend: HSL channels need a color function

Incorrect for the frontend's existing channel-only value: the generated `background-color` receives three channels rather than a complete CSS color.

```css
:root { --background: 0 0% 100%; }
@theme inline {
  --color-background: var(--background);
}
```

Keep the frontend's wrapper:

```css
:root { --background: 0 0% 100%; }
@theme inline {
  --color-background: hsl(var(--background));
}
```

## Extension: OKLCH values are already complete colors

Incorrect for extension tokens: copying the frontend wrapper produces `hsl(oklch(...))` after substitution.

```css
:root { --background: oklch(1 0 0); }
@theme inline {
  --color-background: hsl(var(--background));
}
```

Reference the complete color directly:

```css
:root { --background: oklch(1 0 0); }
@theme inline {
  --color-background: var(--background);
}
```

These extension snippets illustrate `src/index.css` for extension-owned pages. The injected overlay stylesheet declares defaults on `:host, *` and dark overrides on `.dark, .dark *`. Descendants therefore have their own token declarations; a wrapper-level variable change does not necessarily reach them through inheritance. Check the actual selectors and cascade when changing tokens. Preserve the Shadow DOM boundary instead of replacing `:host` with `:root`, and continue to use the internal theme container and verify portal destinations rather than changing the host webpage's root.

Both formats are valid. Converting a package's color system is a separate change requiring all producers and consumers to be updated together. `@theme inline` makes the generated utility use the mapping value directly, so the runtime variable is resolved where the utility applies. Tailwind compilation alone does not validate the substituted color or prove Shadow DOM/theme behavior.

## Evidence

- [Official theme-variable guidance](https://tailwindcss.com/docs/theme#referencing-other-variables) explains `@theme inline`; [4.3.3 release](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3) identifies the pinned version.
- Mappings checked against `frontend/secondbrain/src/index.css`, `extension/src/index.css`, and `extension/src/content-scripts/overlay.css`. Examples compiled with each package's installed Tailwind **4.3.3** compiler.
