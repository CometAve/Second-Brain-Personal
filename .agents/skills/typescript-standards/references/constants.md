# Constant data: names, ownership, and placement

## When to use

Read this when adding or extracting fixed values, UI lookup tables, shared settings, endpoint paths, or storage keys. The examples target both apps' TypeScript 6.0.3 and React 19.3.0 baseline, checked on 2026-09-25. Recheck the affected app before adapting them.

## Name the data according to its role

- **Use `UPPER_SNAKE_CASE` for semantic constant data identifiers:** fixed values, static lists/tables, storage keys, and application settings that remain fixed for the running app. This is a project convention, not a TypeScript or React requirement.
- A `const` declaration alone does not make a value semantic constant data. Keep normal role-based names for render-derived values, Hook results, functions, components, schemas, and mutable clients/stores. Do not rename `selectedNote`, `onSave`, or `NoteCard` merely because their bindings use `const`.
- Keep types in PascalCase. Object property names and persisted/protocol string values follow their own contracts; uppercasing a constant's identifier does not authorize changing its keys or values.

## Choose the smallest correct owner

| Data and dependencies | Placement |
| --- | --- |
| Static UI data used only by one component, with no separate domain responsibility or actual reuse | At module scope near the top of that component file, after imports and any types it needs, before the component. Keep it unexported. |
| Data shared by components in one feature/domain | A named constant export in that feature/domain's existing constants or configuration module. |
| Data shared across pages/features: endpoint paths, storage key strings, common message IDs/text, app defaults | An explicitly owned shared constants/configuration module in the same app. Reuse an existing authoritative definition. |
| A value depending on props, state, current locale/theme, permissions, or changing external data | Compute it in the reactive owner or handle it through the existing state/subscription boundary. A static lookup table may be separate; the current selection or translated result remains reactive. |

“Application-wide” means an importable module, not a global variable or a single catch-all `constants.ts`. Group by responsibility and import directly from the defining file using named exports. Do not add a barrel. The web app and extension are separate packages; sharing a concept does not justify cross-importing their source files.

Do not extract every literal or invent reuse. Name a value when its meaning, repeated policy, or maintenance benefits from it. Equal values with different meanings do not automatically belong to the same constant.

## Example: a private UI table and a reactive selection

Avoid recreating a fixed table inside the component and treating its binding as ordinary local data:

```tsx
type StatusBadgeProps = { status: 'draft' | 'saved' };

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusLabels = { draft: 'Draft', saved: 'Saved' };
  return <span>{statusLabels[status]}</span>;
}
```

Keep the static table near its only consumer, with a checked key contract:

```tsx
type NoteStatus = 'draft' | 'saved';
type StatusBadgeProps = { status: NoteStatus };

const STATUS_LABELS = {
  draft: 'Draft',
  saved: 'Saved',
} as const satisfies Record<NoteStatus, string>;

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = STATUS_LABELS[status];
  return <span>{label}</span>;
}
```

`label` depends on the current prop, so its name and render-time selection stay unchanged. Do not add `useMemo` for this lookup. This example assumes fixed display text. With runtime localization, keep stable message IDs in the table and translate for the current locale inside the reactive owner; module-level translated strings would become stale. The same boundary applies to callbacks that capture current props or permissions.

The extraction makes ownership explicit; it is not evidence of a measured rendering improvement. In this repository, the extension's `Spinner.tsx` already separates a module-level `SIZE_CONFIG` from the render-time `config` selected by `size`.

## Example: settings with real shared consumers

If multiple pages share the same pagination policy, a dedicated module can own it. These values illustrate placement; they do not set a new pagination policy for this app.

```ts
// src/config/pagination.ts
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
```

```ts
// In a consuming module; import from the defining file.
import { DEFAULT_PAGE_SIZE } from '@/config/pagination';

export function getPageOffset(pageIndex: number) {
  return pageIndex * DEFAULT_PAGE_SIZE;
}
```

Preserve the existing source of configuration: both apps already use `src/config/env.ts` for environment values, validation, and defaults. Do not duplicate API base URLs in components, replace environment values with hardcoded URLs, or turn changing runtime configuration into a module-load snapshot. A validated startup setting that is fixed for the app's lifetime can be constant data.

Storage key strings, endpoint paths, message IDs, and default values are behavior contracts. Reorganizing or renaming an identifier must preserve them unless a separate behavior change is authorized. The extension already owns `STORAGE_KEYS` in `src/services/storageService.ts`; reuse that definition instead of creating a second key registry. Reuse existing error definitions/localization rather than duplicating user-visible messages.

## Type safety and mutation boundaries

- `const` prevents rebinding, not object or array mutation. Constant data is not mutable shared state; do not push into module-level option arrays or update lookup entries during render.
- Use `as const` when literal specificity and readonly literal inference are useful. Use `satisfies` to check the expected shape without replacing the inferred type with an assertion. For a readonly tuple, a shape constraint must also accept readonly data, such as `readonly number[]`.
- Neither `as const`, `readonly`, nor `satisfies` validates external values or freezes objects at runtime. `satisfies` alone does not guarantee readonly properties. A const assertion does not recursively make pre-existing referenced objects immutable. `Object.freeze` is shallow; use runtime freezing only when there is a concrete runtime immutability requirement.
- When a constant is a template for editable state, create an independent state value and copy nested mutable paths as needed. Do not mutate the shared template or cast away readonly checks to make it editable. See [immutable state updates](../../react-patterns/references/immutable-state-updates.md).

## Example: derive a literal union and check its labels

When allowed values and their labels are genuinely shared, a scoped defining module can expose both the tuple-derived type and the checked table. Keep a component-only table local instead; the exports below illustrate the shared case.

```ts
export const TITLE_MODES = ['read', 'edit'] as const;
export type TitleMode = (typeof TITLE_MODES)[number];

export const TITLE_MODE_LABELS = {
  read: 'Read only',
  edit: 'Edit',
} as const satisfies Record<TitleMode, string>;
```

A missing or misspelled label key is rejected. Do not use `as Record<TitleMode, string>` to bypass such feedback. Validate arbitrary strings before treating them as `TitleMode`; the tuple declaration does not validate a URL or message. For a Hook that must transition between union members, follow [State type modeling](state-type-modeling.md): a checked initializer alone does not declare every future state.

## Review checks and sources

Check the data's dependencies, actual consumers, naming, and owner. When editing documentation examples, verify the affected examples under the target app's compiler settings, including rejection of missing lookup keys or readonly writes where applicable. For application changes, check the changed declarations and consumers against the relevant contracts; unchanged documentation examples do not need another typecheck. Type checks cannot establish correct localization, environment behavior, or persistence; check those behaviors when implementation changes affect them. Existing lint configurations do not automatically enforce this semantic constant distinction.

- [TypeScript const declarations](https://www.typescriptlang.org/docs/handbook/variable-declarations.html#const-declarations)
- [TypeScript const assertions and their caveats](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- [TypeScript satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
- [React purity and local versus non-local mutation](https://react.dev/reference/rules/components-and-hooks-must-be-pure#local-mutation)
