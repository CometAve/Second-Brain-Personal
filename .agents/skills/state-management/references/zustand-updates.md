# Zustand 5.0.15 selectors and collection updates

Use this reference when a selector constructs an object/array or an update changes a `Set`/`Map`. The API applies to both packages; the imports and field names below belong to the frontend's existing `searchPanelStore`.

## A fresh selector result needs a stable snapshot

Incorrect for a `create` hook: this produces a different object on every read, even without a store update. In Zustand 5, unstable selector results can cause an update loop.

```ts
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';

export function usePanelSelection() {
  return useSearchPanelStore((state) => ({
    mode: state.mode,
    closePanel: state.closePanel,
  }));
}
```

For these shallowly comparable members, retain the previous result when both are unchanged:

```ts
import { useShallow } from 'zustand/react/shallow';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';

export function usePanelSelection() {
  return useSearchPanelStore(
    useShallow((state) => ({ mode: state.mode, closePanel: state.closePanel })),
  );
}
```

Separate scalar selectors are also valid. Do not add `useShallow` to every selector: it compares the output shallowly, does not deeply compare nested objects, and does not repair mutated state. Hooks created with `create` have no second equality-function argument.

## Copy a selection Set before toggling it

These illustrative updater functions use the existing `selectedIds: Set<number>` shape. Use the existing store action at call sites; these functions explain an action's update logic, not a new store or public API.

Incorrect: a new wrapper object does not undo mutation of the shared Set. Previous snapshots change, and a subscriber selecting `selectedIds` sees the same reference.

```ts
export function toggleSelection(state: { selectedIds: Set<number> }, id: number) {
  const selectedIds = state.selectedIds;
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  return { selectedIds };
}
```

Copy first, then add or remove from that private copy:

```ts
export function toggleSelection(state: { selectedIds: Set<number> }, id: number) {
  const selectedIds = new Set(state.selectedIds);
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  return { selectedIds };
}
```

The previous state must keep its members, and the new Set must have a different identity when membership changes. Mutating the newly allocated, unpublished copy is valid. Apply the same principle to `Map`; copying a Map alone does not clone object values that a later update mutates.

## Evidence

- [Official Map/Set guidance](https://zustand.docs.pmnd.rs/learn/guides/maps-and-sets-usage) and [useShallow guidance](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow.html).
- Exact [5.0.15 store implementation](https://github.com/pmndrs/zustand/blob/v5.0.15/src/vanilla.ts) and [useShallow implementation](https://github.com/pmndrs/zustand/blob/v5.0.15/src/react/shallow.ts), checked against installed `zustand/vanilla.js`, `react.d.ts`, and `react/shallow.js`.
