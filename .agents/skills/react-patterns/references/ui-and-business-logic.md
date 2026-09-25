# UI and business logic boundaries

## When to use

Read this when a component mixes rendering with policy, data access, or a multi-step feature operation, or when deciding whether to extract a function, Hook, component, or service. These are project placement criteria, not a mandatory four-layer architecture. The baseline is React / React types **19.3.0** and TypeScript **6.0.3** in both apps, Zustand **5.0.15** in both, and TanStack Query **5.103.2** in the web app only; checked against manifests, lockfiles, installed packages, and app configuration on 2026-09-25.

## Choose the responsibility before the file

| Responsibility | Usual home | Boundary to preserve |
| --- | --- | --- |
| JSX, accessible interaction, display formatting, simple open/close state, DOM event adaptation | Component or a focused UI Hook when that interaction needs reuse | Keep UI-only details close to the UI. A click can request a domain command without containing its whole implementation. |
| An agreed policy, calculation, or transformation that should survive a different UI | A named, ordinary TypeScript function when it needs no React features | Take explicit inputs and return values/decisions. Keep pure rules free of React, DOM events, Query clients, navigation, and I/O; do not call every transformation a business rule. |
| Coordinating React state, subscriptions, Query, and a feature operation | A purpose-specific Hook when React features are needed; otherwise the existing action/workflow owner | Give the operation a clear pending/error/completion contract. Existing store actions can own asynchronous workflows; extraction does not require moving them into Hooks. |
| HTTP, browser messages, storage, response validation, and transport mapping | The existing API/service boundary for that module | Accept domain/transport inputs rather than a DOM event or React state setter. Return data or a meaningful failure; presentation stays with the feature/UI owner. |

A pure function can be called during rendering. [Effect decisions](effect-decisions.md) selects **when work runs and who starts it**; this reference selects **which responsibility owns its implementation**. Moving code to another file or Hook does not change render purity, state ownership, or when a request starts.

## Extract when a boundary becomes useful

- Separate a policy when its meaning changes independently of markup, several consumers must agree on it, or meaningful branch cases can be checked independently of React. One consumer can justify a clear boundary; hypothetical reuse alone does not.
- Extract a Hook when its React state/lifecycle or operation coordination expresses a concrete purpose. Moving every handler and label into `usePageLogic` merely hides the component's responsibilities. A helper that needs no Hooks normally stays an ordinary function.
- Separate I/O from presentation when an operation mixes transport details with JSX, element events, toasts, or navigation. Preserve the existing adapter/authentication/validation contract; do not invent another service just to add a layer.
- Keep ownership explicit across a split: which layer owns the draft, which initiates the command, which reports failure, and what completion means. Pass intent and data such as `renameNote(id, title)` instead of passing a click event or the component's entire setter collection.
- Place extracted logic with its owning feature first and use direct named imports. Move it to a shared module only for real consumers. Do not turn `utils`, a Context, or a global store into a collection of unrelated feature rules. Types should live with the contract they describe; a reusable policy must not import its input type from a UI component file.

For state/draft/cache ownership, use [state management](../../state-management/SKILL.md). For external inputs, use [boundary validation](../../typescript-standards/references/external-data.md). Separating client-side validation does not replace the server's validation or authorization.

## Example: separate a decision from the button that presents it

**Avoid:** a renamed Hook that contains no Hooks and combines title normalization, raw `fetch`, success notifications, navigation, and button-label selection. Calling it `useRenameLogic` or moving it to a new file does not establish those boundaries.

The following two files illustrate an **assumed, already agreed** rule: trim a proposed title, reject an empty result, and skip a rename when the trimmed proposal equals the saved title. The saved title is supplied as stored. This is not a change to the application's actual title policy or API, and the example paths do not prescribe a new directory hierarchy.

`src/features/note/renameDecision.ts` — the policy has no React or I/O dependency:

```ts
export type RenameDecision =
  | { kind: 'invalid'; reason: 'empty-title' }
  | { kind: 'unchanged' }
  | { kind: 'ready'; title: string };

export function evaluateRename(savedTitle: string, proposedTitle: string): RenameDecision {
  const title = proposedTitle.trim();
  if (title.length === 0) return { kind: 'invalid', reason: 'empty-title' };
  if (title === savedTitle) return { kind: 'unchanged' };
  return { kind: 'ready', title };
}
```

