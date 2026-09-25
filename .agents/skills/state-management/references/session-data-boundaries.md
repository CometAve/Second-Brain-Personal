# Session ownership of cached data and pending work

Use when changing login/logout, account switching, authentication recovery, private caches, or requests that can outlive a session. This is a data-ownership rule, not a replacement authentication architecture. Preserve the existing token-storage boundary and agreed logout/failure behavior.

## Identify everything owned by a session

Trace the selected flow's displayed data, cache entries, pending requests, scheduled writes, authentication refresh, and completion callbacks. Changing the visible user or emptying a result list does not necessarily clear its backing cache or revoke old work.

| Owner in this project                          | Boundary to inspect                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Frontend `authStore` and Query cache           | Authenticated user data exists in both; transitions must keep their ownership consistent                         |
| Frontend shared API client                     | A delayed refresh or retried request can change tokens, replay a request, or trigger navigation                  |
| Extension store/service and module-level `Map` | Clearing displayed search results is separate from removing cached results and retiring pending searches         |
| Extension background/content script/sidepanel  | Each context has its own memory; an auth/storage notification must reach the owners that need to invalidate work |

Bind private operations to the identity/session that started them, before asynchronous token/storage lookup. If that owner changes before dispatch or retry, do not send the obsolete operation under the new account's credentials. Keep the checks in the existing request/workflow owners, rather than duplicating authentication logic in every component.

## Separate cache identity from operation lifetime

- For data whose result depends on an account, use a non-secret account/session scope in its identity or explicitly evict/replace the previous scope before reusing a shared key. Preserve the existing query-key hierarchy; choose the smallest change that makes ownership explicit.
- A new login by the same account can still be a new operation lifetime. When late completion matters, an operation/session generation distinguishes it from the retired lifetime; comparing only user ID may be insufficient.
- Do not include access or refresh tokens in query keys or cache keys. Ordinary token rotation within a valid session does not by itself require discarding all private data.
- Shared public data may remain cached. Private drafts need the agreed retain/discard/recovery policy; do not erase them through a blanket cache/storage wipe.
- A session guard is client coordination, not authorization. The server must still enforce access; guards cannot undo a request already accepted by it.

## Example: clearing the screen does not retire a search

The lifetime numbers below are illustrative coordination identities, not tokens or a required new store API.

| Event                                    | Naive result                                       | Required invariant                                                              |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Account A, lifetime 12, starts search X  | Request retains callbacks into the shared store    | X belongs to A/12                                                               |
| A logs out; account B starts lifetime 13 | The screen is emptied; the module cache remains    | Retire A/12, isolate/evict its private cache, and stop old work from publishing |
| B starts search Y                        | Y marks the current screen pending                 | Pending belongs to B/13/Y                                                       |
| X succeeds after Y starts                | A's results refill the store/cache                 | X cannot publish into B's display or cache                                      |
| X instead fails or finalizes             | A's error appears or Y loses its pending indicator | The same owner check covers error and finalization                              |

Retiring the old lifetime must take effect before asynchronous cleanup can race with its callbacks. Cancel relevant transport where supported, but also protect any application-owned side effects that cancellation does not cover. Preserve the existing policy for a failed logout; an older logout failure must not roll back a newer authenticated session.

Apply the same reasoning to a delayed auth refresh: old success must not install credentials or replay a write into the new session; old failure must not clear the new user's credentials or redirect their page. An obsolete mutation callback must not refill a removed private cache, invalidate the new user's data, show a success toast, or change their pending state.

## TanStack Query 5.103.2 boundaries

- `cancelQueries({ queryKey, ... })` cancels matching query work; pass the query function's `signal` through a transport that supports it when actual network cancellation is needed. It does not cancel mutation writes or arbitrary async work in a service/interceptor.
- Removing the component is insufficient: unused queries can finish and cache their results when the signal is not consumed. Do not assume `enabled: false` means private cached data was erased.
- `invalidateQueries` marks entries stale and may refetch; it is not private-data eviction. `resetQueries` restores initial state and may refetch active queries, so it can reintroduce private `initialData` or start work during a transition.
- `removeQueries` removes matching entries. `clear()` clears the client's query and mutation caches; it is appropriate only when that whole client is the intended discard boundary. Neither is a substitute for guarding external callbacks or undoing accepted writes.
- Stop or re-scope private observers/work producers as part of the transition so they cannot immediately recreate an old key. Keep public caches and unrelated work when their owner remains valid.
- Use the existing [mutation callback contracts](tanstack-query.md#when-a-mutation-changes-cached-data) and [manual request lifecycle rules](../../react-patterns/references/manual-request-lifecycle.md) for the corresponding paths. Suspense cancellation has separate limitations documented in the Query reference; do not assume the ordinary cancellation recipe applies unchanged.

**Counterexamples:** a private search cache cannot remain keyed only by keyword across account changes without explicit ownership cleanup. Conversely, every query does not need a session key, and `queryClient.clear()` on every token refresh needlessly discards unrelated valid data. For the extension, retain the current service/store architecture; adding Query is not necessary to express these invariants.

## Observable checks

Choose checks for the affected data owners and session transitions. Include refresh, same-account relogin, mutation completion, and extension-context cases when those paths can participate in the changed flow.

- Start a private read as A; switch to B and resolve or reject A's request after B's request starts. Check display, pending/error state, and backing cache independently.
- Log out and log in again as the same account while a request is pending; verify the retired lifetime cannot overwrite the new one.
- Complete an old token refresh successfully and unsuccessfully after a new login. Verify credentials, retry dispatch, and navigation remain owned by the new session.
- Let an old mutation finish after private cache cleanup. Its server write may already exist; verify it cannot repopulate or invalidate the new session's client state, and reconcile only under the appropriate owner.
- In the extension, keep a content script/sidepanel alive during auth changes and verify that its memory cache and pending requests follow the transition. Inspect the agreed private-draft policy and public-cache retention separately.

## Project fit and version evidence

Inspected on 2026-09-25: React **19.3.0**, Zustand **5.0.15**, frontend TanStack Query **5.103.2**, and TypeScript **6.0.3** against each manifest/lockfile and installed packages. The extension has no direct Query dependency. No new session-generation or cache-key API is asserted to exist in this repository.

Review [frontend auth state](../../../../frontend/secondbrain/src/stores/authStore.ts), [shared client recovery](../../../../frontend/secondbrain/src/api/client.ts), and [extension search ownership](../../../../extension/src/stores/noteSearchStore.ts) with their actual callers. These paths establish applicability, not a reproduced cross-account exposure.

- [TanStack Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys): result dependencies belong in key identity.
- [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation): unused queries, signal consumption, and cancellation limitations.
- [QueryClient reference](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient): filtered cancellation/removal, reset/invalidation, and whole-client clearing.
- Cross-checked installed **5.103.2** `@tanstack/query-core/src/queryClient.ts`, `query.ts`, `queryCache.ts`, `mutationCache.ts`, and `mutation.ts`: query removal/cancellation and cache clearing do not constitute rollback of a server write or cancellation of arbitrary application callbacks.
- [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage): shared storage and change notifications across contexts; notifications do not replace ownership checks inside each context.
