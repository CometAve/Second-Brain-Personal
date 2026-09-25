# Extension storage: concurrent changes and write ownership

Read this when multiple content scripts, tabs, the sidepanel, or the background worker can update the same stored value. It is separate from React immutable updates: copying an array correctly does not preserve another writer's changes.

Verified on 2026-09-25: the extension uses Manifest V3, `webextension-polyfill` **0.12.0**, `@types/webextension-polyfill` **0.12.6**, `@types/chrome` **0.3.0**, and Zustand **5.0.15**. `src/services/storageService.ts` stores collected pages, pending snippets, and save requests as whole arrays in `storage.local`. These are applicability examples, not evidence that a race has been reproduced.

## Identify the operation that must remain consistent

- Enumerate every writer to the affected key, including clear, remove, startup recovery, and migration. A module-local queue or Zustand store coordinates only its own execution context.
- Define the required result of competing operations: preserve both additions, apply an agreed add/remove order, or allow replacement. Do not invent deletion or conflict policies from a generic example.
- Treat a read, local transformation, and write as separate asynchronous steps. `await` orders one caller's work; it does not prevent another caller from reading the same old value.
- `storage.onChanged` informs readers about changes. It does not lock a key, make earlier reads current, or combine multiple writes into a transaction. A version field plus a later unconditional `set` is not compare-and-swap.
- Do not turn a failed read into an empty collection and then overwrite stored data with a derived result. Preserve the existing intentional fallback boundary; an update must distinguish missing data from an unreadable value.

## Example: two successful calls can still lose an addition

This is an illustrative interleaving for `addCollectedPage`, starting with `[A]`. Each caller independently awaits its own read and write.

| Step | Caller 1                                  | Caller 2                                  | Stored value |
| ---- | ----------------------------------------- | ----------------------------------------- | ------------ |
| 1    | Reads `[A]`                               |                                           | `[A]`        |
| 2    |                                           | Reads `[A]`                               | `[A]`        |
| 3    | Adds B to its local copy; writes `[A, B]` |                                           | `[A, B]`     |
| 4    |                                           | Adds C to its local copy; writes `[A, C]` | `[A, C]`     |

Both writes may resolve successfully, yet B is absent. Deduplicating each caller's array or reacting to `onChanged` does not repair this sequence. Repeatedly rereading and writing without a coordination mechanism can reproduce the same race.

## Choose the narrowest mechanism that preserves the contract

| Situation                                               | Decision and limits                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing background messaging is the write owner        | Route the relevant mutations through that owner and serialize the entire read/transform/write operation. One worker still has overlapping async handlers; one writer location alone is insufficient. Cover every writer to that key. |
| A failed operation occurs in a serialized queue         | Report that operation's failure and allow later operations to run. Silencing a rejection must not turn the failed operation into success.                                                                                            |
| Worker termination can interrupt an operation           | An in-memory queue is not durable. Use the [worker lifetime criteria](extension-worker-lifecycle.md) for acknowledgement, recovery, and duplicate delivery.                                                                          |
| Data has independent record identities                  | Separate records may reduce whole-array overwrites, but deletion, enumeration, and multi-record invariants still need an explicit contract. Do not change the storage schema solely to follow this example.                          |
| Existing storage cannot express required atomic changes | Explain the unmet invariant before proposing a transactional store or server operation. This is an architecture decision, not permission to add a dependency or migrate data.                                                        |

For a scalar preference where replacing the previous value is the agreed behavior, competing writes may intentionally use the final stored value. Clarify whether that means storage commit order or user action order; asynchronous completion can differ from click order. Do not impose collection-style merge logic on every setting, or silently apply this exception to drafts, collected content, or save requests.

## Verification for a changed flow

- Control the interleaving of two additions and the relevant add/remove or clear/update pair. Check final stored data and each caller's result, not just that both Promises resolve.
- Reject a read or write and confirm the operation fails without reporting saved data or blocking all later queued work.
- Check a second execution context, including a path that might bypass the chosen owner. A same-context mock cannot prove cross-context coordination.
- If interrupted operations can be retried, check worker termination around the write and acknowledgement; distinguish storage commit from receipt of the response.

## Evidence and compatibility

- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage): asynchronous shared storage and change events. The interleaving above is a concurrency inference from separate reads/writes, not a claim that Chrome documents this application-specific failure.
- [Chrome worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): worker memory does not survive termination; IndexedDB provides transactional primitives when the approved design requires them.
- Cross-checked the installed `@types/webextension-polyfill/namespaces/storage.d.ts`: `get` and `set` return separate Promises; `onChanged` delivers changes. The installed public interface provides no transaction or compare-and-swap operation for `storage.local`.
