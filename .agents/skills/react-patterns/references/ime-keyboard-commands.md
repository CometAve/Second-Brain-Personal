# IME input and keyboard command ownership

## When to use

Read this when adding Enter/Escape shortcuts, input submission, search commands, or document-level dismissal around editable controls. It applies to Korean and other composition input in both React apps. Normal text entry does not require a new input abstraction.

## Separate text input from commands

- A composition session can emit keyboard events while the user selects, commits, or cancels text. Do not treat every Enter as submit/search or every Escape as panel dismissal.
- For a React keyboard event, inspect `event.nativeEvent.isComposing`; for a native DOM keyboard listener, inspect `event.isComposing`. Preserve `defaultPrevented` and the existing order of child, primitive, and outer handlers. A handler must receive the event in time to honor cancellation: an outer capture listener runs before a child's bubble handler.
- Update a controlled input's value synchronously from its change event. Delay the search/request if needed, not the input value update. Do not freeze `onChange` during composition or schedule the controlled value in a transition.
- Decide which interaction owns the command. A nested menu, editable multiline area, or composition session may use a key before an outer dialog does. Multiline Enter should keep its intended newline behavior. Use `preventDefault` or propagation control for a concrete ownership requirement, not for every keystroke.
- Treat browser/OS differences as compatibility cases to reproduce. The composition flag is a baseline signal, not proof that every browser reports the final composition key identically. Add composition tracking or a narrow workaround only for a demonstrated sequence; do not introduce deprecated numeric key checks or arbitrary delays as a universal recipe.

## Example: a standalone controlled search field

This example owns Enter search and Escape cancellation outside a form; its caller updates `value` synchronously and owns asynchronous command completion/failure. It illustrates the normal composition/handled-event guards, not a complete cross-browser IME workaround or a replacement for the existing SearchInput component.

```tsx
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

interface SearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  onCancel: () => void;
}

export function SearchField({
  value,
  onValueChange,
  onSearch,
  onCancel,
}: SearchFieldProps) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;

    if (event.key === "Enter") {
      event.preventDefault();
      onSearch(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <label>
      Search notes
      <input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </label>
  );
}
```

An unconditional `if (event.key === 'Enter') onSearch(...)` misses the composition and handled-event distinctions. In the guarded example, a composing event leaves the input's normal composition behavior intact. A parent dismissal listener must still honor composition and handled events itself; returning from this child handler does not cancel the event for every ancestor.

When adapting this to a form, preserve one submission owner and test implicit Enter submission as well as the submit button. Do not invoke the same command independently in both `onKeyDown` and `onSubmit`. Changing a search callback to return `void` does not handle a rejected Promise; the command owner must handle failure. For Escape that closes a surface, retain the [modal focus and draft contract](modal-focus-contracts.md).

## Observable checks and counterexamples

| Input sequence                                        | Expected behavior                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Korean composition followed by its confirmation Enter | Complete text composition without accidentally issuing the application's search/save command. |
| A subsequent intentional Enter after composition      | Execute the intended command once with the current input value.                               |
| Escape while composition/candidate selection owns it  | Preserve the editable interaction; do not also close the outer editor.                        |
| A nested control handles the key before the parent    | The outer command respects cancellation and the active layer.                                 |
| Ordinary typing and composition changes               | Reflect input changes immediately, even when requests are debounced.                          |
| Enter in an ordinary multiline editor                 | Preserve the intended newline behavior unless an explicitly defined shortcut applies.         |

Synthetic handler checks can verify decision branches but cannot establish OS IME behavior. For an affected UI, exercise actual composition, confirmation/cancellation, and blur/close on the supported browser/OS. Record when only text insertion or synthetic keyboard events were tested. Do not claim that `fill()` proves composition compatibility.

## Version evidence and sources

Checked on 2026-09-25 against both apps' manifests, lockfiles, application TS/lint configuration, installed `@types/react` **19.3.0** (`KeyboardEvent` extends a native keyboard event), and TypeScript **6.0.3** DOM declarations (`KeyboardEvent.isComposing`). The example uses React **19.3.0** and ES2022/DOM types, named exports, and named props without additional dependencies.

The extension's [SearchInput](../../../../extension/src/content-scripts/overlay/components/atoms/SearchInput.tsx) and [DragSearchSettingsPanel](../../../../extension/src/content-scripts/overlay/components/organisms/DragSearchSettingsPanel.tsx) are concrete places to review when their keyboard flows change. Existing code is not proof that composition or dismissal already works correctly.

Sources: [W3C keys during composition](https://www.w3.org/TR/uievents/#keys-during-composition) (Working Draft, not a browser compatibility guarantee), [React event objects](https://react.dev/reference/react-dom/components/common#react-event-object), [React controlled input updates](https://react.dev/reference/react-dom/components/input#my-input-caret-jumps-to-the-beginning-on-every-keystroke).
