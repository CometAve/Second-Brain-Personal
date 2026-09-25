# Save lifecycles and acknowledgement

Use when changing autosave, debounced writes, draft promotion, target switching, delete, or close/navigation behavior. Preserve the agreed save/discard policy; this reference does not authorize changing it. For general stale read responses, use [manual request lifecycles](../../react-patterns/references/manual-request-lifecycle.md); for account changes, use [session data boundaries](session-data-boundaries.md).

## Distinguish the stages of a save

| Stage                            | What it proves                                          | What it does not prove                                                  |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Local edit or scheduled debounce | The client holds an edit to process                     | A request started, or the server has the edit                           |
| Request pending                  | A particular payload was dispatched                     | That payload was accepted or the latest edit is saved                   |
| Server acknowledgement           | The API confirmed the operation defined by its contract | A newer local edit is saved, or a separate draft-to-note step completed |
| Refresh after a successful write | The UI attempted to obtain current server data          | Refresh success, unless its result was checked                          |

Associate a save with its target, submitted snapshot/revision, and session owner. Track dirty or scheduled work separately from the request's pending state when the UI needs that distinction. A boolean `isSaving === false` is not a sufficient condition for displaying "Saved" or allowing a data-losing close.

A successful response can acknowledge the submitted revision without clearing newer edits. Preserve failure information and the recoverable draft; do not mark unsaved content clean from a `finally` block or `onSettled`. For writes followed by revalidation, use [Query completion semantics](tanstack-query.md#when-pending-must-include-cache-revalidation).

## Example: an acknowledgement can be older than the editor

The revision numbers below are illustrative local edit identities, not a replacement for the server's version field.

| Event                                            | Correct interpretation                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| Edit revision 8 and schedule a save              | Revision 8 is dirty; no request is pending yet         |
| Dispatch revision 8, then type revision 9        | Revision 8 is pending and revision 9 is unsaved        |
| Server acknowledges revision 8                   | Record that acknowledgement; revision 9 remains dirty  |
| Revision 9 fails to save                         | Keep revision 9 recoverable and expose failure         |
| Retry revision 9 and receive its acknowledgement | Mark revision 9 saved according to that API's contract |

Ignoring an old response only protects client state. If writes 8 and 9 both reach the server and 8 is persisted last, a response guard does not repair the stored value. Use the existing server version/conflict contract or an appropriate write-ordering strategy. Do not assume a local queue orders other tabs or clients, or introduce an incompatible server contract as a cleanup.

## Decide pending work at each boundary

| Boundary              | Required decision                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Target A changes to B | Resolve or retain A's work under A's identity; do not apply A's snapshot or acknowledgement to B                                 |
| Explicit save/promote | Include the required latest draft before promotion; avoid duplicate trailing work or promotion of an older server draft          |
| Close/navigation      | Apply the agreed wait, retain/recover, or discard behavior; cleanup alone does not decide the product policy                     |
| Delete/discard        | Stop obsolete scheduled writes from reviving the item; coordinate already dispatched writes and delete under the server contract |

In frontend `lodash-es` **4.18.1**, `cancel()` removes delayed invocation; it does not abort an already running request. `flush()` invokes pending trailing work and returns the callback's result (or the last result if nothing is pending). Therefore, `await debouncedSave.flush()` does not await persistence when the callback calls Query's `mutate()` and returns `void`. A Promise-returning callback can expose its own completion, but flushing it does not automatically drain other overlapping requests or handle rejection.

Do not recreate a debouncer on every render and leave earlier timers alive. When its lifetime or inputs change, explicitly resolve the old scheduled work and retain the correct target/payload. Follow the existing Hook/operation owner; adding unconditional memoization or hiding stale callbacks in refs does not establish this contract.

**Counterexamples:** cancelling obsolete search suggestions is often appropriate; cancelling the only unsaved draft during close may lose work. Flushing a draft before an explicit save can be appropriate; flushing after the user intentionally discards/deletes it can restore unwanted data. Neither unconditional `cancel()` nor unconditional `flush()` is a general cleanup rule.

## Page termination is a fallback boundary

- Save during normal interaction according to the agreed policy. Do not make `beforeunload`, `pagehide`, or an awaited cleanup the only persistence opportunity; the page may be frozen or terminated without completion. A `visibilitychange` checkpoint can reduce loss, but hidden does not mean the user chose save, publish, or discard.
- `navigator.sendBeacon()` returns queue acceptance, not transfer success or server acknowledgement. It supplies no response callback, uses POST, and cannot set a custom Authorization header. Do not claim a queued beacon saved the note.
- `fetch(..., { keepalive: true })` allows a request to outlive its page; it still has payload/transport limits and can fail. The page may not remain alive to process its Promise. It is not a guaranteed save receipt or automatic retry queue.
- Preserve the existing API base URL, authentication, request body, validation, and failure/recovery semantics. A raw beacon/fetch is not an interchangeable replacement for the shared client. A fallback path must satisfy the endpoint contract before it is used.
- Keep `beforeunload` prompts, when required by the existing behavior, conditional on unsaved work. Do not add a blocking prompt or new persistent draft storage policy merely to match this reference.

## Observable checks

Select scenarios that can occur in the changed save flow. Include overlap, delete/promotion, or termination cases when those boundaries are affected. When ordering or termination is in scope, verify persisted server state as well as UI state.

- Edit, then close or change target before the debounce fires; verify the agreed outcome and which target receives any write.
- Acknowledge an older revision after a newer edit, then fail/retry the newer save; check dirty/pending/error states and the server value separately.
- Reorder two writes and overlap a trailing save with delete or promotion; prove persisted ordering rather than only suppressing stale UI updates.
- Test transport failure and rejected beacon enqueue; no successful save indicator should follow an unconfirmed operation. Reopen/refetch to verify actual persistence after a termination test.
- Exercise setup → cleanup → setup when the React owner uses an Effect. Cleanup must not accidentally perform a user save/discard action.

## Project fit and version evidence

Inspected on 2026-09-25: frontend React **19.3.0**, TanStack Query **5.103.2**, `lodash-es` **4.18.1**, and TypeScript **6.0.3**, using the manifest, lockfile, installed packages, and DOM-enabled TypeScript configuration. The extension has no direct Query or lodash dependency; do not copy their imports there.

The current [draft Hook](../../../../frontend/secondbrain/src/features/note/hooks/useNoteDraft.ts), [debounced save Hook](../../../../frontend/secondbrain/src/features/note/hooks/useDebouncedSave.ts), and [page-exit Hook](../../../../frontend/secondbrain/src/features/note/hooks/useBeforeUnloadSave.ts) are review targets, not validated implementations of every criterion above.

- [Lodash debounce documentation](https://lodash.com/docs/#debounce), cross-checked against installed `lodash-es/debounce.js`: `cancel`, `flush`, and last invocation result.
- [W3C Beacon method and processing model](https://www.w3.org/TR/beacon/#sec-sendBeacon-method): queue acceptance, response/header limitations, and shared keepalive quota.
- [WHATWG Fetch keepalive](https://fetch.spec.whatwg.org/#request-keepalive-flag): request lifetime and transport constraints.
- [Chrome page lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api): termination events and conditional unsaved-work prompts.
- [React Effect cleanup](https://react.dev/reference/react/useEffect#reference): cleanup also runs before changed dependencies, with an extra setup/cleanup cycle in development Strict Mode.
