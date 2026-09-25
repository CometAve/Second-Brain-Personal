---
name: typescript-standards
description: Implement or review TypeScript types, component contracts, constant data, external data boundaries, and compiler errors in the Second-Brain web app and browser extension. Apply each app's actual TypeScript and lint configuration.
---

# TypeScript standards

## Scope and baseline

As checked on 2026-09-25, both apps' lockfiles and installed packages use TypeScript 6.0.3 and `@types/react` 19.3.0. Their application configs enable `strict`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`, with ES2022/DOM library definitions. Distinguish these from the ES2023 Node configurations. Before a change, inspect the current manifest, relevant importer and resolved package entries in the lockfile, and the applicable tsconfig. Account for the lockfile's multiple YAML documents when locating those entries; scope the check to dependencies affected by the change.

## Module boundaries

Use named exports and direct imports from the defining module in handwritten application code; avoid default exports and barrel aggregation. Keep external packages on their supported public import paths. For new modules, export/import changes, or lazy boundaries, read [Module exports and imports](references/module-exports.md), including required tool contracts and the named-module `React.lazy` adapter.

## Constant data

Use `UPPER_SNAKE_CASE` for semantic constant data. Keep private static UI tables at module scope near the top of their component file; put shared values in a feature-owned or app-wide constants/configuration module according to actual consumers. For names, placement, reactive exceptions, and readonly examples, read [Constant data](references/constants.md). A `const` binding alone does not make a value constant data.

## Types that fit the configuration

- Use `import type` for type-only dependencies. Preserve useful inference; add explicit return types at API/service boundaries when they help establish a public contract. Do not require a separate return interface for every component, callback, or Hook. [Return type inference](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#return-type-annotations)
- Declare ordinary components as plain functions with a named props `type` or `interface` and typed parameters. A directly implemented class ErrorBoundary is a narrow exception; React has no direct function-component equivalent for its error lifecycle methods. Do not use `React.FC`, imported `FC`, `FunctionComponent`, or aliases of those types for project component declarations. This is a project convention, not a claim that React 19 types reject them. Preserve inferred return types unless an explicit contract is useful; do not rewrite unrelated components merely to change their declaration style. For declarations, generic input/callback relationships, or mode-dependent props, read [Component type contracts](references/component-type-contracts.md).
- When annotating a React return type, choose `React.JSX.Element`, an explicitly imported `JSX.Element`, `ReactElement`, or `ReactNode` according to the actual return values. An unimported global `JSX.Element` does not match React 19 types. [React 19 type changes](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#the-jsx-namespace-in-typescript)
- Respect `erasableSyntaxOnly`: do not introduce enums, namespaces containing runtime code, or constructor parameter properties. When a class is appropriate, declare its properties and assign them in the constructor body. [Compiler option](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html)
- Check both library definitions and runtime support before introducing ES2023 array APIs such as `toSorted()` in app code. Copying before sorting preserves the original array under the current configuration. [lib](https://www.typescriptlang.org/tsconfig/lib.html)
- Follow the frontend's ESLint naming rule for type parameters, using meaningful names such as `Value`, `Item`, or `Key`. Do not assume the extension has the same additional naming rule. Resolve the cause of errors instead of disabling strictness or existing lint checks.

For DOM wrappers, React 19 ref props, `asChild`, or polymorphic `as` APIs, read [Native element contracts](references/native-element-contracts.md). Type acceptance must match actual prop/ref forwarding and native semantics.

## External data and errors

- For API, URL, or storage schema changes and frontend Zod handling, read [External data and Zod 4](references/external-data.md), including failure versus valid-empty examples.
- For client environment/configuration or authentication/error logging, read [Client configuration and sensitive diagnostics](references/external-data.md#client-configuration-and-sensitive-diagnostics). Preserve public configuration and useful diagnostics while excluding secrets and private payloads.
- For extension runtime/window messages or hand-written predicates over `unknown`, read [Extension message guards](references/extension-message-guards.md).

- Receive untrusted JSON, API, browser-message, and storage values as `unknown`, then validate the required structure. `as Result`, `response.json() as ...`, and `parseJson<Result>()` do not perform runtime validation. Do not use assertions merely to pass lint. [Type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
- A type guard must establish the type it claims. Validate the fields required by that type; if only a subset is checked, narrow to that subset rather than asserting the complete entity. Avoid redundant assertions after `in` and `typeof` narrowing. The compiler does not prove that an explicit type predicate is truthful.
- Reuse validation tools installed in the relevant app. Zod's presence in the frontend does not make it an extension dependency. Confirm the error contract before converting validation failures into empty successful results.
- Do not add `any`, double assertions, non-null assertions, or suppressions for convenience. Keep necessary exceptions at external declaration or compatibility boundaries narrow and document the reason. Handle null/undefined according to whether absence is expected or erroneous, and choose `??` versus `||` according to the intended fallback semantics.

## Inference and reuse

When deciding where a React-independent policy or transformation belongs, read [UI and business logic boundaries](../react-patterns/references/ui-and-business-logic.md). Keep its types with the owning contract; a pure helper does not require a Hook or a shared utility module.

- For `useState` initial-value inference, status-dependent payloads, or exhaustive state branches, read [State type modeling](references/state-type-modeling.md). A props-only change does not require this reference.

- Use named types for component props and for reused or complex domain contracts. Small, local utility parameter shapes and contextually typed callbacks may stay inline; do not replace useful inference with annotations on every variable.
- TypeScript 6.0.3 includes inferred type predicates introduced in 5.5. A straightforward predicate such as `items.filter(item => item !== null)` can produce a type with null removed. A manual guard is not always necessary. [Inferred predicates](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#inferred-type-predicates)
- Use generics to express actual relationships between inputs and outputs, with only the constraints required by the operations. A generic return annotation does not validate external data.
- Consider built-in utilities such as `Pick`, `Omit`, `Partial`, `Record`, and `Awaited` before custom types. Do not assume a recursively mapped `DeepPartial` or `DeepReadonly` handles arrays, functions, Date, and Map correctly. `undefined extends Value[Key]` cannot distinguish an optional property from a required property whose value includes `undefined`.

Verify with the relevant app's typecheck and lint commands. Passing type checks does not establish that external inputs were validated at runtime or that product behavior was tested. [TypeScript 6.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
