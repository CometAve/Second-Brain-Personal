# Browser checks

Use this reference for changes to UI behavior, layout, navigation, input, or persistence. Read the [official Playwright CLI skill](../../playwright-cli/SKILL.md) and only the references needed for the task. This document supplies project-specific validation criteria rather than another CLI manual.

## Preconditions and a minimal session

Prepare the [web environment](../../../../frontend/secondbrain/README.md), run `pnpm dev` in that module, and use the URL printed by the server; the default is `http://localhost:5173`. For the extension, follow the [extension build and Chrome loading instructions](../../../../extension/README.md). Distinguish a public-page smoke check from authenticated workflows.

The checked CLI version is **0.1.21**, from Microsoft's [official Playwright CLI repository](https://github.com/microsoft/playwright-cli). To reproduce the CLI setup from the repository root with nvm, select the project's Node version before installing the pinned CLI:

```sh
cd frontend/secondbrain
nvm install
nvm use
npm install --global @playwright/cli@0.1.21
node --version
command -v playwright-cli
playwright-cli --version
```

The current expected versions are Node **26.10.0** and CLI **0.1.21**. A global CLI under another Node installation may not be on the selected environment's PATH. An equivalent isolated installation is valid when it runs the same versions; record the actual executable paths used. The official skill is already tracked at `.agents/skills/playwright-cli/`; do not overwrite it during routine setup. For an intentional skill installation or refresh, run the pinned CLI's `install --skills=agents` from the repository root and review the generated diff. Use `playwright-cli install-browser --help` if a required browser is missing, then install only the browser needed for the check.

```sh
# Replace the example URL with the running server's URL.
# Choose another session name if sb-check is already in use.
playwright-cli -s=sb-check open http://localhost:5173
playwright-cli -s=sb-check snapshot
# Act on a target observed in the current snapshot and check the expected outcome.
playwright-cli -s=sb-check console
playwright-cli -s=sb-check requests
playwright-cli -s=sb-check close
```

A CLI session does not require adding a Playwright Test suite. Apply upstream test-generation instructions only when creating or maintaining that suite is in scope; do not bootstrap a test framework or mark a failing test `fixme` merely to follow a reference. Keep expected outcomes tied to the requested behavior; a mismatch with the current UI is a finding to diagnose, not automatic permission to rewrite the specification.

## Reproduce and observe

- Define the starting URL, authentication/data state, user action, and expected outcome for the surface actually changed. Identify existing servers and sessions before starting another one.
- Inspect a fresh snapshot before choosing a target. Example refs such as `e1` are not stable identifiers; read the updated state after navigation or relevant UI changes. Prefer the observed accessible name or current ref.
- Reproduce the user interaction through clicks, keyboard input, and navigation. Calling a handler through `eval` does not demonstrate the same interaction path. Inspect the resulting UI/URL and relevant console or request failures.
- Let locator actions perform their actionability checks, then wait for the expected UI state or a specific relevant response. Do not use an arbitrary sleep or `networkidle` as proof that a workflow is ready or complete. A deliberate fixture delay or video pacing is separate from a correctness check. [Auto-waiting](https://playwright.dev/docs/actionability), [load states and timeout waits](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
- Preserve the actual cause of an action failure. A failed click can indicate a hidden, disabled, covered, ambiguous, or missing target; do not catch every error and report only “element not found.” A navigation, click, saved storage file, or scripted success overlay is not by itself evidence that the intended action succeeded.
- For Korean IME defects, successful `fill()` or text insertion does not establish that composition input works. Reproduce the relevant composition, input, and blur/close sequence, and report when the OS IME itself was not exercised. [Keyboard event behavior](https://playwright.dev/docs/api/class-keyboard#keyboard-insert-text).
- For save/delete/navigation changes, verify the resulting state, including reopening or reloading where persistence matters. Exercise relevant loading, failure, and empty states; for layout changes, include affected viewport, focus, and keyboard conditions.

For these changed boundaries, select the applicable reference's observable checks rather than exercising every case for every task:

- Autosave, close, delete, or promotion: [save lifecycle checks](../../state-management/references/save-lifecycle.md#observable-checks), including scheduled work and actual persistence.
- Login/logout, private caches, or auth recovery: [session boundary checks](../../state-management/references/session-data-boundaries.md#observable-checks), including old success/error/finalization after a new session.
- Extension shared storage or background work: [competing writes](../../state-management/references/extension-storage-concurrency.md) and [worker interruption/recovery](../../state-management/references/extension-worker-lifecycle.md), as applicable. Keep debugger-induced worker lifetime changes separate from ordinary behavior.
- Dialogs or input shortcuts: [modal focus](../../react-patterns/references/modal-focus-contracts.md#observable-checks) and [IME command checks](../../react-patterns/references/ime-keyboard-commands.md#observable-checks-and-counterexamples), preserving the distinction between synthetic events and actual OS composition.

## Advanced CLI code

Read [running-code](../../playwright-cli/references/running-code.md) only when CLI actions are insufficient. In 0.1.21, `run-code` takes one function expression with `page`; it is not a normal Node module and does not provide `require`, imports, a test-runner `expect`, or bare `setTimeout`. Its callback and `page.evaluate` run in different environments: use `page.evaluate` for browser globals and pass required values explicitly. Return compact, JSON-serializable observations. These limits were checked against the [bundled engine source](https://github.com/microsoft/playwright/blob/78ff4260d79b924724bdcc4ccd89e463b8f43b0d/packages/playwright-core/src/tools/backend/runCode.ts) and [evaluation documentation](https://playwright.dev/docs/evaluating).

Keep page/context mutations scoped to the test session and track what they change. For example, `clearPermissions()` clears all permission overrides, not the geolocation value; `setGeolocation(null)` emulates an unavailable position rather than restoring the physical location. Use the [BrowserContext API](https://playwright.dev/docs/api/class-browsercontext#browser-context-clear-permissions) when changing permissions or emulation.

## Evidence and cleanup

Record `environment and initial state → actions → expected/observed result` and enough detail to reproduce a failure. If APIs or storage were mocked, identify the fixtures and replaced boundaries. Keep that evidence distinct from live server responses, OAuth accounts, extension permissions, and external LLM calls. Report limits when required access, real data, or an unapproved paid/external action is unavailable.

Link useful snapshots, screenshots, or traces without adding tokens, cookies, or real note contents to Git. `.playwright-cli/` is ignored, but that does not make artifacts saved elsewhere safe to commit. Close only sessions created for this check; detach when attached to the user's existing browser rather than shutting it down, and do not stop unrelated servers or sessions.
