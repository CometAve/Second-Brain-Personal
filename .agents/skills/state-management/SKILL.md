---
name: state-management
description: Apply when changing Second Brain state ownership, saves, session data, Context, Zustand, frontend TanStack Query, or extension storage and worker lifecycles. Preserve each app's existing architecture.
---

# Second Brain State Management

Verified on 2026-09-25: both packages use Zustand **5.0.15**; only `frontend/secondbrain` directly uses TanStack Query **5.103.2**. Use the target package's manifest and lockfile as the version baseline for changes.

## State ownership and package boundaries

When extracting a feature workflow across components, Hooks, store actions, or services, read [UI and business logic boundaries](../react-patterns/references/ui-and-business-logic.md). Extraction must preserve existing draft, cache, and operation ownership.

- Keep temporary screen state in its component or nearest common parent. Sibling sharing or persistence across reloads does not by itself require a global store.
- For frontend route/search state, URL-controlled panels, or Back/Forward behavior, read [URL ownership and history](../react-patterns/references/state-and-identity.md#url-owned-state-and-navigation-history). Preserve intentional editing drafts and select parameter retention and push/replace behavior explicitly.
- Derive values from their owner instead of mirroring props or Query data into another state by default. An intentional editing draft needs explicit initialization, save/cancel, and target-change behavior. For copied props, draft/reset policies, keys, or state versus refs, read [React state and identity](../react-patterns/references/state-and-identity.md). For immutable object/array update logic, read [Immutable state updates](../react-patterns/references/immutable-state-updates.md).
- For autosave, debounced writes, draft promotion, or save/delete/close coordination, read [Save lifecycles](references/save-lifecycle.md). Preserve the agreed retention/discard policy and distinguish scheduling, dispatch, and acknowledgement.
- Model genuinely exclusive local states or mode-dependent props without impossible combinations; preserve legitimate independent dimensions and Query background-refetch states. For state payload contracts and `useState` inference, read [State type modeling](../typescript-standards/references/state-type-modeling.md); for mode-dependent props, read [Component type contracts](../typescript-standards/references/component-type-contracts.md).
- Follow the existing Zustand patterns for shared UI state. Context remains suitable for scoped dependency injection or state sharing. For Provider scope, required versus fallback values, or consumer updates, read [Context boundaries](references/context-boundaries.md). Do not introduce Jotai for ordinary state changes.
- For new frontend server caches, follow the existing TanStack Query hooks and query keys. Before changing authentication or reminder flows, trace updates and resets in both `authStore.user` and the Query cache: these flows currently synchronize both. For login/logout, account switching, private caches, or authentication recovery, read [Session data boundaries](references/session-data-boundaries.md).
- The extension uses Zustand, service calls, and browser storage. Installing TanStack Query or replacing its search cache is an architectural change; do it only when included in the current request.

## Zustand 5 selectors and updates

- Subscribe to the values a component reads. Hooks created with `create` do not accept the second equality argument shown in older v4 examples.
- When a selector returns a new object or array, use `useShallow` to retain the previous result when its members are shallowly equal, or split the selection. A scalar selector does not need this wrapper by default.
- Replace `Set` and `Map` instances when updating them, as with immutable array and object updates. This applies to the selection sets in `searchPanelStore`.
- Preserve the frontend's current in-memory token storage boundary. Do not copy a generic `persist` example that moves authentication tokens into storage.
- Extension store instances belong to separate execution contexts. Follow the existing messaging and storage paths when sharing data between the background, content scripts, and sidepanel. When several contexts can update the same stored value, read [Storage concurrency](references/extension-storage-concurrency.md).
- When changing background event registration, delayed tasks, or operations that may outlive a worker instance, read [Extension worker lifecycles](references/extension-worker-lifecycle.md). A React cleanup rule does not establish worker restart/recovery behavior.

For object/array selectors or collection updates, read [selector and Set examples](references/zustand-updates.md). Scalar selections need no additional reference.

For frontend queries, keys, cache defaults, or loading states, read [query and cache behavior](references/tanstack-query.md#existing-cache-policy-and-query-behavior). For mutation callback contracts, start with [mutation cache changes](references/tanstack-query.md#when-a-mutation-changes-cached-data); additionally read [pending through revalidation](references/tanstack-query.md#when-pending-must-include-cache-revalidation) when completion includes refresh, or [overlapping optimistic writes](references/tanstack-query.md#when-optimistic-writes-can-overlap) when writes may compete. Read only the relevant sections and their version evidence. Check the changed flow's loading, error, empty-result, and retry behavior, plus late responses or rollback when relevant. Claim performance improvements only when measured.

When the requested frontend flow uses Suspense for Query data, read [Suspense query contracts](references/tanstack-query.md#when-a-frontend-query-uses-suspense). Suspense is an optional rendering contract, not the default migration for existing queries.

## Version evidence

- [Zustand 5.0.15 `create` / `useStore` source](https://github.com/pmndrs/zustand/blob/v5.0.15/src/react.ts)
- [Zustand 5.0.15 `useShallow` source](https://github.com/pmndrs/zustand/blob/v5.0.15/src/react/shallow.ts)
- Cross-checked against each package's installed `node_modules/zustand/react.d.ts` and `react/shallow.d.ts`.
