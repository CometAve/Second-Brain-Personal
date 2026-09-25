# Error boundaries, Suspense, and recovery

Read this reference when changing rendering failure isolation, lazy-loading feedback, or Suspense-enabled queries. The baseline is React **19.3.0** in both apps and TanStack Query **5.103.2** in the web app only. These rules do not require a Suspense migration, a new error-boundary library, or server rendering.

## Assign failure to its actual owner

| Failure or wait | Owner and response |
| --- | --- |
| A descendant throws while rendering | An ErrorBoundary can replace the affected region with failure UI. Place it where that recovery is useful; not automatically around every component. |
| A normal click/submit handler or its awaited operation fails | Handle it in the command/mutation lifecycle and preserve the relevant draft/selection. Wrapping the component in an ErrorBoundary does not catch this by itself. |
| A timer or other independently scheduled callback throws | Handle failure in that callback's owner. An ErrorBoundary does not generally catch asynchronous callbacks. |
| A boundary's own render/fallback throws | A higher boundary must handle it; the failing boundary cannot catch itself. |
| A supported resource suspends | A Suspense boundary provides pending UI; use a failure boundary for a rejection surfaced during rendering. |

Error boundaries do not handle server-rendering errors. React documents an exception to the general async exclusion for errors inside the transition function passed to the `startTransition` returned by `useTransition`; preserve that API's error contract rather than treating all async work as equivalent. Do not introduce a transition merely to route an ordinary command failure to a boundary. [ErrorBoundary scope](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

## Reuse the boundary and keep its implementation narrow

The web app already has `src/shared/components/ErrorBoundary/ErrorBoundary.tsx`. Inspect its props and recovery behavior before reusing or changing it. Implementing an ErrorBoundary directly is a narrow exception to the project's plain-function component convention: React has no direct function-component equivalent. Keep its props/state explicitly typed and its export named. This does not permit `React.FC` elsewhere or require converting ordinary components to classes.

Use pure `static getDerivedStateFromError` to select fallback state; use `componentDidCatch` for reporting. Do not rely on `componentDidCatch` calling `setState` as the fallback mechanism. Keep reporting within the existing diagnostics and data-sharing scope. [Error fallback lifecycle](https://react.dev/reference/react/Component#static-getderivedstatefromerror), [Error reporting lifecycle](https://react.dev/reference/react/Component#componentdidcatch)

## Reset is not necessarily retry

A reset permits another render. It does not prove that the failed cause changed. Before labeling an action "Retry", identify its resource owner and what the action actually repeats:

- A deterministic render defect will throw again until its input or implementation changes.
- A failed query may need both the query error-reset contract and the UI boundary reset, followed by the query's configured request behavior.
- React caches a `lazy` loader's Promise and result. Resetting/remounting the surrounding boundary does not itself call that same lazy loader again after a cached rejection. Do not create a new lazy component inside render to force retries. Choose an explicit recovery route compatible with the app and preserve unsaved work before any destructive reload/navigation. [Lazy caching](https://react.dev/reference/react/lazy#parameters)

Do not implement automatic reset loops, present a reset as a successful save, or clear dirty editor state merely to remove an error screen. Confirm the recovery result, not just that a button can be clicked.

## Use Suspense only with a compatible source

A normal Effect/event request does not activate Suspense. Keep its existing pending/error handling. Lazy-loaded code and a deliberately selected Suspense-enabled data integration are different contracts; retain the existing ownership instead of wrapping arbitrary fetch code and expecting a fallback. Pending fallbacks do not report success or recover failures. [Suspense behavior](https://react.dev/reference/react/Suspense)

For a deliberately selected web Query integration, read [When a frontend query uses Suspense](../../state-management/references/tanstack-query.md#when-a-frontend-query-uses-suspense) for the **5.103.2** options-object API, cached-data error behavior, request timing, and query error reset. Keep the existing QueryClient and connect that reset to the actual UI boundary contract. The extension has no direct Query dependency; do not add it to match this pattern.

## Observable checks

- Trigger a descendant render failure and separately reject a normal save handler; verify the intended fallback versus command error behavior and preserved input.
- Exercise pending, rejection, reset, and another failure. Confirm that recovery attempts the intended operation and does not enter a loop.
- For Query, distinguish no-data failure from background failure with cached data, and verify what happens after both query and UI reset.
- For a lazy import rejection, verify the actual recovery path; a visible fallback or a boundary reset alone is not evidence that the resource loaded.
