# Immutable object and array state updates

Use this reference when adding or changing object/array state updates, including nested updates, sorting, and removal. The examples are illustrative React **19.3.0** contracts for both apps; they do not establish a new persistence policy.

## Replace every changed object/array path

React state is a snapshot. A new outer array does not make mutation of an existing nested object safe. Keep updater functions pure, including when React invokes them again during development. [Object updates](https://react.dev/learn/updating-objects-in-state), [array updates](https://react.dev/learn/updating-arrays-in-state)

Both alternatives use this illustrative shape; combine it with one alternative at a time:

```ts
type Card = {
  id: string;
  settings: { pinned: boolean };
};
```

**Incorrect:** copying the array still mutates the previous state's `settings` object.

```ts
export function togglePinned(cards: Card[], targetId: string): Card[] {
  const next = [...cards];
  const card = next.find((item) => item.id === targetId);
  if (card) card.settings.pinned = !card.settings.pinned;
  return next;
}
```

**Preferred:** copy the array and changed paths, retaining untouched card references.

```ts
export function togglePinned(cards: readonly Card[], targetId: string): Card[] {
  return cards.map((card) =>
    card.id === targetId
      ? { ...card, settings: { ...card.settings, pinned: !card.settings.pinned } }
      : card,
  );
}
```

Apply it as `setCards((previous) => togglePinned(previous, targetId))`. Do not perform persistence or notifications inside that updater. For additions/removals, return a new array with spread/`filter`; copy before `sort` or `reverse`. For an object state update, preserve other fields and copy each changed nested path. Do not use `push`, `splice`, direct field assignment, or mutation followed by `setState(theSameReference)` on published state. Mutation of a newly created, unshared local object before publishing it is a different case; it does not require cloning everything. Zustand Set/Map updates have their own [reference](../../state-management/references/zustand-updates.md).

## Immutability under the current compiler configuration

Preserve immutability regardless of performance work. Both apps' `tsconfig.app.json` files use the ES2022 library definitions; `[...items].sort(compare)` can sort without mutating the original array under the current configuration. Do not raise the browser support baseline or TypeScript `lib` merely to adopt `toSorted()`. [TypeScript lib](https://www.typescriptlang.org/tsconfig/lib.html)

## Observable checks

- Run an update on a frozen old snapshot: the old array and nested objects remain unchanged, changed paths receive new references, and untouched items retain theirs.
