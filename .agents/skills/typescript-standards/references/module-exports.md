# Module exports and imports

## Scope and project decision

Use this reference when creating a web or extension module, changing its exports/imports, or adding a lazy boundary. The project convention is **named exports from the defining module and direct imports of that module**. Avoid default exports and barrel aggregation in handwritten application code. This is a maintainability decision requested for this project, not a claim that named exports inherently produce smaller bundles.

Verified baseline on 2026-09-25: both apps use TypeScript 6.0.3 with `verbatimModuleSyntax`, React 19.3.0, and Vite 8.3.0 with Rolldown 1.2.9. Preserve each app's existing alias and import-path configuration.

## Direct named exports

The following files are illustrative modules, not additions to the application's note API.

Incorrect project convention: default-export a component or route consumers through an aggregation module.

```tsx
// src/components/NotePreview.tsx
export default function NotePreview() {
  return <p>Preview</p>;
}
```

```ts
// src/components/index.ts
export { default as NotePreview } from '@/components/NotePreview';
```

Recommended: declare the named component in its own module and import that module directly.

```tsx
// src/components/NotePreview.tsx
export type NotePreviewProps = { title: string };

export function NotePreview({ title }: NotePreviewProps) {
  return <p>{title}</p>;
}
```

```tsx
// src/screens/PreviewScreen.tsx
import { NotePreview } from '@/components/NotePreview';
import type { NotePreviewProps } from '@/components/NotePreview';

export function PreviewScreen({ title }: NotePreviewProps) {
  return <NotePreview title={title} />;
}
```

- Apply this to components, Hooks, utilities, and project-owned types. Export only symbols needed by consumers; do not export every local helper.
- A named re-export such as `export { NotePreview } from './NotePreview'` is still aggregation when used as a directory facade. Changing `export *` to named re-exports does not meet the direct-import convention.
- Avoid chains of barrel modules and imports from a feature's own barrel. Direct paths expose the dependency being introduced; still check dependency direction and cycles.
- Prefer direct `import type` for project types. Type-only imports/exports are erased from runtime output, so do not attribute runtime bundle growth to them. The direct-path convention still applies for clarity.
- An `index.tsx` that implements a route or application entry is not a barrel merely because of its filename. Preserve tool-defined entry paths.

## External packages and required export contracts

Use an external package's documented public entry point or supported public subpath, with the named or default import that its API actually exposes. For example, preserve public named imports from `lucide-react`; do not substitute private `dist/...` paths to imitate the application's direct-import convention. Inspect the installed package's `exports` and versioned API when choosing a subpath.

Keep export shapes required by tools, such as the default configuration export consumed by Vite and ESLint. Preserve generated code and verified compatibility contracts; identify the concrete consumer when retaining an exception. A preference for shorter imports is not such a contract. Do not migrate unrelated existing modules merely because this convention was introduced.

`React.lazy` expects its loader to resolve to an object with a `default` component property. Adapt a named module at an already justified lazy boundary:

```tsx
// src/screens/LazyPreviewScreen.tsx
import { lazy, Suspense } from 'react';

const LazyNotePreview = lazy(() =>
  import('@/components/NotePreview').then((module) => ({ default: module.NotePreview })),
);

export function LazyPreviewScreen() {
  return (
    <Suspense fallback={<p>Loading preview...</p>}>
      <LazyNotePreview title="Saved note" />
    </Suspense>
  );
}
```

The adapter's `default` property is a loader protocol, not a default export declaration or a barrel. Declare the lazy component outside render and use the application's error boundary for import failure. This tiny component demonstrates the export shape only; it is not evidence that splitting a small component improves performance.

## What to verify

Check defining modules and their consumers together, including dynamic imports and generated/tool entry points. Run the affected app's typecheck and lint; include its build when imports or code splitting change. Preserve CSS and other intentional module side effects.

Vite's development server can incur extra module resolution and transformation from barrels. Production tree shaking is a separate mechanism: actual output depends on usage, side effects, and bundler configuration. Do not promise a smaller bundle from an export-style change without inspecting the resulting build, or set `sideEffects: false` broadly to force the claim.

## Official evidence

- [Vite 8: avoid barrel files](https://v8.vite.dev/guide/performance#avoid-barrel-files)
- [Vite 8 configuration exports](https://v8.vite.dev/config/)
- [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [React lazy loader contract](https://react.dev/reference/react/lazy)
- [TypeScript verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- [Rolldown dead code elimination](https://rolldown.rs/in-depth/dead-code-elimination)
- [Lucide React public imports](https://lucide.dev/guide/react)
