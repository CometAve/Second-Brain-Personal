---
name: project-verification
description: Select checks and completion evidence for Second Brain Personal changes. Use for web or extension validation, browser regression checks, and reviews of whether project instructions were applied.
---

# Verify the changed behavior

Identify what changed and where it could fail, then choose checks that cover those boundaries. Passing type checks, lint, or a build does not establish that a user workflow works.

## Select checks

Run commands in `frontend/secondbrain` for the web app or `extension` for the extension. Check that module's `.nvmrc` and `package.json` `packageManager`; the verified project baseline is Node 26.10.0 / pnpm 12.6.0.

| Change | Relevant checks |
| --- | --- |
| TS/TSX logic, types, or imports | `pnpm typecheck`, `pnpm lint`; also `pnpm build` when bundling, configuration, or assets may be affected |
| Dependencies, lockfile, or build configuration | `pnpm install --frozen-lockfile --strict-peer-dependencies`, then typecheck, lint, and build |
| Documentation or skills only | Check links, paths, version evidence, actual scripts, and realistic application cases; do not require a full build or introduce a test framework |
| Formatting | `pnpm exec prettier --check <files>` for changed files, or `pnpm format:check` when the whole module is in scope |
| UI behavior, layout, navigation, input, or persistence | Add [browser checks](references/browser-checks.md); static checks are sufficient for a wording correction that does not affect behavior or layout |

The current `build` script runs `tsc -b && vite build`. Do not repeat a sufficient check without a new change, failure, or unresolved concern. `lint:fix` and `format` modify files; distinguish them from checks. The frontend projects currently have no Vitest/RTL/MSW setup or `test` script; do not invoke them as if they existed.

For backend, AI, or MCP changes, first consult the relevant [backend](../../../backend/secondbrain/README.md), [AI](../../../knowledge-graph-service/README.md), or [MCP](../../../agent-MCP/README.md) README and actual test dependencies.

## Assess failures and completion

- Do not turn errors into normal empty results, add type assertions, exclude checks, disable rules, or reduce severity merely to obtain a passing result. Preserve the error meaning of an explicitly requested fallback. Explain the reason and scope of a necessary, narrow compatibility exception.
- Determine whether a failure comes from the change, the existing code, or the environment. Report unresolved failures and checks you could not run; distinguish existing warnings from new defects without hiding either.
- Prefer a reproducible case and an observable result over tests that duplicate the implementation. Cover relevant failure, cancellation, and overlapping-request behavior.
- The active hook described in [commit conventions](../../../docs/commit-conventions.md) is `commit-msg`. A valid commit message does not prove code validation. Do not activate the inactive module `.husky` hooks automatically.
- Report the changed behavior, checks actually run and their results, user workflows exercised, and remaining limits. Synthetic-response success is not evidence of live OAuth, backend, or LLM integration.
