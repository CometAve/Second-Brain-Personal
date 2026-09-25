---
name: react-patterns
description: Implement or review React components, Hooks, Effects, and asynchronous UI in the Second-Brain web app and browser extension. Address performance when a bottleneck is observed or the task explicitly requires it.
---

# React patterns

## Scope and baseline

This skill applies to `frontend/secondbrain` and `extension`. As checked on 2026-09-25, both use React/React DOM 19.3.0, `@types/react` 19.3.0, `eslint-plugin-react-hooks` 7.1.1, and Vite 8.3.0. React Compiler is not configured. Before changing code, recheck the relevant app's manifest, application dependency document in its lockfile, and configuration.

- For component and Hook changes, read [Correctness and lifecycle](references/correctness.md).
- When separating UI from policy, feature coordination, or data access, read [UI and business logic boundaries](references/ui-and-business-logic.md). Keep simple UI logic local and preserve the existing operation owner.
- Before adding an Effect or an Effect-owning custom Hook, read [Effect, event, and Hook decisions](references/effect-decisions.md).
- For fixed UI tables, options, or shared configuration, follow [Constant data](../typescript-standards/references/constants.md): use `UPPER_SNAKE_CASE`, keep component-private static data at module scope in the same file, and retain props/state/locale-dependent values in their reactive owner.
- For controlled values versus drafts, initialization/reset, related local transitions, list keys, component identity, or state versus refs, read the relevant sections of [State ownership and identity](references/state-and-identity.md).
- For frontend URL-controlled UI and navigation history, read the [URL ownership section](references/state-and-identity.md#url-owned-state-and-navigation-history); the extension has no direct TanStack Router dependency.
- When designing wrapper APIs, cooperating component parts, or render callbacks, read [Component composition](references/component-composition.md). For native props, ref forwarding, `as`/`asChild`, and accessibility contracts, use [Native element contracts](../typescript-standards/references/native-element-contracts.md).
- When changing dialog/overlay modality, focus, dismissal, or retained closed panels, read [Modal focus contracts](references/modal-focus-contracts.md).
- When changing Enter/Escape commands, editable inputs, or document-level dismissal, read [IME and keyboard commands](references/ime-keyboard-commands.md).
- For autosave, delayed writes, or save/delete/close coordination, read [Save lifecycles](../state-management/references/save-lifecycle.md); cancelling a read and discarding an unsaved edit have different consequences.
- When adding or changing a rendering failure boundary, retry UI, or Suspense integration, read [Error boundaries and Suspense](references/error-boundaries-and-suspense.md).
- For object/array updates or mutation of an earlier state snapshot, read [Immutable state updates](references/immutable-state-updates.md).
- For directly owned requests that can be superseded or unmounted, read [manual request lifecycle examples](references/manual-request-lifecycle.md).
- When deciding whether a subscription value is reactive or belongs in `useEffectEvent`, read [Effect Event boundary examples](references/effect-event-boundaries.md).
- When adding, changing, or evaluating `memo`, `useMemo`, or `useCallback`, read [Memoization decisions](references/memoization-decisions.md).
- For observed or explicitly requested request, bundle, rendering, cache, or browser-work improvements, read the relevant sections of [Performance decisions](references/performance.md).
- Use named exports from their defining application modules; consult [module boundaries](../typescript-standards/references/module-exports.md) when changing exports, import paths, or lazy loaders.
- For component declarations or mode-dependent props, read [Component type contracts](../typescript-standards/references/component-type-contracts.md). Project components must not use `React.FC`, `React.FunctionComponent`, or their aliases; this is a project convention, not a React deprecation. A directly implemented ErrorBoundary is a narrow exception to the plain-function convention; reuse the existing boundary where its contract fits.
- For `useState` inference, status-dependent payloads, or exhaustive state branches, read [State type modeling](../typescript-standards/references/state-type-modeling.md).
- Inspect existing TanStack Query boundaries for web server state, and existing service/subscription boundaries for the extension's external state. This skill does not require adding SWR, Next.js, or another state library.
- Treat existing repository code as subject to review. A similar implementation is not evidence that starting external work during render, omitting dependencies, or incomplete cleanup is safe to copy.

## Verification

Use the changed app's existing typecheck, lint, and build commands, together with checks of the affected behavior. For asynchronous UI, cover relevant loading, failure, retry, rapid input, and navigation cases. Report build success separately from measured user-visible performance improvements.

The baseline was checked against both apps' `package.json`, `pnpm-lock.yaml`, and installed package manifests. The official [React documentation version](https://react.dev/versions) is 19.3.
