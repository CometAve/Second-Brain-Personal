# State type modeling

## When to use and version evidence

Use this reference when a Hook initializer infers the wrong type, when later state values need an explicit contract, or when a status determines required data. Both apps use TypeScript 6.0.3 and React / `@types/react` 19.3.0 with `strict`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Checked on 2026-09-25 against both manifests, lockfiles, application tsconfigs, and installed declarations. These examples use ES2022-compatible APIs and add no library.

Component declaration style and mode-dependent props have a separate [component type contract](component-type-contracts.md). For data arriving from an HTTP, URL, or storage boundary, follow [external data validation](external-data.md); for extension messages, use the existing [message guards](extension-message-guards.md). Static types are not runtime validation.

## State types must describe future values

Infer straightforward state such as `useState(false)` or `useState(0)`. Supply a type when the initial value does not describe later valid states: an empty array, `null`, or a restricted set of status strings. Do not fix the inference by lying about the initial value with `{} as Note`, `null!`, `any`, or a double assertion.

For standalone typechecking, prepend the following shared `Note` declaration to each subsequent code block in this document and check each combination as a separate module. The two Hook alternatives are `.tsx` modules and each imports `useState`; do not concatenate those alternatives into one module. The state-interface and union alternatives are `.ts` modules. These illustrative contracts do not replace the application's existing note or save protocols:

```ts
export interface Note {
  id: number;
  title: string;
}
```

**Avoid** — these initial values infer contracts that are too narrow or too broad:

```tsx
import { useState } from 'react';

export function useImplicitNoteState() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle');
  const [fixedStatus, setFixedStatus] = useState('idle' as const);
  return { notes, setNotes, selected, setSelected, status, setStatus, fixedStatus, setFixedStatus };
}
```

Under the current strict configuration, the array is `never[]` and the selection is `null`; neither accepts a `Note` later. The unannotated status is `string`, so misspelled statuses are accepted. The const-asserted status is only `'idle'`, so it cannot transition to `'saving'`. These are different problems; adding `as const` everywhere does not solve state typing.

**Prefer** — describe valid transitions while preserving genuine absence:

```tsx
import { useState } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useNoteState() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  return { notes, setNotes, selected, setSelected, status, setStatus };
}
```

Check `selected` before reading its fields. Preserve `null` when no note is selected; do not fabricate a note merely to satisfy an annotation. An empty array is a valid state only when the flow really means an empty list; a request failure remains distinct from a successful empty response. `satisfies` checks an initializer's assignability but does not by itself declare every future state the Hook should accept. For example, an initializer matching one union branch still needs `useState<TheUnion>(initial)` when transitions must reach other branches.

Sources: [React Hook types](https://react.dev/learn/typescript#usestate), [null and undefined](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#null-and-undefined).

## State unions: represent valid combinations

Use a discriminated union when a mode or status determines which values must be present. Independent optional fields allow impossible combinations; separate booleans can also disagree. Do not convert every group of booleans into one union: independent dimensions may legitimately coexist.

**Avoid** — `'saved'` does not require a note, and an error can appear in any status:

```ts
export interface LooseSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  note?: Note;
  error?: Error;
}
```

**Prefer** — make required fields available after narrowing and check meaningful branch coverage:

```ts
export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; note: Note }
  | { status: 'error'; error: Error };

export function saveStatusText(state: SaveState) {
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'saving':
      return 'Saving';
    case 'saved':
      return `Saved ${state.note.title}`;
    case 'error':
      return state.error.message;
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled save state: ${String(unhandled)}`);
    }
  }
}
```

Adding a new status without handling it now causes a type error. Exhaustiveness checks operate on the declared type; they do not validate untrusted data. This example describes one save operation. It is not a replacement for TanStack Query's status model, where cached data may coexist with refetching or a refetch error.

Sources: [React state structure](https://react.dev/learn/choosing-the-state-structure#avoid-contradictions-in-state), [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions), [exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking).

## Verification

When editing documentation examples, typecheck the affected example modules with the target app's actual configuration. For application changes, check the changed state declarations and their callers; unchanged documentation examples do not need another typecheck. Select relevant cases: valid state transitions, missing payloads or unsupported values, an unhandled union branch, and empty-array, null-only, widened-string, or overly narrow literal inference. Verify acceptance or rejection according to the declared contract. These type checks do not prove request behavior, state preservation, rendering performance, or runtime input validation.
