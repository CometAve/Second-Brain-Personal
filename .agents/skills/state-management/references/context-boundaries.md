# Context scope and Provider contracts

Read this when introducing or changing a Context, its Provider, or a consumer Hook. Applies to React **19.3.0** in both packages; it does not replace the existing Zustand ownership or frontend Query cache rules. Ordinary prop passing does not require a Context.

## Choose the scope and missing-Provider behavior

- Use Context for a dependency or state shared within a meaningful subtree, such as an editor scope or the extension's theme boundary. Place the Provider above its consumers and near the subtree that owns the value. A Provider returned by a component cannot supply that component's own `useContext` call.
- Decide whether the Provider is required. If it is, use a nullable Context and a consumer Hook that rejects a missing value. If a real fallback is intended, define that behavior explicitly; the `createContext` default is static and is used only when no matching Provider exists.
- Do not supply a plausible object with no-op actions merely to satisfy a type. For a required Provider, `createContext({ setTheme: () => {} })` followed by an `undefined` check cannot detect its absence: the fallback object is returned instead. A deliberate read-only fallback is a different contract and should expose that limitation.
- Pass the owner's value or operations through Context; do not copy Query data or a Zustand store into a second state owner just to provide it. Context does not synchronize the extension's separate execution contexts.

## Example: require the editor scope

These illustrative files show dependency delivery, not an additional editor store. Import each definition from its own file using the target package's configured alias. The scope owner supplies `value`; it remains responsible for updates.

`editorContext.ts`:

```ts
import { createContext } from 'react';

export interface EditorContextValue {
  noteId: string;
  readOnly: boolean;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
```

`useEditorContext.ts`:

```ts
import { useContext } from 'react';

import { EditorContext } from '@/features/editor/contexts/editorContext';

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (context === null) {
    throw new Error('useEditorContext requires EditorScope');
  }
  return context;
}
```

`EditorScope.tsx`:

```tsx
import type { ReactNode } from 'react';

import { EditorContext } from '@/features/editor/contexts/editorContext';
import type { EditorContextValue } from '@/features/editor/contexts/editorContext';

interface EditorScopeProps {
  value: EditorContextValue;
  children: ReactNode;
}

export function EditorScope({ value, children }: EditorScopeProps) {
  return <EditorContext value={value}>{children}</EditorContext>;
}
```

React 19 supports `<EditorContext value={value}>`. Existing `<EditorContext.Provider>` code remains compatible; changing syntax alone is not a reason for a migration. The example does not hide missing-Provider failures with a non-null assertion.

## Consumer updates and optimization

- Context propagation targets consumers of the changed Context; it is not a rule that every descendant subscribes. Ordinary parent rendering is a separate reason descendants may render. `memo` does not block updates from a Context the component consumes.
- React compares Provider values with `Object.is`. A newly created object or function can cause Context updates even when its contents are equivalent. Keep the value correct first; add `useMemo`/`useCallback` only when value identity contributes to an observed rendering cost, following [memoization decisions](../../react-patterns/references/memoization-decisions.md).
- Split Contexts when their responsibilities or consumer needs differ. Splitting state from actions can help measured unnecessary updates, but is not mandatory for every Provider. Do not promise that splitting or memoizing removes all parent-driven renders, or that React selects individual fields from an object passed to `useContext`.

For a changed contract, check a consumer inside the intended Provider, outside it, and under a nested override when the feature supports one. Verify that updates reach the intended consumers; claim reduced rendering only with measurements.

## Official sources and version evidence

- [React `createContext`](https://react.dev/reference/react/createContext): static fallback, Provider placement, and React 19 Provider syntax.
- [React `useContext`](https://react.dev/reference/react/useContext): nearest Provider, consumer propagation, `Object.is`, and conditional memoization.
- Cross-checked against both packages' installed `react` / `@types/react` **19.3.0**, their manifests and lockfiles, and TypeScript **6.0.3** with `strict` and `verbatimModuleSyntax`.
