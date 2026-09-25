# Component type contracts

## When to use and version evidence

Use this reference when declaring a component, defining generic input/callback relationships, or changing mode-dependent requirements at its call sites. Both apps use TypeScript 6.0.3 and React / `@types/react` 19.3.0 with `strict`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Checked on 2026-09-25 against both manifests, lockfiles, application tsconfigs, and installed declarations. These examples use ES2022-compatible APIs and add no library.

The examples describe component contracts, not the application's note or message protocols. For Hook initialization and state transitions, read [State type modeling](state-type-modeling.md) only when that is part of the change. Values received from an external boundary still need [runtime validation](external-data.md).

## Component declarations and inline types

**Project convention:** declare ordinary components as plain functions with typed parameters and a named props `type` or `interface`. Do not use `React.FC`, an imported `FC`, `React.FunctionComponent`, an imported `FunctionComponent`, or renamed aliases of these types for project component declarations. The installed React 19.3 types still support them; this convention expresses the user's preferred declaration style, not a compatibility or performance fix. Do not mass-rewrite unrelated application files as part of another change.

A class that directly implements an ErrorBoundary is a narrow exception: React does not provide direct function equivalents for `getDerivedStateFromError` and `componentDidCatch`. Keep its props/state explicitly typed and follow [Error boundaries and Suspense](../../react-patterns/references/error-boundaries-and-suspense.md). This does not relax the `React.FC` convention or justify new class-based UI.

**Avoid in this project** — a valid React type that does not follow the convention:

```tsx
import type { FC } from 'react';

interface NoteTitleProps {
  title: string;
}

export const NoteTitle: FC<NoteTitleProps> = ({ title }) => <h2>{title}</h2>;
```

**Prefer** — the props contract is explicit and the return type is inferred:

```tsx
interface NoteTitleProps {
  title: string;
}

export function NoteTitle({ title }: NoteTitleProps) {
  return <h2>{title}</h2>;
}
```

A plain arrow function with a typed parameter is also valid. Keep `children` explicit when accepted, using `ReactNode` or a narrower type required by the actual contract. Add a return annotation when it establishes a useful API boundary, not merely because the function is a component. Named props types are a project convention: React's documentation also accepts small inline component props types. Small local utility shapes such as `{ x: number; y: number }` and contextually typed event callbacks can remain inline. Extract reused or complex contracts instead of repeating large anonymous types or creating a named type for every trivial expression.

Sources: [React with TypeScript](https://react.dev/learn/typescript#typescript-with-react-components), [TypeScript function annotations and inference](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#functions). The local `@types/react/index.d.ts` defines `FC` as an alias of `FunctionComponent`.

## Generic input and callback relationships

Use a generic component when existing consumers share behavior while their item type differs. Tie item inputs, render/label callbacks, selection callbacks, and stable keys to the same type. Keep read-only collections `readonly`; require constraints only for operations the component performs. Do not add `extends object` merely to disambiguate TSX, since valid items can be strings. A named `function ItemList<Item>` parses without that constraint; a generic arrow can use `<Item,>`.

**Avoid** — this shape accepts callbacks for the wrong item type and loses useful inference:

```ts
export interface UnsafeItemListProps {
  items: readonly unknown[];
  onSelect: (item: any) => void;
}
```

**Prefer when reuse actually needs it** — the caller owns presentation; the component preserves the item relationship without casts:

```tsx
import type { Key, ReactNode } from 'react';

interface ItemListProps<Item> {
  items: readonly Item[];
  getKey: (item: Item) => Key;
  renderLabel: (item: Item) => ReactNode;
  onSelect: (item: Item) => void;
}

export function ItemList<Item>({ items, getKey, renderLabel, onSelect }: ItemListProps<Item>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={getKey(item)}>
          <button type="button" onClick={() => onSelect(item)}>{renderLabel(item)}</button>
        </li>
      ))}
    </ul>
  );
}
```

For `readonly string[]`, both callbacks receive strings; numeric-only callbacks are invalid. With objects, use a stable domain key, not the array index. The render callback supplies non-interactive label content with an accessible name, because this component owns the button. Keep a feature-specific list concrete when it has no real need for type-varying consumers. Callback typing does not validate external items at runtime.

Source: [TypeScript generics](https://www.typescriptlang.org/docs/handbook/2/generics.html). Read [Native element contracts](native-element-contracts.md) only if the component also wraps or changes a DOM element.

## Mode-dependent props

Use a discriminated union when a mode determines which props must be present. Keep genuinely independent options independent; a union is useful for a real constraint, not every group of booleans. This example requires the change callback only for the editable mode:

```tsx
export type TitleFieldProps =
  | { mode: 'read'; value: string }
  | { mode: 'edit'; value: string; onChange: (value: string) => void };

export function TitleField(props: TitleFieldProps) {
  if (props.mode === 'read') return <p>{props.value}</p>;
  return (
    <label>
      Title
      <input value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} />
    </label>
  );
}
```

The editable branch requires its callback; `props.onChange!` is unnecessary. A union only models the constraint encoded in it. If an extra property must be forbidden even for structurally assignable variables, encode that restriction explicitly rather than assuming object types are exact.

When the contract requires a property to be absent in another mode, `?: never` can express that restriction. For example, a custom text control may deliberately support only one initial/current value source:

```ts
export type TextControlValueProps =
  | { value: string; onValueChange: (value: string) => void; defaultValue?: never }
  | { value?: never; onValueChange?: never; defaultValue?: string };
```

This is an illustrative editable-control contract, not a replacement for native input types: a read-only controlled input does not require a change handler. Both current apps leave `exactOptionalPropertyTypes` disabled, so an optional `never` property still accepts explicit `undefined`; do not claim exact key absence or change compiler settings solely for this example. Likewise, `href` and `onClick` are valid together on an anchor and must not be made mutually exclusive without a real product constraint. For lifetime ownership, read [State and component identity](../../react-patterns/references/state-and-identity.md).

Source: [Optional property exactness](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html), [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).

## Verification

Check the declaration and its callers together. Confirm that valid read/edit props compile, the editable mode requires its callback, and branch-specific values can be used after narrowing without assertions. Review plain-function declarations, named props, explicit accepted children, and the local inline-type exceptions against the project convention. A rejected `FC` declaration is a project-policy check, not an expected TypeScript compiler error. For generic components, check both object and primitive items, readonly inputs, and an intentionally mismatched callback. For exclusive props, check a structurally assignable variable as well as a fresh literal, and preserve the documented explicit-undefined behavior. These checks do not establish runtime input validation, event behavior, or rendering performance.
