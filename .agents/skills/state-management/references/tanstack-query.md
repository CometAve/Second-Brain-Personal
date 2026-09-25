# Frontend TanStack Query 5.103.2

Applies to `frontend/secondbrain` query, mutation, and cache changes. The extension has no direct TanStack Query dependency. Paths below are relative to the frontend package. For query keys, defaults, pagination, or loading states, use the query/cache section. Read the Suspense section only when selecting or changing that rendering contract. For writes, use the mutation callback section plus the revalidation or overlap sections relevant to the interaction. A query-only change does not require the mutation examples. Use the version evidence for the API being changed.

## Existing cache policy and query behavior

- Reuse `src/lib/queryClient.ts`. Its current defaults are `staleTime: 60000`, `gcTime: 300000`, query `retry: 1`, mutation `retry: 0`, and `refetchOnWindowFocus: false`. Override them only for a feature requirement. `staleTime` controls freshness; `gcTime` controls retention of inactive cache entries.
- Use object options for `useQuery` and `useMutation`. Include inputs that affect results in the query key, preserving the existing key hierarchy. After a mutation, update or invalidate the entries it affects.
- For queries, `isPending` reflects `status === 'pending'`; it does not cover every state without data. `isLoading` is `isPending && isFetching`. A disabled query without cached data can be pending without loading, while background refetching can retain successful data. Give these states appropriate UI. Mutations use `isPending` for their pending state.
- Infinite queries require `initialPageParam`. The existing `src/features/main/hooks/useSearchNotes.ts` starts at `0` and returns `undefined` from `getNextPageParam` at the end. Consider overlapping next-page requests and refetches when changing pagination.

## When a frontend query uses Suspense

Choose this only when the feature intentionally delegates pending rendering to a Suspense fallback and thrown query errors to an error boundary. Existing `useQuery` flows remain appropriate, especially when they require conditional activation or inline pending/error states. For boundary placement, supported error sources, and recovery design, read [Error boundaries and Suspense](../../react-patterns/references/error-boundaries-and-suspense.md).

- **Activation and API:** **5.103.2** uses `useSuspenseQuery({ queryKey, queryFn })`, not positional query-function/data arguments. `enabled`, `placeholderData`, and a configurable `throwOnError` are excluded; `queryFn` cannot be `skipToken`. Keep `useQuery` when those options serve the required behavior, or mount a separate querying component only after its prerequisites exist. Do not conditionally call a Hook or discard an authentication/input guard during conversion.
- **Data and errors:** a completed Hook call exposes defined `data`; a failed request without cached data is thrown after the configured retry behavior. A background refetch failure with cached data can keep rendering that data and exposes an error. Preserve the feature's refresh-failure indication. Manually throwing a background error would replace usable content with the boundary fallback, so choose that policy deliberately rather than copying an unconditional recipe.
- **Retry and reset:** pair the relevant Query reset (`QueryErrorResetBoundary` or `useQueryErrorResetBoundary`) with the UI boundary's actual reset/remount path before retrying its children. Query's `reset()` alone marks retry permission; it does not fetch, erase cached data, or clear the UI boundary. Conversely, resetting only the UI boundary can encounter the same Query error. The project's current custom `ErrorBoundary` has no `onReset` prop: wire the contract when implementing the feature instead of pasting the official guide's `react-error-boundary` props or installing that package just for the example.
- **Scheduling and cancellation:** separate `useSuspenseQuery` calls can suspend serially. For independent queries that need parallel loading, consider `useSuspenseQueries` or appropriate prefetching; do not parallelize genuinely dependent queries. **5.103.2** documents that Suspense query cancellation does not work. A flow relying on cancellation needs an explicit compatibility decision, not an assumed drop-in replacement.

Check initial pending, failure after retries, an explicit retry, cached data during a failed refresh, and prerequisite/query-key changes. A visible retry button alone is not evidence that another request occurred or recovered.

## When a mutation changes cached data

Use optimistic cache updates only when the interaction needs them. Cancel conflicting fetches, retain the previous value, update immutably, restore on failure, and revalidate. A toggle must handle both directions; a rollback from an older overlapping mutation must not overwrite newer state.

The callback argument positions in **5.103.2** are:

| Callback | Arguments |
| --- | --- |
| `onMutate` | `variables, context` |
| `onError` | `error, variables, onMutateResult, context` |
| `onSettled` | `data, error, variables, onMutateResult, context` |