`src/features/note/RenameAction.tsx` — the UI maps that decision to feedback and a command request:

```tsx
import { useId } from 'react';
import { evaluateRename } from '@/features/note/renameDecision';

interface RenameActionProps {
  savedTitle: string;
  proposedTitle: string;
  isSaving: boolean;
  onRenameRequested: (title: string) => void;
}

export function RenameAction({
  savedTitle, proposedTitle, isSaving, onRenameRequested,
}: RenameActionProps) {
  const feedbackId = useId();
  const decision = evaluateRename(savedTitle, proposedTitle);
  const feedback = decision.kind === 'invalid' ? 'Enter a title.' : null;
  function handleClick() {
    if (!isSaving && decision.kind === 'ready') onRenameRequested(decision.title);
  }
  return (
    <>
      <button
        type="button"
        disabled={isSaving || decision.kind !== 'ready'}
        aria-describedby={feedback ? feedbackId : undefined}
        onClick={handleClick}
      >
        {isSaving ? 'Saving...' : 'Rename'}
      </button>
      {feedback && <p id={feedbackId}>{feedback}</p>}
    </>
  );
}
```

The props are controlled inputs; this component adds no mirror draft or duplicate pending state. The caller supplies a command entry point that handles asynchronous rejection and owns pending/completion; the callback's `void` type alone does not prove that failures are handled. The example neither saves data nor proves persistence. A disabled button is feedback, not a concurrency or authorization guarantee. The command owner also checks the relevant preconditions, awaits the actual operation, and preserves the agreed draft/reset policy on failure or target changes. Keep that coordination in the existing Query Hook, store action, or service/workflow as appropriate; do not add an Effect to watch a "save requested" flag.

## Counterexamples: keep simple UI logic local

A local `isOpen` toggle, a short `isSaving ? 'Saving...' : 'Save'` label, input-to-string event adaptation, or one screen's simple display filtering can stay in its component. A pure calculation is not automatically a reusable domain rule, and not every helper needs its own file. Conversely, moving unrelated responsibilities into one large Hook is not sufficient separation.

Do not require a Container/View pair for every component, prohibit all Hooks in presentational UI, or introduce service interfaces, factories, Context providers, or a global store for a simple local interaction. A component may call a focused feature Hook directly. A reusable primitive should not acquire application-specific save/navigation behavior merely to shorten its caller.

## Preserve the current module's owners

In the web app, note read/delete paths use feature services and Query Hooks, while some draft operations call the existing `api/client` adapters directly. In the extension, service calls and some pending/error/cache coordination already live in store actions. Inspect the changed path before extracting; existing inconsistencies are not a reason to migrate the whole application or bypass its adapters. Preserve established shared-client authentication recovery while reviewing the affected behavior; do not remove it merely to make a layer appear pure. Existing services are not proof that all responses already have runtime validation.

Prefer returning data, domain decisions, and operation status from the extracted boundary. Let the feature/UI owner choose rendering, messages, focus, and navigation. A transport error must not become a success-shaped empty value, and refactoring must preserve any explicitly agreed recovery behavior. Reuse existing query keys, invalidation, cancellation, message validation, and storage policies rather than adding a second owner.

## Checks for the changed boundary

- Identify the distinct reason for each extraction and which simple UI decisions stayed local.
- Check pure rules with valid, invalid, unchanged, and boundary inputs that reflect the actual agreed policy; verify no mutation of caller-owned data.
- Check types and callers together, including a non-UI consumer of a reusable rule. Keep request/response validation at the external boundary.
- When changing an asynchronous application flow, verify one user command has the intended owner, rejection reaches visible failure, pending/success reflect the chosen completion contract, and later edits or a new target survive old completions.
- For changed UI, verify the event, keyboard/focus, feedback, and draft behavior. A smaller component or passing type check is not proof of correct separation or working persistence.

## Official sources

- [React component responsibilities and state placement](https://react.dev/learn/thinking-in-react): decomposition follows the UI/data responsibilities; ordinary component-local calculations and state remain valid.
- [Custom Hook naming and extraction](https://react.dev/learn/reusing-logic-with-custom-hooks): distinguish reusable React logic from ordinary functions and preserve each Hook call's state ownership.
- [Sharing logic between event handlers](https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers): a user command can call shared logic directly without routing it through an Effect.

The API/service and feature-placement choices above adapt those principles to this repository; React does not mandate these folder names or a fixed number of layers.
