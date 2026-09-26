# Code Review and UX QA Protocol

Use this reference when routed from the root `AGENTS.md`. It defines review procedure, not new product requirements or permission to change the application. Model and reasoning assignments remain in `AGENTS.md`; do not duplicate or override them here.

## Scope and working mode

- Turn a broad review/QA request into the three phases below and proceed without requiring a detailed prompt or approval between phases. A focused review uses the same principles only for its target; an explicit code-only review does not require a browser run.
- Determine expected behavior from the current request, accepted decisions/specifications, and the current UI's promises. Existing code and tests are evidence, not automatic proof of correctness. Historical team documentation is context, not a backlog. If intent is unresolved, label the assumption and continue independent checks; ask only when the ambiguity blocks a material decision or safe action.
- Review the personal-computer application, not an assumed multi-tenant SaaS. Mobile and WearOS redevelopment are out of scope unless reauthorized. Inspect the Chrome extension only when relevant to the requested scope. Do not turn these exclusions into missing-feature findings.
- A review-only task remains investigative. Do not refactor, fix defects, update dependencies/configuration, create issues/PRs, or commit/push unless separately authorized. Temporary review artifacts and safe checks in an isolated test environment are acceptable; preserve unrelated work and record any artifacts left behind. If fixes are requested too, capture evidence first, then fix within the existing authorization and reverify.
- Use [project-verification](../skills/project-verification/SKILL.md) for verification standards and the [official playwright-cli skill](../skills/playwright-cli/SKILL.md) for supported browser operations. Read only the additional technical skills needed for a finding. This protocol neither replaces their tool guidance nor requires a second identical test pass.

## Phase 1 — Map behavior and implementation connections

Establish the repository/branch/revision and relevant uncommitted changes, active modules, installed dependency versions, startup instructions, and available tests. For a whole-codebase request, inventory all active modules before prioritizing core flows and high-impact boundaries. Distinguish mapped modules from deeply reviewed files; do not claim exhaustive coverage from a sample. Generated/vendor code does not need line-by-line review unless it is relevant evidence.

For each selected user goal, trace the applicable chain:

```text
Screen entry or route
  -> visible action and its enabled/disabled conditions
  -> event handler and component/Hook/store state
  -> service/API call or local-storage operation
  -> backend/storage processing, where applicable
  -> response/error handling and cache/state update
  -> visible result
  -> reopen/reload/restart outcome when persistence is expected
```

Identify unreachable components, controls without handlers, mocks or placeholders on a real path, contracts that do not match, state ownership conflicts, and unfinished failure paths. A symbol existing, a TODO, or a successful build alone does not establish that a feature works or is missing. Follow callers, routes, feature flags, and alternative paths before claiming an implementation is absent. Separate dead historical code from a currently promised capability.

Keep a compact working map: **flow, expected outcome and its source, relevant files/contracts, static evidence, runtime coverage**. The map is an investigation aid, not a demand for a long report on every file.

## Phase 2 — Review code and verify actual behavior

Inspect relevant correctness, state ownership, asynchronous ordering, error handling, public API compatibility, and responsibility boundaries. Tie structural recommendations to an observed defect or a concrete maintenance risk; do not recommend a rewrite because of code age, the model that wrote it, line counts, or personal style alone.

Use a real browser for requested UI/UX validation when the environment permits. Start with a normal user journey, then exercise relevant transitions and failure cases. Read console/network output, inspect the responsible code, or run focused tests to explain observations. A rendered control is not proof of a working action; an API success is not proof of persistence. Record both what was observed and what was inferred.

### Safe execution and evidence

- Confirm the environment before actions that write data. Use disposable notes, a dedicated test account/profile, or an isolated data store. Do not delete, overwrite, or reset real notes, credentials, volumes, or an existing user session to make a test easier. Cleanup must target only artifacts created by the review.
- Use existing local startup and test commands where safe and authorized. Do not install a test library, bypass a failed check, upgrade packages, expose a server, or start new paid/external data flows solely to finish the review. Avoid real notifications or other external side effects; ask only for a genuinely required permission or use a safe test substitute.
- Mark mocked responses, seeded state, injected failures, and browser/API-only evidence explicitly. Do not report end-to-end success from a mock, or infer real data persistence from a toast or a local cache. Use the real local backend/storage path when making a persistence claim.
- If startup, credentials, browser access, or a dependency blocks execution, record the actual blocker and continue independent static/test work. Do not silently fix the environment or claim runtime verification. Run the smallest relevant checks; repeat them only after changes or unresolved concerns.
- Parallel code inspection may use independent feature areas. Shared browser sessions and mutable test data need one owner; otherwise use explicitly isolated sessions/data. Hand off scope, constraints, evidence, and remaining questions, not just another agent's verdict.

