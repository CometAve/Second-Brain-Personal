# Memoization decisions

Use this reference when adding or changing `memo`, `useMemo`, or `useCallback`, including during ordinary feature work. Identify the work to avoid and a reproducible interaction before claiming improvement. Judge correctness, readability, and resource costs alongside speed. Do not present multipliers or millisecond savings from older guidance as measured results for this project. React/type baseline: **19.3.0** in both apps.

## Memoization needs a specific consumer and benefit

Default to straightforward calculations and handlers. Do not decorate every derived value, object, or callback with memoization. A large calculation is one valid reason, but it is not the only one: a stable prop can also let an expensive memoized child skip work. React Compiler is not configured in either app; its automatic memoization cannot be assumed here.

| Tool | What it reuses | A reason to consider it | Insufficient justification |
| --- | --- | --- | --- |
| `useMemo` | A pure calculation's result while dependencies match | Repeated slow calculation, or a stable value consumed by an effective memoized child/Hook | A cheap string/boolean calculation with no identity-sensitive consumer |
| `useCallback` | A function reference while dependencies match | A callback consumed by an effective memoized child or a Hook whose synchronization depends on its identity | The function body is expensive; its result is not cached and calling it still does the work |
| `memo` | A component render may be skipped when props compare equal | The component rerenders often with equal props and the skipped rendering is costly | Every component might eventually be slow |

Name the consumer and the repeated work it can avoid. A prop object recreated each render may defeat a child's memoization; a changed primitive prop may legitimately require it to render. Keep complete dependencies and closure values. Never rely on retained caches for correctness, persistence, or exactly-once behavior. [useMemo](https://react.dev/reference/react/useMemo), [useCallback](https://react.dev/reference/react/useCallback), [memo](https://react.dev/reference/react/memo)

Before stabilizing an Effect-only object or helper, consider defining it inside that Effect. Keep transient state close to its consumers and remove unnecessary Effect-driven state chains first. Do not hide stale data or impure rendering behind memoization. [Removing unnecessary dependencies](https://react.dev/learn/removing-effect-dependencies), [Effect decisions](effect-decisions.md)

### Paired decision example

For a cheap selection label, `useMemo(() => selected ? 'Selected' : 'Select', [selected])` has no useful identity benefit over a string expression. For a plain button, `useCallback(() => onSelect(id), [onSelect, id])` alone does not skip the button's render or cache `onSelect`'s result. Use ordinary expressions and event handlers for those cases.

For a measured slow `memo` child receiving a filtered collection or handler, preserving those prop references can allow it to skip unrelated parent updates. Verify that the other props stay equal and that the child's avoided work exceeds the added complexity; cheap collection construction does not automatically rule out this use. These are decisions to test, not measured results for this application.

### Evidence before reporting an optimization

Compare the same interaction, representative data, and relevant device conditions before/after; record what was measured and what changed. Use browser/React profiling as appropriate. Account for production behavior: development Strict Mode repeats work to detect impurities and is not a production timing baseline. A successful build or a reduced render count alone does not establish a faster user interaction. `useMemo` does not speed the first calculation. Do not impose a universal item-count or millisecond threshold copied from an example. [Measuring calculations](https://react.dev/reference/react/useMemo#how-to-tell-if-a-calculation-is-expensive)
