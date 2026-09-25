# State ownership and component identity

Use the relevant sections when changing editable props, initialization/reset, coordinated local transitions, list identity, component definitions, or refs. A key-only change does not require adopting a reducer. The examples are illustrative React **19.3.0** contracts. They do not establish a new application save/reset policy.

## Distinguish controlled values from independent drafts

If a parent owns a value and future prop updates must appear immediately, use that prop. `useState(prop)` only uses its initial value; adding an Effect to continually overwrite it creates competing owners and may erase edits.

**Incorrect for a controlled display:**

```tsx
import { useState } from 'react';

type TitleProps = { title: string };

export function Title({ title }: TitleProps) {
  const [localTitle] = useState(title);
  return <h2>{localTitle}</h2>;
}
```

**Preferred for the same contract:**

```tsx
type TitleProps = { title: string };

export function Title({ title }: TitleProps) {
  return <h2>{title}</h2>;
}
```

An editable draft can intentionally differ from a saved prop. For that case, make initialization, entity switching, save success/failure, cancellation, and external refresh behavior explicit. Naming an input `initialTitle` communicates initialization-only behavior. Do not overwrite a dirty draft on every refetch or invent a discard policy while refactoring. A key-based reset is appropriate only when discarding that subtree's state matches the agreed behavior. [State ownership](https://react.dev/learn/choosing-the-state-structure), [initial state](https://react.dev/reference/react/useState#parameters)

For mutually exclusive states, represent the allowed modes rather than maintain contradictory flags. Do not collapse independent flags merely to use a union. Follow [State type modeling](../../typescript-standards/references/state-type-modeling.md) for state/props unions and `useState` inference.

## Input ownership, initialization, and reset

