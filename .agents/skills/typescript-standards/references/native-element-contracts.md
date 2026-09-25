# Native element contracts

## When to use and version evidence

Read this when building or changing a DOM wrapper, forwarding a ref, composing `asChild`, or introducing a polymorphic `as` API. Both apps use React / `@types/react` 19.3.0 and TypeScript 6.0.3. The extension directly installs `@radix-ui/react-slot` 1.3.3; the frontend does not directly declare Slot. Checked on 2026-09-25 against manifests, lockfiles, app tsconfigs, installed React declarations, and Slot's `dist/index.js`. Use each app's public dependencies and existing utilities; do not import a transitive package or copy a newer documentation API without checking its installed declarations.

## Preserve the contract in the rendered element

- Choose props for the actual element with `ComponentPropsWithRef<'input'>` when forwarding its ref, or `ComponentPropsWithoutRef` when the public API excludes ref. Declaring inherited props is not sufficient: forward supported `name`, events, `aria-*`, disabled/read-only state, and other native attributes to the intended element. Remove wrapper-only props before spreading onto DOM.
- Prefer distinct names for custom props. If an established component deliberately replaces a native prop, remove it with `Omit<NativeProps, keyof OwnProps>` before combining types and document the semantic change. An intersection of incompatible native/custom properties does not create an override.
- Destructure `className` and combine it with the module's existing `cn` helper; avoid later spreads that silently replace the result. Preserve styles and events according to the public contract. If internal and caller handlers must both run, specify their order and whether `preventDefault()` cancels the internal action; prop spread order is not event composition.
- Use native buttons for actions and links for navigation. Choose the intended button `type`, retain keyboard/focus behavior, provide an accessible name, and associate visible labels with their inputs. CSS, `role`, or `asChild` alone does not supply missing native behavior. Do not nest interactive controls inside each other.

**Avoid** — inheriting `ComponentPropsWithRef<'input'>` while returning only `<input placeholder={placeholder} />` drops the declared ref, events, form attributes, and accessibility attributes. A visible label next to an input is not associated unless nested appropriately or connected with `htmlFor`/`id`.

**Prefer** — this frontend example deliberately replaces native numeric `size` with a documented visual size; a new API could instead call it `fieldSize` to preserve native `size`. Caller classes, input props, a unique label association, and the actual input ref are retained:

```tsx
import { useId } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';

interface TextFieldOwnProps {
  label: string;
  size?: 'compact' | 'regular';
}

type TextFieldProps = TextFieldOwnProps &
  Omit<ComponentPropsWithRef<'input'>, keyof TextFieldOwnProps>;

export function TextField({
  label, size = 'regular', id, className, ref, ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        id={inputId}
        ref={ref}
        className={cn('rounded border', size === 'compact' ? 'p-1' : 'p-2', className)}
      />
    </div>
  );
}
```

Use the extension's defining utility path `@/lib/utils/utils` there. This example illustrates a field wrapper, not a generic API for every input type or a reason to replace existing components. Keep controlled/uncontrolled behavior consistent with [state ownership](../../react-patterns/references/state-and-identity.md).

Sources: [React input labels](https://react.dev/reference/react-dom/components/input#providing-a-label-for-an-input), [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [WAI link pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/), [TypeScript Omit](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys).

## React 19 refs

A function component can accept `ref` as a prop in React 19, as above. Its type must match the actual DOM target, and the ref must reach that target; a typed ref prop alone does not forward it. Existing `forwardRef` components remain supported: preserve compatibility when touching them and do not mass-migrate unrelated components. Return a cleanup function or no value from a callback ref; an assignment expression that implicitly returns the node is not a valid substitute. If a wrapper must combine internal and external refs, preserve both attachment and cleanup rather than overwriting one.

Expose imperative handles only for operations that need them, such as focus or scroll; use normal props for declarative state such as whether a dialog is open. A custom imperative handle has a different type from a DOM element ref and must be advertised accordingly.

Sources: [React 19 ref props and cleanup](https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop), [forwardRef](https://react.dev/reference/react/forwardRef), [useImperativeHandle](https://react.dev/reference/react/useImperativeHandle).

## Slot and asChild composition

Use an existing Radix primitive's `asChild` contract where it fits; it is not a general reason to install another abstraction. For ordinary Slot composition, provide one suitable element child whose component forwards incoming props and ref to the actual DOM target. Follow the installed Slot/Slottable API if composing a more complex child structure. Preserve the primitive's required semantics: changing a trigger to a non-focusable element, or passing button-only behavior to an anchor, can break interaction even if TypeScript accepts the expression.

In installed Slot 1.3.3, when both handlers exist, the child handler runs before the Slot handler. Slot does **not** automatically skip the second handler when the first calls `preventDefault()`; the handler implementing cancellable behavior must check `event.defaultPrevented`. Class names are joined, and child style values win overlapping style keys. Verify behavior at the actual composed control, because a primitive can add its own event handling policy. Ref composition must still reach the element required for focus/measurement.

A prop-getter API is warranted only for an actual headless component contract. If introduced, define event/ref/ARIA merging instead of relying on competing object spreads. Prefer the established library API when it already owns those behaviors.

Sources: [Radix composition](https://www.radix-ui.com/primitives/docs/guides/composition), [Slot event handlers](https://www.radix-ui.com/primitives/docs/utilities/slot#event-handlers). Version-specific merge behavior is also confirmed in the installed extension package.

## Polymorphism only for a concrete shared API

Use polymorphism when existing consumers need the same component behavior across different elements. A separate button and link sharing styles is often sufficient. Limit the allowed elements to the real use case; preserve the relationship between the rendered tag, its accepted props, and its ref. Do not add a universal `ElementType` framework or assertions merely to silence an unresolved generic implementation.

**Counterexample:** a generic `Control<Element = 'button'>` with `as?: Element` may allow `Control<'a'>` without an `as` prop, while its implementation still renders a button. A default generic argument does not synchronize runtime selection. Require a runtime tag for non-default branches, or choose a bounded discriminated API, and verify both omitted/default and explicitly selected cases.

Do not use `<Control as="a" type="submit">` as proof that anchor props must fail: the installed anchor types accept `type` as a string for a hyperlink MIME hint; it does not make the anchor a submit button. Likewise, an anchor can validly have both `href` and `onClick`. Type acceptance cannot prove correct element semantics, focus behavior, or accessible naming.

Sources: [HTML hyperlink type](https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-type), the installed `@types/react/index.d.ts` definitions of `ComponentPropsWithRef` and `AnchorHTMLAttributes`.

For dialog/overlay focus and dismissal, read [Modal focus contracts](../../react-patterns/references/modal-focus-contracts.md). For Enter/Escape commands around editable inputs, read [IME and keyboard ownership](../../react-patterns/references/ime-keyboard-commands.md). Prop/ref type compatibility does not implement these interaction contracts.

## Verification

Check accepted native props and the intended ref type, rejected conflicting custom/native values, and wrong-tag/wrong-ref callers where the API promises to exclude them. Review where props and refs actually land. For changed application behavior, verify keyboard activation/focus, label association, form submission intent, disabled behavior, and composed event order/cancellation in the browser. Type checks alone do not prove these runtime contracts. Documentation-only work can validate the example's types and instructions without claiming a browser regression check ran.