`onMutateResult` is the value returned from `onMutate`; in failure/settlement handlers it can be `undefined`. The final `context` is `MutationFunctionContext`, containing the QueryClient, mutation metadata, and optional mutation key. Older code may name the third `onError` argument `context`; that name alone is not an API error.

## When pending must include cache revalidation

Use this distinction when the interaction must remain pending through the refetch triggered by a mutation. These are `useMutation({ ... })`/`MutationOptions` callback excerpts for the existing user query, not complete replacements for authentication/reminder hooks. Do not move them into the per-call options of `mutate(variables, options)` or `mutateAsync(variables, options)`: those observer callbacks are not awaited and cannot extend the mutation's pending state.

Incorrect for that requirement: `void` discards the Promise, so mutation completion can precede revalidation.

```ts
import { queryClient } from '@/lib/queryClient';

export const revalidationOptions = {
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
  },
};
```

Return the Promise from the mutation options callback so Query awaits it:

```ts
import { queryClient } from '@/lib/queryClient';

export const revalidationOptions = {
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['user', 'me'] }),
};
```

Intentional background revalidation can use the first form if completion means the write finished and the UI exposes refresh progress/failure separately. Preserve existing `authStore` synchronization. `onSettled` runs after either success or failure; it is not a save-success signal.

By default, invalidation refetches matching active queries and does not reject for a refetch error. A matching query with `enabled: false` does not refetch through invalidation; verify that the intended user query is active and enabled. Awaiting invalidation alone therefore does not prove fresh data was obtained. Handle the query's error state; if the flow chooses `throwOnError: true`, distinguish refresh failure after a successful write from write failure before offering a retry.

## When optimistic writes can overlap

Before using a whole-value rollback, establish that another write cannot update the same cached value before rollback/revalidation completes. Disabling one button is insufficient if another component can start that write.

For example, two title edits to the same cached note can execute in this order:

| Event | Cached title with a naive snapshot rollback |
| --- | --- |
| Initial state | `Original` |
| A saves `A`, retaining `Original` | `A` |
| B saves `B`, retaining `A` | `B` |
| B succeeds | `B` |
| A fails and restores its snapshot | `Original`: B's confirmed value is lost from the cache |

When overlapping writes are required, use an operation-aware reconciliation strategy, serialize the entire conflicting optimistic lifecycle, or keep provisional state in the initiating UI and reconcile from the server. Choose according to the feature's ordering and server contract; a generic snapshot recipe is insufficient. Query's mutation `scope.id` serializes mutation functions but does not serialize the earlier `onMutate` optimistic updates in **5.103.2**.

For an established single-writer flow, the cancel/snapshot/immutable-update/rollback/revalidate pattern above remains suitable. Check failure with no prior cached value as well: `setQueryData(key, undefined)` does not remove an optimistic entry. Either avoid creating one without prior data or define explicit cleanup for the entry the operation owns.

## Version evidence and a documentation caveat

- [Official 5.103.2 release](https://github.com/TanStack/query/releases/tag/@tanstack%2Freact-query@5.103.2)
- [Official optimistic updates guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Official QueryClient reference](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient), including invalidation/refetch error behavior.
- [Official Suspense guide](https://tanstack.com/query/latest/docs/framework/react/guides/suspense) and [`useSuspenseQuery` reference](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useSuspenseQuery). Cross-checked against installed `node_modules/@tanstack/react-query/src/useSuspenseQuery.ts`, `types.ts` (`UseSuspenseQueryOptions`), `suspense.ts`, `errorBoundaryUtils.ts`, and `QueryErrorResetBoundary.tsx` in **5.103.2**; external error-boundary library examples are not project APIs.
- Installed source under `node_modules/.pnpm/@tanstack+query-core@5.103.2/node_modules/@tanstack/query-core/src/`: `types.ts` (`QueryObserverBaseResult`, `InitialPageParam`, `MutationFunctionContext`, `MutationOptions`), `mutation.ts` (`onMutate` before `retryer.start`, awaited settlement callbacks), `mutationObserver.ts` (unawaited per-call callbacks), and `queryClient.ts` (invalidation, refetch, and undefined update behavior).

The documentation's `/v5/` URL redirects to `/latest/`, so verify version-sensitive behavior against the installed package. The guide's cache section still calls the `onMutate` return value the last argument. Its examples and the **5.103.2** types place `MutationFunctionContext` after that value; use the signatures above.
