# Extension worker lifetime and operation recovery

Read this when changing background events, delayed work, login callbacks, or operations whose result must remain meaningful after a Manifest V3 worker stops. This is not a requirement to persist every cache or migrate the current authentication architecture.

Verified on 2026-09-25: `extension/src/manifest.json` uses a module service worker, has `storage` permission, has no `alarms` permission, and declares no `minimum_chrome_version`. The installed baseline is `webextension-polyfill` **0.12.0**, `@types/webextension-polyfill` **0.12.6**, and `@types/chrome` **0.3.0**. Vite's `esnext` output target does not establish Chrome extension API support.

## Separate one worker instance from an operation's lifetime

- Globals, timers, local queues, closures, and pending Promise continuations belong to one worker instance. A pending Promise or open message response is not a guarantee of indefinite execution, durable completion, or cancellation of work already received by a server.
- Register event listeners needed after restart synchronously at module evaluation, before asynchronous initialization. Load required state inside the handler before acting; do not put these registrations inside a storage callback, an action-specific Promise, or only `onInstalled` / `onStartup`. Neither event represents every worker wake-up.
- Keep reconstructible caches in memory when losing them is acceptable. For an operation that must survive interruption, record only the metadata needed for its chosen recovery policy, such as operation identity, target, stage, and expiry time. Preserve current authentication and sensitive-data storage boundaries.
- Choose the storage lifetime to match recovery: surviving a worker restart differs from surviving a browser restart. `storage.session` is not durable across browser restart or extension reload/update.
- After restart, use current persisted state to decide whether an event belongs to an active operation. Do not infer completion or failure solely from a reset global flag, elapsed timer, or missing original caller.

## Example: a tab-based login outlives its original closure

`src/background/service-worker.ts` currently creates a login tab, registers tab listeners inside its creation callback, and starts a five-minute timer. This timeline explains the risk; it does not claim a browser reproduction or prescribe a replacement authentication API.

| Step | What happens                                                 | Required decision                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Login starts; a closure retains tab ID and Promise callbacks | Decide whether interruption should allow explicit restart or support recovery. Preserve existing behavior until a policy change is authorized.                                                                                                                        |
| 2    | Worker stops while the user interacts with the tab           | The closure, timer, and in-memory login flag cannot be the recovery record.                                                                                                                                                                                           |
| 3    | The tab redirects or closes                                  | If recovery is required, a synchronously registered listener must be available on wake-up and correlate the event with the operation record. With an agreed explicit-restart policy, retire the interrupted attempt; an obsolete event must not finish a new attempt. |
| 4    | A matching event is processed after the deadline             | Compare the stored expiry against current time and follow the agreed expiry/cancellation behavior. A timer firing is not the source of truth.                                                                                                                         |
| 5    | The original UI no longer has a live response channel        | Expose/reconcile the operation result through the existing supported flow; do not assume the old Promise can be resumed.                                                                                                                                              |

For an external write, interruption between server acceptance and local acknowledgement creates an unknown outcome. Use an existing operation identifier/status lookup or idempotency contract when available. Do not automatically repeat a non-idempotent write or invent server support. If safe recovery needs a new product/API decision, surface that decision instead of calling the operation successful or failed without evidence.

## Timers, alarms, and supported Chrome versions

- A disposable timer is acceptable when its loss only discards optional work. Use alarms only when delayed work must be scheduled beyond a worker instance and the requested scope permits the permission/configuration change. Avoid artificial permanent keepalive loops.
- Alarms can run late, including after device sleep. Recheck the recorded deadline and operation stage in the handler; an alarm is a wake-up mechanism, not an exact clock or a success signal.
- When adopting alarms, verify persistence on the supported Chrome range and reconcile required alarms from operation state at worker startup. Recreating an alarm must not repeat an already completed operation.
- Check runtime support, manifest permissions, and the installed wrapper/types together. Chrome 120 lowered the minimum recurring alarm period to 30 seconds. Current documentation's `persistAcrossSessions` requires Chrome 150+; the installed Chrome types include it, but the installed polyfill types do not. Do not copy this newer option into a `browser.alarms` example or bypass the mismatch with `as`.
- The missing minimum version is unresolved support evidence, not proof of compatibility with every Chrome release. Establish the supported range before relying on a newer API or lifetime improvement; do not silently raise that range during an unrelated change.

## Verification for a changed flow

Select checks for the lifecycle boundaries affected by the change. For operations that must recover after worker termination, test interruption at the relevant preparation, dispatch, and acknowledgement stages. For deliberately disposable work, verify that losing it follows the agreed behavior. Check runtime support and permissions for any changed background API.

- Stop and wake the worker before an event, during asynchronous preparation, and after an external effect but before acknowledgement. Check expired, completed, and duplicate operation records.
- Exercise the relevant tab close/callback or delayed event after wake-up and confirm unrelated targets cannot complete the operation.
- Check a rejected state read/write and recovery without the original response channel. A persisted marker alone does not prove the external operation succeeded.
- Verify the supported Chrome version, permissions, and delayed-alarm behavior if alarms are introduced. Keep lifecycle checks distinct from type checks and from a run held alive by inspection/debugging.

## Evidence and compatibility

- [Chrome worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): termination, lost globals, and version-specific lifetime changes.
- [Service worker migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers): synchronous listener registration and timer lifetime.
- [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms): delay, persistence, permission, and Chrome-version boundaries.
- [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage#storage_areas): storage lifetimes, including `session`.
- Cross-checked installed `@types/chrome/index.d.ts` and `@types/webextension-polyfill/namespaces/alarms.d.ts`. For overlapping stored updates, also read [storage concurrency](extension-storage-concurrency.md); recovery metadata needs the same write-ownership discipline.
