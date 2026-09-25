# Component composition contracts

Read this reference when a component API needs caller-provided content, cooperating parts, or injected behavior. It applies to React **19.3.0** in both Vite apps. Use the simplest contract that expresses the actual responsibility; these patterns are options, not a checklist for every component.

## Choose what the caller controls

| Requirement | Appropriate starting point | Avoid |
| --- | --- | --- |
| A visual wrapper places caller-owned content | `children` or named `ReactNode` props | Inspecting arbitrary child types or extracting hidden props from them. |
| A collection needs metadata and stable identity | An explicit array of records | Inferring records from the JSX emitted by child components. |
| The caller customizes rendering using data owned by the receiving component | A typed render callback | Hooks inside the callback or constructing a new component type on every render. |
| Several public parts cooperate on one control | Explicit parts with shared ownership; scoped Context when necessary | A new global store or implicit parent-child coupling just to imitate a compound-component API. |

Ordinary `children` composition does not require the `Children` API. `Children` sees supplied elements, not the rendered internals of a custom child, and does not traverse fragments as ordinary nested arrays. Prefer explicit data/parts over depending on that structure. `cloneElement` can obscure data flow and override a caller's props/ref; use a documented contract when it is actually necessary. This is not a ban on a library's internal implementation. [Children alternatives](https://react.dev/reference/react/Children#alternatives), [cloneElement alternatives](https://react.dev/reference/react/cloneElement#alternatives)

## Make rendering customization explicit

For this contract, the list owns ordering and item identity while the caller owns each note's inner content. Reading an assumed `child.props.note` from arbitrary children would couple the list to unrelated components. Pass the records and render callback explicitly instead:

```tsx
import type { ReactNode } from 'react';

type NoteSummary = { id: string; title: string };
type NoteListProps = {
  notes: readonly NoteSummary[];
  renderNote: (note: NoteSummary) => ReactNode;
};

export function NoteList({ notes, renderNote }: NoteListProps) {
  return (
    <ul>
      {notes.map((note) => <li key={note.id}>{renderNote(note)}</li>)}
    </ul>
  );
}
```

Use this flexibility only if callers need it; a list with one fixed presentation can render that presentation directly. The callback returns content for an existing `li`, so callers should not add another `li` as its content. If the content needs Hooks, define a named component at module scope and return its element from the callback. For generic relationships across reusable collection APIs, follow [Component type contracts](../../typescript-standards/references/component-type-contracts.md). [Render props](https://react.dev/reference/react/Children#calling-a-render-prop-to-customize-rendering)

Passing content through `children` can avoid recreating that content during a wrapper's own state update, but it does not guarantee that descendants never render again. Their state, Context, and outer owners still matter. Preserve DOM nesting, styles, and focus while extracting a wrapper; do not move content outside its visual owner merely to reduce render counts. Evaluate performance under [Memoization decisions](memoization-decisions.md), not by the pattern's name. [React memo](https://react.dev/reference/react/memo)

## Cooperating parts and headless APIs

A compound control must define the shared value, changes, and which Provider its parts use. Prefer normal props where they remain clear; if Context is needed, follow [Context boundaries](../../state-management/references/context-boundaries.md). Expose parts as named exports from their defining files. A compound API does not require a barrel or a static `Root.Part` namespace.

Composition does not supply interaction semantics. For example, a custom Tabs control still needs the relevant keyboard, focus, role, and selected-panel behavior. Reuse an appropriate installed primitive where it meets the requirement; a clickable `div` and shared Context do not implement accessible tabs. Check [native element contracts](../../typescript-standards/references/native-element-contracts.md) and the [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

Introduce a props-getter API only for a concrete headless reuse requirement. Specify its required attributes, handler ordering, cancellation behavior, and ref composition; do not discard caller handlers by spreading props in an accidental order. Prefer an existing installed primitive to maintaining a new headless abstraction without a demonstrated need. Follow the native-contract reference for `asChild`/Slot behavior rather than assuming every getter uses the same merge policy.

## Higher-order components require a concrete integration reason

For new function-component code, first consider a focused Hook or ordinary composition. An existing library contract can justify an HOC; HOCs are not removed or universally forbidden. Separate caller props from injected props, preserve the integration's ref contract, and create the enhanced component outside render so that its component identity stays stable. Do not suppress incompatible types with broad assertions. The [historical official HOC caveat](https://legacy.reactjs.org/docs/higher-order-components.html#dont-use-hocs-inside-the-render-method) describes the identity problem; check current public types for the library actually used.

## Observable checks

- Change supplied records/content and verify ordering, identity, DOM nesting, and existing appearance.
- For render callbacks, check that caller-owned state lives in components/Hooks rather than callback bodies.
- For cooperating parts, mount independent instances and verify that state does not leak between them; exercise the intended keyboard/focus interactions.
- For an HOC integration, rerender its parent and confirm that child state/focus persists and that callers supply only their own required props.
