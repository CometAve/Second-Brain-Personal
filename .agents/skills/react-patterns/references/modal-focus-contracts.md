# Modal and overlay focus contracts

## When to use

Read this when changing dialog/overlay opening, closing, keyboard handling, focus restoration, or keeping a closed panel mounted. Apply it to the web app and extension, including portals and Shadow DOM. For ordinary buttons, labels, and refs, use [native element contracts](../../typescript-standards/references/native-element-contracts.md).

## Decide whether the surface is modal

| Intended interaction                                                       | Required boundary                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A modal editor or confirmation temporarily blocks the underlying interface | Give the dialog an accessible name, move focus inside, contain its Tab sequence, and prevent interaction with the background while active. Restore focus meaningfully when it closes. |
| A nonmodal search/sidebar leaves the main interface available              | Preserve a usable way to move between the panel and main interface. Do not add `aria-modal="true"` or an unconditional focus trap just because the panel floats above content.        |
| An alert dialog interrupts the user for a brief, important decision        | Use the alert-dialog semantics and its action/cancel contract only when the interaction fits. A general note editor is not automatically an alert dialog.                             |

`role="dialog"`, `aria-modal`, a backdrop, and scroll locking do not implement the whole modal contract. In particular, `aria-hidden` alone does not prevent keyboard or pointer interaction. Avoid placing the active dialog inside an inert/hidden ancestor when disabling the background; account for its actual portal destination.

## Preserve the interaction across opening and closing

- Give the dialog a name through its visible title and `aria-labelledby`, or a suitable `aria-label`. Do not flatten a long structured editor into a single `aria-describedby` announcement by default.
- Choose initial focus for the task: an appropriate field, a static heading with `tabIndex={-1}` for substantial content, or the least destructive action for an irreversible confirmation. Do not universally focus the first button or the primary destructive action.
- Keep Tab and Shift+Tab within an active modal, including when fields become disabled or content changes. Reuse a suitable installed primitive when its contract fits; a hand-maintained list of initially focusable elements is not sufficient for dynamic content.
- Route Escape to the active interaction layer. A nested menu or an IME can own that key before the surrounding dialog. Respect handled events and [composition input](ime-keyboard-commands.md); avoid competing document handlers that close multiple layers. Provide a visible keyboard-operable close/cancel control.
- Preserve the approved save/discard policy when requesting close. Dismissing an overlay must not silently discard a draft or bypass a failed save. Use [save lifecycles](../../state-management/references/save-lifecycle.md) when close interacts with pending work.
- Restore focus to the invoking element when it still exists and is usable; otherwise choose the logical next location in the workflow. With stacked dialogs, return to the still-active parent layer. Closing animations must not later steal focus from a newer interaction.
- A panel kept mounted for animation/state retention must stop exposing its closed controls to keyboard navigation and assistive technology. A transform, opacity change, or `pointer-events: none` alone does not provide that boundary. Coordinate hiding/inertness, focus transfer, and animation without changing the agreed draft-retention policy.
- In the extension, inspect the actual document/ShadowRoot and portal destination. A document-level `activeElement` can identify the shadow host instead of the focused inner control. Preserve host-page interaction for a nonmodal extension panel; do not make the entire host page inert as a shortcut.

## Decision examples and counterexamples

| Situation                                                         | Expected decision                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A modal editor opens; Tab can reach a background Delete button    | The modal contract is incomplete even if `aria-modal` is set. Check focus containment and background interaction together.   |
| A search sidebar intentionally permits editing the page beside it | Keep it nonmodal. Trapping focus to imitate a modal would change the interaction.                                            |
| A menu inside a note dialog consumes Escape                       | Close the menu for that event; do not also discard/close the note dialog.                                                    |
| Confirming deletion removes the element that opened the dialog    | Move focus to a meaningful remaining control or record, not a disconnected trigger.                                          |
| An editor slides offscreen but stays mounted to retain its draft  | Preserve the draft while removing closed controls from interaction; remounting everything is not the only possible solution. |

These are interaction examples, not permission to redesign modal/nonmodal behavior, save policies, or dependencies. Do not introduce a generic focus-management framework for an unrelated control change.

## Observable checks

For a changed surface, exercise keyboard opening, initial focus, forward/backward Tab boundaries, nested-layer Escape, close/cancel, and focus return. Check a removed/disabled trigger, dynamic content, and reopening during a closing animation where those cases apply. Verify that a closed retained panel and a modal's background cannot receive unintended focus or activation. For extension overlays, include the actual Shadow DOM/portal boundary and host-page interaction. Type checks or the presence of ARIA attributes do not establish these behaviors.

## Project and version evidence

Checked on 2026-09-25 against React / `@types/react` **19.3.0**, TypeScript **6.0.3**, and the frontend's direct `@radix-ui/react-alert-dialog` **1.1.23** dependency, lockfile, and installed `dist/index.js`. That AlertDialog implementation forces modal behavior and composes opening focus toward its Cancel control. Preserve its actual API instead of assuming the documentation's umbrella-package import is installed here; the extension does not directly declare this package. Do not import a transitive dialog package merely to match an example.

The web [SlideOverModal](../../../../frontend/secondbrain/src/shared/components/SlideOverModal/SlideOverModal.tsx) and [SidePeekOverlay](../../../../frontend/secondbrain/src/features/note/components/SidePeekOverlay.tsx) are review targets, not certified implementations of this contract. Documentation work alone does not reproduce their runtime behavior.

Sources: [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Radix Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [activeElement and shadow trees](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement), [HTML inert](https://html.spec.whatwg.org/multipage/interaction.html#inert).
