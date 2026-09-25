# Performance decisions

## When to use

Use this reference for an observed request, code-loading, layout, or resource bottleneck, or an explicit performance requirement in those areas. Compare the same reproducible interaction and representative conditions before/after, accounting for production behavior; build success alone is not performance evidence. Judge correctness, readability, and resource costs alongside speed. Do not present multipliers or millisecond savings from older guidance as measured results for this project. For `memo`, `useMemo`, or `useCallback`, use [Memoization decisions](memoization-decisions.md).

## Requests and code loading

- Run independent requests concurrently with `Promise.all` when simultaneous execution is safe. Account for dependencies, rate limits, and failure policy. Concurrency does not reduce the number of requests, and one rejection does not automatically cancel the others. Avoid starting requests on branches that do not need them. Do not add `better-all` for this purpose.
- Match code splitting and hover/focus preloading to likely usage and network cost. Handle import failures, avoid unconditional prefetching, and retain early logging when it is needed to capture initialization failures.
- For Lucide 1.48.0, default to named imports from the public package entry point. The installed package declares `sideEffects: false`, and its official documentation supports tree shaking. Do not enforce internal paths such as `lucide-react/dist/...` across the codebase. Investigate supported import paths and bundler settings only when actual bundle output warrants it. [Lucide React](https://lucide.dev/guide/react)

## Rendering and hidden panels

- Static JSX hoisting should address the same observed-cost criteria as memoization; do not trade readable component boundaries for speculative savings.
- Consider React 19.3's `Activity` when a hidden panel needs to preserve its DOM and state. Hiding cleans up Effects; showing the panel recreates them. Hidden children still render in response to new props at a lower priority. Preserved DOM can also retain behavior, such as media playback, that requires explicit cleanup. Verify editor/canvas resource lifecycles and retained memory before adopting it; do not replace all existing panels. [Activity](https://react.dev/reference/react/Activity)

## Lookups, caches, and browser work

- Consider Set/Map indexes for repeated lookups that are a bottleneck. Include construction and update costs and duplicate-key semantics. Do not hoist property reads that may change during iteration or change output semantics, such as reporting the first error instead of all errors.
- Before adding a cache, define its lifetime, size limit, and invalidation triggers. Do not duplicate authentication, storage, or server state in an arbitrary module-level cache. In the extension, inspect storage boundaries between the page, content scripts, and service worker.
- Investigate repeated layout reads after style writes when diagnosing forced layout. Consecutive style assignments do not necessarily cause an immediate reflow each. Prefer declarative class/style updates and avoid erasing existing styles with `cssText`. [Layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
- Apply SVG wrappers, coordinate rounding, `content-visibility`, loop fusion, or RegExp memoization only after appropriate measurement or visual checks. Preserve SVG shape, layout, accessibility, focus, and find-in-page behavior. Wrapping an SVG does not guarantee GPU acceleration.