For a native text input, `value` represents the controlled value and `defaultValue` supplies an uncontrolled initial value. For checkbox/radio selection use `checked` or `defaultChecked`. Keep the mode stable for the mounted input: do not begin with `value={undefined}` and later supply a string. A controlled editable input needs an immediate backing-value update in `onChange`; an intentional read-only control can use `readOnly`. Do not add no-op handlers to disguise an accidental read-only field. [Input contracts](https://react.dev/reference/react-dom/components/input#caveats)

A reusable control may support both modes only when that flexibility is needed. Specify who owns the current value, which callback requests a change, and what its default/initial prop means. Do not maintain a local mirror of a controlled prop. If mutually exclusive props encode this contract, follow [Component type contracts](../../typescript-standards/references/component-type-contracts.md).

Choose a pure lazy initializer when building the initial value is expensive: `useState(() => buildInitialDraft(initialDocument))` defers that calculation to initialization, while `useState(buildInitialDraft(initialDocument))` evaluates it on every render. Cheap values such as `useState('')` need no wrapper. React may call initializers again in development Strict Mode, so do not persist/create records in an external system, generate nondeterministic IDs, or perform external writes there. Pure construction of initial draft objects/arrays is allowed. Later prop changes do not rerun initialization for mounted state. [Initializer behavior](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)

Define whether reset means the mount-time draft, the latest saved value, or a fresh entity. Use that agreed source explicitly; a reset must not silently switch meanings after refetch. Remounting with a key also discards other subtree state and focus. Neither a lazy initializer nor a key makes a reset policy correct by itself.

## Coordinate related local transitions when needed

Keep `useState` for straightforward updates. Consider `useReducer` when several actions must preserve a shared invariant and handlers have become hard to follow. This does not require moving state into Context/Zustand or duplicating server data from Query. Model actions as meaningful events with the necessary payload, rather than exposing an unrestricted partial-state merge. Keep validation of external data and asynchronous work in their existing boundaries. [Choosing a reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer#comparing-usestate-and-usereducer)

For an illustrative local list, removing the selected note must clear selection in the same transition. Updating the list and selection in unrelated handlers can leave a selected ID that no longer exists. This example assumes valid input state and unique note IDs; it does not establish the application's delete policy.

```ts
type LocalNote = { id: string; title: string };
type NoteListState = {
  notes: readonly LocalNote[];
  selectedId: string | null;
};
type NoteListAction =
  | { type: 'noteAdded'; note: LocalNote }
  | { type: 'noteRemoved'; id: string };

export function noteListReducer(state: NoteListState, action: NoteListAction): NoteListState {
  switch (action.type) {
    case 'noteAdded':
      return { notes: [...state.notes, action.note], selectedId: action.note.id };
    case 'noteRemoved':
      return {
        notes: state.notes.filter((note) => note.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
  }
}

// Call from the creation event, before dispatching; never from the reducer or render.
export function createNoteAddedAction(title: string): NoteListAction {
  return { type: 'noteAdded', note: { id: crypto.randomUUID(), title } };
}
```

The reducer returns a new snapshot without mutating the old one. Repeating it with the same state and action produces the same result, including the ID. Generating IDs inside the reducer, using `notes.length + 1`, or making requests there violates this contract. A repeated dispatch is still a second event: reducer purity does not deduplicate duplicate commands. If the real flow needs duplicate-event handling, define that separately. [Reducer purity](https://react.dev/reference/react/useReducer#parameters)

## Keep component types stable across parent renders

**Incorrect:** defining `TitleInput` in the parent creates a new component type each render. Parent updates can remount it and discard its input state/focus.

```tsx
import { useState } from 'react';

export function EditorPanel() {
  const [expanded, setExpanded] = useState(false);
  function TitleInput() {
    const [text, setText] = useState('');
    return <input aria-label="Title" value={text} onChange={(event) => setText(event.target.value)} />;
  }
  return (
    <section>
      <button type="button" onClick={() => setExpanded((value) => !value)}>Toggle</button>
      <span>{expanded ? 'Expanded' : 'Collapsed'}</span>
      <TitleInput />
    </section>
  );
}
```

**Preferred:** define the child at module scope and pass its inputs as props when needed.

```tsx
import { useState } from 'react';

function TitleInput() {
  const [text, setText] = useState('');
  return <input aria-label="Title" value={text} onChange={(event) => setText(event.target.value)} />;
}

export function EditorPanel() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section>
      <button type="button" onClick={() => setExpanded((value) => !value)}>Toggle</button>
      <span>{expanded ? 'Expanded' : 'Collapsed'}</span>
      <TitleInput />
    </section>
  );
}
```

Ordinary event handlers inside a component are not nested component definitions. A render callback returning JSX is also distinct from creating a new component type and rendering `<Child />`; follow the receiving API's contract and do not call Hooks inside such callbacks. Do not use `useCallback`, `useMemo`, or `memo` inside the parent to conceal this ownership problem. [Component identity and resets](https://react.dev/learn/preserving-and-resetting-state#different-components-at-the-same-position-reset-state)

## Keys identify records, not their current positions

For a list whose items can be inserted, deleted, filtered, or reordered, use a stable identifier from the record. With `key={index}`, React can preserve a row's local state for a different record after positions shift. Generating a random key during render instead remounts the row every time. Neither is a performance remedy. [List keys](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)

This pair assumes `id` is unique among sibling rows and remains attached to the same record. Each row has local expanded state, making incorrect identity visible:

```tsx
import { useState } from 'react';

type RowData = { id: string; title: string };
type RowsProps = { rows: readonly RowData[] };
type RowProps = { row: RowData };

function Row({ row }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setExpanded((value) => !value)}>{row.title}</button>
      {expanded && <p>Details for {row.id}</p>}
    </li>
  );
}

export function IncorrectRows({ rows }: RowsProps) {
  return <ul>{rows.map((row, index) => <Row key={index} row={row} />)}</ul>;
}

export function Rows({ rows }: RowsProps) {
  return <ul>{rows.map((row) => <Row key={row.id} row={row} />)}</ul>;
}
```

For newly created local records, assign the ID when creating the record and retain it. Do not generate it in `map` or use [`useId`](https://react.dev/reference/react/useId) as a list-key source. An index is defensible only for genuinely fixed, non-reordered positions with no changing record identity; document that invariant when applicable. Do not invoke this exception for editable or filterable project data. Prefer explicit stable keys for fixed placeholders when suitable identifiers exist; do not disable the current index-key lint rule merely to use this exception. `key` is not passed as a normal prop, so pass the ID separately if the child needs it.

## URL-owned state and navigation history

Use this section when changing the frontend's route parameters, URL-controlled panels, filters, or navigation history. The frontend directly uses TanStack Router **1.170.39**; the extension does not. For parsing and validation, keep the [external URL contract](../../typescript-standards/references/external-data.md#defaults-coercion-and-url-contracts).

- Read URL-owned state from the route's validated search/params and update it through the existing Router API. Do not mirror it into a second authoritative component/store state or use Effects to keep both copies synchronized. A temporary typing draft or retained closing-animation snapshot can be separate when its commit/reset/lifetime contract is explicit; it must not override a later navigation.
- Choose URL ownership when refresh, direct entry, sharing, or Back/Forward should recover that state. Keep hover, focus, transient pending state, and unsaved note content with their existing owners. Do not add credentials or private document bodies to search params, or move every UI toggle into the URL.
- Decide which existing search fields remain meaningful when navigating. A literal `search` object is not an automatic merge. Use the Router's functional search update to retain applicable fields and explicitly remove/reset incompatible fields; blindly spreading all previous fields is also incorrect when their meaning changes. Preserve parent-route search contracts where applicable.
- Choose history behavior from the expected Back action. `replace: false` (the default) creates an entry; `replace: true` replaces the current entry. A deliberate destination change may deserve its own entry; correction of the current location or an explicitly agreed live-filter update may use replacement. Do not globally replace all navigation or add an entry for every keystroke by habit.
- Closing a URL-controlled panel must work after direct entry as well as after opening it inside the app. Do not assume `history.back()` always points to the intended underlying screen. Preserve the agreed close/history behavior, [draft-save policy](../../state-management/references/save-lifecycle.md), and focus contract before navigation.

| Decision example | Preserve the intended behavior |
| --- | --- |
| Open a panel while an independent validated filter remains applicable | Retain that filter intentionally; replacing search with only the panel ID would drop it unless a configured middleware retains it. |
| Change a filter that makes the current page number invalid | Reset the page deliberately; retaining every previous parameter is not automatically correct. |
| A temporary input draft commits a filter to the URL | Keep editing local until commit, then use the validated URL value as the applied filter. Back/Forward must not be overwritten by a stale draft synchronization Effect. |
| Close a panel opened from a bookmark | Navigate to the intended in-app state without assuming a previous in-app history entry exists. Choose push/replace according to the agreed return behavior. |

These examples express conditional decisions, not new project routes or a change to existing close policies. The current [MainPage](../../../../frontend/secondbrain/src/features/main/pages/MainPage.tsx) reads `Route.useSearch()` and navigates with search objects; its callers and [route schema](../../../../frontend/secondbrain/src/routes/main.tsx) are the integration points to inspect.

For a changed flow, verify direct URL entry, reload, Back/Forward, invalid/omitted params, preservation or intentional removal of other applicable fields, and close with pending edits. Route types and a successful `navigate()` call do not prove that the visible state, focus, and stored draft match the intended behavior.

Checked on 2026-09-25 against the manifest/lockfile, installed `@tanstack/react-router` **1.170.39** public exports, resolved `@tanstack/router-core` **1.171.32** `link.ts`/`router.ts`, and TypeScript **6.0.3**. The frontend's existing Router registration provides its typed navigation contract; do not edit generated route output or bypass it with casts. Sources: [TanStack search parameters](https://tanstack.com/router/latest/docs/guide/search-params), [NavigateOptions and replace](https://tanstack.com/router/latest/docs/api/router/NavigateOptionsType#replace).

## Refs do not own visible state

Use state for values whose changes must update JSX. Use refs for imperative handles, timer IDs, or bookkeeping that does not itself affect rendering. Updating `ref.current` does not request a render, so storing a visible selected count only in a ref leaves the screen stale. Avoid reading/writing refs during render except React's documented predictable initialization pattern. Do not hide reactive dependencies in refs or treat an `isMounted` ref as a request-generation policy. [useRef](https://react.dev/reference/react/useRef)

## Observable checks

- Update the parent prop: a controlled display follows it; a draft follows its explicit dirty/reset policy.
- For controlled inputs, test an initially empty value and later updates without switching ownership. For drafts, distinguish entity switching from refreshing the same entity.
- For a reducer, exercise the relevant transition sequences with frozen previous snapshots; remove a selected item and an unselected item, and confirm the selection invariant and absence of mutation.
- Type into the child and rerender the parent: text and focus persist unless a deliberate reset applies.
- Expand a row and delete/reorder another row: expanded state stays with the same record.
- Change a value displayed in JSX: the screen updates without relying on an unrelated rerender to reveal a ref mutation.
