# Correctness and lifecycle in React 19.3

Use this reference when changing components or Hooks in either Vite app. These rules concern behavior and lifecycle; they do not require a performance rewrite.

## Rendering, state, and form feedback

- Do not initiate requests, storage writes, or subscriptions during render. Put user-triggered work in event handlers and external synchronization in Effects or the existing data layer. Calculate derived values during render when practical. [Render purity](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- Treat props and state as immutable. When deriving the next state from the previous state, use an updater function; keep writes, requests, and other side effects outside the updater. For object/array updates, read [Immutable state updates](immutable-state-updates.md). For copied props, keys, nested component definitions, or refs, apply [state ownership and identity](state-and-identity.md).
- For initializer cost, controlled/uncontrolled inputs, reset semantics, or coordinated reducer transitions, use the relevant sections of [State ownership and identity](state-and-identity.md). Initializers, updaters, and reducers must remain pure.
- For numeric conditions, use a boolean expression such as `{count > 0 && ...}` or an explicit branch so that `0` is not accidentally rendered. Boolean `&&` expressions do not need a blanket conversion to ternaries.
- Associate inputs with labels and relevant error descriptions. Mark invalid inputs with `aria-invalid` and associate error text using `aria-describedby` where appropriate. Preserve entered values after failure, and make saving/success indicators reflect actual request outcomes. These requirements do not require a form library. Shared wrappers must also preserve [native element, event, and ref contracts](../../typescript-standards/references/native-element-contracts.md). [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/), [WAI feedback](https://www.w3.org/WAI/tutorials/forms/notifications/)

## Effects and asynchronous cleanup

- Select render, event handler, or synchronization ownership using [Effect decisions](effect-decisions.md). Extracting a purpose-specific Hook can clarify that ownership; wrapping an Effect in a generic mount-only Hook can conceal dependencies without reducing work.
- Include reactive values read by an Effect in its dependencies. To reduce unnecessary synchronization, first establish what should trigger it; then use the relevant primitive values or construct objects inside the Effect. Do not hide dependencies in refs or omit them just to silence lint.
- Clean up subscriptions, timers, and observers. Cancel obsolete requests or ignore their results so that responses for earlier input or a previous screen cannot overwrite current state. Handle rejection and completion paths as well. [useEffect](https://react.dev/reference/react/useEffect)

### When an Effect needs the latest value without resynchronizing

When Effect-owned logic needs current values without resynchronizing an external system, read [Effect Event boundaries](effect-event-boundaries.md) before choosing `useEffectEvent`.

### When subscribing to an external store

For `useSyncExternalStore`, verify unsubscribe behavior and the snapshot contract: snapshots are immutable, and repeated reads return the same value/reference while the store is unchanged. Do not introduce an external store or an Effect merely to synchronize a value that can be derived during render. [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore), [Deriving state and subscribing to stores](https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store)

## Code splitting and asynchronous UI

- Split heavy React UI with `React.lazy` and `Suspense` when needed. Declare lazy components outside component bodies; adapt a named module to the loader's `{ default: module.NamedComponent }` shape when necessary; keep the source module's named export. See the [module export example](../../typescript-standards/references/module-exports.md). Apply [Error boundaries and Suspense](error-boundaries-and-suspense.md) when choosing failure boundaries, fallbacks, or recovery; resetting an error boundary alone does not retry every failed resource. `next/dynamic` and SSR/hydration recipes do not apply to these Vite client apps. [lazy](https://react.dev/reference/react/lazy)
- `typeof window !== 'undefined'` checks the execution environment; it does not guarantee that a module is excluded from a bundle. Handle import failures and prevent completed work from being applied to an obsolete screen.
- `startTransition` marks state updates as non-blocking. Its callback runs immediately: it does not move computation to another thread or reduce event frequency. Keep state that controls a text input synchronous. Under the current API, wrap state updates after an `await` in another `startTransition` if they must be transitions. [startTransition](https://react.dev/reference/react/startTransition)
