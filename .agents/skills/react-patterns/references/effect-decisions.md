# Choosing Effects, events, and custom Hooks

Read this reference before introducing an Effect, copying a value into state, or extracting Effect logic into a Hook. It applies to React **19.3.0** in both apps. Examples describe local contracts, not repository APIs.

For extracting UI, policy, or data-access responsibilities into separate functions/modules, use [UI and business logic boundaries](ui-and-business-logic.md). The table below selects execution ownership; it does not require every render-time calculation to be implemented inside the component.

## Choose the owner of the work

| Work | Default owner | Boundary to preserve |
| --- | --- | --- |
| A value calculated from current props/state | Render | Do not store a second copy solely to keep it synchronized. Consider memoization only under [memoization decisions](memoization-decisions.md). |
| Save, delete, select, or notify because the user performed an action | That action's handler and the existing mutation/service layer | Handle failure and completion there; a flag followed by an Effect obscures which interaction caused the command. |
| A connection, listener, observer, or imperative widget synchronized with current inputs | Effect or a purpose-specific Hook containing it | Declare reactive inputs and return the matching cleanup. |
| Web server data | Existing TanStack Query layer | Preserve cache, invalidation, loading, and error ownership. Do not add a second fetching Effect around Query data. |
| Extension external state | Existing service/subscription boundary | Query is not a direct dependency here. Direct requests still need ownership and [cleanup](manual-request-lifecycle.md). |

These are ownership decisions, not a ban on `useEffect` or every state update inside an Effect. External notifications may legitimately update state. A custom Hook still runs during render: starting a request in its body remains a render side effect. [Effect purpose](https://react.dev/reference/react/useEffect), [render purity](https://react.dev/reference/rules/components-and-hooks-must-be-pure)

## Derived display values: avoid a second state owner

**Incorrect for this contract:** `title` and `selectedCount` completely determine the label, but an Effect updates it only after rendering an older value.

```tsx
import { useEffect, useState } from 'react';

type SelectionLabelProps = { title: string; selectedCount: number };

export function SelectionLabel({ title, selectedCount }: SelectionLabelProps) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(`${title} (${selectedCount})`);
  }, [title, selectedCount]);
  return <output>{label}</output>;
}
```

**Preferred:** derive the value from the same render's inputs. This inexpensive calculation needs no `useMemo`.

```tsx
type SelectionLabelProps = { title: string; selectedCount: number };

export function SelectionLabel({ title, selectedCount }: SelectionLabelProps) {
  const label = `${title} (${selectedCount})`;
  return <output>{label}</output>;
}
```

Likewise, avoid Effect chains that translate `clicked → shouldSave → saving → notification`. Put the action and its state transitions in the handler/mutation lifecycle; derive display flags where possible. An actual synchronization requirement, such as reconnecting when an ID changes, still belongs in an Effect. [Unnecessary Effects and event logic](https://react.dev/learn/you-might-not-need-an-effect)

For an asynchronous save, use the existing pending/error policy and await the mutation where completion matters. Moving code to an event handler does not remove rejection handling or races, and it does not make an optimistic update a persisted save.

## Effect-owning custom Hooks must express a synchronization contract

Avoid `useMount(callback)`, `useEffectOnce(callback)`, and wrappers that accept arbitrary code but conceal its dependencies behind `[]`. Naming something a Hook does not make omitted reactive inputs safe. A Hook that encapsulates an Effect should describe its concrete purpose and own setup/cleanup for the declared inputs. State-only Hooks do not need an Effect or a synchronization lifecycle. [Focused custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks#keep-your-custom-hooks-focused-on-concrete-high-level-use-cases)

The illustrative adapter below connects one editor session and returns a cleanup that fully releases that session. Changing either input must reconnect. It performs no work during render.

```ts
import { useEffect } from 'react';

type EditorConnectionOptions = {
  documentId: string;
  connect: (documentId: string) => () => void;
};

export function useEditorConnection({ documentId, connect }: EditorConnectionOptions) {
  useEffect(() => connect(documentId), [documentId, connect]);
}
```

This Hook is useful when callers need that named contract, even with one consumer; do not extract every one-line Effect automatically. Keep the dependency logic inside the Hook. If a custom API deliberately accepts an Effect callback and dependencies, check whether Hooks lint needs `additionalEffectHooks` configuration before relying on automatic checks; do not silently change lint configuration as part of routine extraction. [Hooks lint configuration](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps#options)

Calling a custom Hook in two components does not merge their local state or Effect lifetimes. A Hook may consume a shared Context/store/cache, but that shared owner must exist independently of extraction. A calculation with no Hook behavior can remain an ordinary function. [Logic reuse versus shared state](https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself)

When only a notification needs fresh values without reconnection, use the separate [Effect Event boundary](effect-event-boundaries.md). Do not conceal a true connection input in a ref or Effect Event. Prefer creating Effect-only options/functions inside the Effect before stabilizing their identity with memoization. [Removing dependencies](https://react.dev/learn/removing-effect-dependencies)

## Review checks

- Change the display inputs: the derived label must reflect them in that render without a synchronization Effect.
- Trace a user command to one handler/mutation owner; loading and failure must reflect that operation's lifecycle.
- Change an editor ID, unmount, and exercise setup → cleanup → setup: release each old connection and retain exactly the current one.
- Check that extraction preserves dependency tracking and cleanup; fewer visible Effects in components is not evidence of less work or better performance.