### Select relevant scenarios, not every scenario for every task

| Area | Examples to inspect and exercise |
| --- | --- |
| Notes and draft persistence | Rapid final input followed by close; reopen/reload; save versus delete; failed or delayed writes; outdated responses; restart when durable persistence is claimed. |
| Editing and navigation | Korean IME composition, undo/redo, paste, asynchronous initial content, switching notes, unsaved changes, keyboard focus, Escape, and back navigation. |
| Search and selection | Query changes after selection; hidden selections; bulk delete targets; clear/reset; empty versus failed results; pagination; response arrival out of order. |
| Panels, graph, and shared state | Open/close/resize; focus return; keyboard reachability; graph selection/highlighting after rendering pauses; synchronization between list, editor, and graph. |
| Visible UX | Loading/error/empty/success states; disabled-action explanations; long titles and overflow; supported window sizes and zoom; focus visibility, labels, and access to important actions. |
| Local startup and AI/API boundaries | Missing configuration or unavailable backend/provider; timeout/cancel/retry; clear failure versus no evidence; source links opening the correct note; only authorized data leaving the machine. |

These are review candidates, not assertions of current defects or authorization to add features. Include other flows promised by the current application rather than limiting the review to this example list. Do not infer full accessibility conformance from a visual or keyboard spot check.

## Phase 3 — Classify findings and report coverage

Use the four categories below. Keep category, user impact, and verification status separate. Report a primary category once and reference related symptoms instead of duplicating the same root cause.

| Category | Required basis |
| --- | --- |
| **Reproduced defect — 재현된 결함** | A user-observable failure reproduced in the running application, or a deterministic failing test that establishes a specific defect. State whether it was browser- or test-reproduced; a mocked unit test does not prove a live UI failure. |
| **Implementation/connection gap — 구현·연결 누락** | A current requirement or visible promise exists, and the relevant route/handler/service path is absent, unreachable, or incomplete. Give evidence for both expectation and gap. Static evidence is acceptable, but mark untested runtime behavior. |
| **Code-level risk / unverified candidate — 코드상 위험·미검증 후보** | A concrete suspicious path or structural risk exists, but its failure or applicability has not been established. Explain the condition, evidence, uncertainty, and next check; do not promote it to a reproduced defect. |
| **UX improvement proposal — UX 개선 제안** | The flow works as currently specified, but a specific interaction, explanation, or layout could be improved. Separate the observation from preference and describe the benefit/trade-off. A verified inability to complete a promised task belongs under defect or gap, not merely polish. |

Missing evidence is not evidence of absence. Feature ideas unsupported by a current requirement are proposals, not gaps. A build/type/lint pass cannot close a UI finding; a screenshot cannot establish storage correctness. Code conventions can justify a relevant risk or maintenance finding, but not an invented runtime failure.

### Finding record

Keep each entry as short as its evidence permits:

```text
ID / title:
Category / impact (high, medium, low) / verification status:
Affected flow and environment:
Expected behavior and source:
Reproduction steps OR static evidence and the missing runtime check:
Actual observation and user impact:
Relevant file:line ranges, test output, request, screenshot, or trace:
Suggested correction or decision, plus the focused regression check:
```

Use only real file locations and artifacts. Say when a suspected cause is unconfirmed. Redact personal data and credentials from screenshots, logs, and reports. Assess impact from data loss, unintended actions, blocked tasks, misleading results, or recoverability; do not assign high severity just because a file is large or old.

### Final report and stopping rules

- Lead with substantive defects and gaps, ordered by user impact. Keep risks and UX proposals clearly separate. Do not invent a quota of findings or repeat generic best practices without application evidence.
- Summarize scope/revision, flows and files inspected, checks actually run and results, and coverage as **runtime/test checked, static-only, blocked, not reviewed, or out of scope**. Be precise about mocked versus real execution and browser versus test evidence. An unreviewed area is a coverage limitation, not automatically a defect.
- If nothing was found, say "no defects found in the checked scope" and name that scope and its limitations; do not declare the entire application correct. Report actual blockers and the next check needed rather than imply promised future background work.
- Record unresolved product decisions without silently changing features, data-loss policies, architecture, or the authorized scope. When fixes are authorized, preserve the original evidence, re-run the relevant reproduction/regression path after the change, and update the finding. Do not rerun the entire audit without new changes or unresolved concerns.
- Keep the user's answer concise. Use a separate detailed report only when requested or when the task genuinely needs a durable artifact, following existing repository conventions rather than creating a new reporting system by default.
