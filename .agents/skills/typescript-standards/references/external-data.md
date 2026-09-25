# External data and Zod 4

## Scope

Use the relevant section when changing validation at an HTTP, URL, browser-storage, or message boundary, or handling client configuration and diagnostics. The web app directly depends on Zod **4.6.5** and TanStack Router **1.170.39**. The extension has no direct Zod dependency: use its existing guards and boundary validation, and do not import Zod merely because it appears as a transitive lockfile dependency.

## Validate at the boundary

- Start with `unknown` for values crossing a trust boundary. `axios.get<Result>()` and `JSON.parse(...) as Result` describe types without checking the actual data.
- Pass validated output into internal code. Parsing the same validated value in every component is unnecessary.
- For schemas that transform input, distinguish `z.input<typeof schema>` from `z.output<typeof schema>`; `z.infer` denotes the output type. [Zod input and output](https://zod.dev/basics#inferring-types)
- Do not turn `safeParse` failure into an empty list or a successful save. A default for a URL display preference has a different contract from silently replacing a malformed note response.
- Client validation supports UX and boundary contracts. It does not replace server-side authorization or ownership checks.

## Use the installed Zod 4 API

- Use `{ error: ... }` for new error customizations. Do not copy Zod 3 examples using `required_error`, `invalid_type_error`, or the `errorMap` parameter.
- Read failure details from `error.issues`. For form feedback, choose `z.flattenError` for a shallow schema or `z.treeifyError` for nested errors. Do not recommend the old instance `.format()`/`.flatten()` methods in new examples. [Error formatting](https://zod.dev/error-formatting)
- Prefer top-level string-format schemas such as `z.email()` and `z.uuid()` in new code. Existing `z.string().uuid()` remains supported but deprecated; documentation maintenance alone does not justify a codebase-wide rewrite. [Zod 4 migration guide](https://zod.dev/v4/changelog)

## Defaults, coercion, and URL contracts

- `.default()` returns an output default immediately for `undefined` input. Consider `.prefault()` when the fallback input itself must pass through parsing and transformations. Use `.catch()` only for an explicit recovery policy, because it can hide invalid input. [Defaults and prefaults](https://zod.dev/api#prefaults)
- `z.coerce.number()` follows JavaScript numeric conversion, including converting an empty string to `0`. Confirm that conversion matches the URL or form contract; do not apply coercion indiscriminately. [Coercion](https://zod.dev/api#coercion)
- TanStack Router accepts a Zod 4 schema directly as `validateSearch`; no Zod 3 adapter needs to be added for this integration. An existing parsing function is also acceptable when it preserves the intended contract. [TanStack Router search parameters](https://tanstack.com/router/latest/docs/guide/search-params#zod)

For URL-owned UI, retention/removal of search fields, and push/replace decisions, use [URL state and navigation history](../../react-patterns/references/state-and-identity.md#url-owned-state-and-navigation-history). Validating a URL value does not decide its state owner or Back/Forward behavior.

## Client configuration and sensitive diagnostics

Apply this section to both Vite apps when changing environment access, build-time injection, authentication diagnostics, or error logging. Runtime schema validation and TypeScript types do not make a value confidential.

- Treat client-exposed configuration as public. Both apps use Vite **8.3.0** with the default `VITE_` exposure prefix. Do not put server secrets, access/refresh tokens, private API keys, or client secrets in those variables or inject them through `define`, HTML replacement, or client source. A gitignored `.env.local`, minification, or a disabled source map does not hide a value included in the delivered app.
- Preserve public configuration such as a credential-free API base URL or an OAuth client ID when that protocol defines it as public. Distinguish a client ID from a client secret. A URL containing credentials or sensitive query data is not public merely because it is a URL. A variable's name alone does not determine whether its value can be exposed; do not move or remove working public configuration as a blanket security cleanup.
- Log a selected diagnostic summary appropriate to the failure, such as an operation name, error category, numeric status, and a non-secret correlation ID when available. Avoid whole authentication responses, tokens, API keys, private note bodies, and unrestricted request/response objects. Raw error objects, nested `cause`, and even error messages can contain sensitive URLs, headers, or payloads; do not assume serializing the error or choosing `message` automatically redacts it.
- Select or redact fields before passing them to the existing console/logger/telemetry boundary. Type assertions and replacing only the top-level token field do not sanitize nested data. Do not mutate the original error or change its success/failure meaning merely to make its log safe; preserve appropriate diagnostic categories and the caller's recovery behavior.
- Apply the same rule to development logs and copied usage examples when they can receive real data. Use synthetic placeholders to reproduce logging behavior, and check that useful failure information remains. Do not blanket-disable all error logs, install a logging framework, or expand external telemetry as part of an ordinary change.

| Example | Appropriate decision |
| --- | --- |
| A server API secret is stored as `VITE_SERVICE_SECRET` in `.env.local` | It is not protected from client exposure by the filename; keep the secret in the existing server-side boundary rather than shipping it. |
| An extension needs its public OAuth client ID and API origin | Retain the public configuration under the actual protocol contract; do not confuse it with a client secret. |
| A token exchange fails and the response/error includes nested credentials | Preserve a useful failure category/status while excluding the sensitive payload; logging the entire object or deleting all diagnostics are both inappropriate. |

Checked on 2026-09-25 against both manifests/lockfiles, `vite.config.ts`, `src/config/env.ts`, and installed Vite **8.3.0** environment-prefix/injection behavior. Review the [API-key Hook example](../../../../frontend/secondbrain/src/features/auth/hooks/useGenerateApiKey.ts) and [worker authentication diagnostics](../../../../extension/src/background/service-worker.ts) when those flows change; these are applicability targets, not a claim that a credential leak was reproduced. Sources: [Vite environment exposure](https://vite.dev/guide/env-and-mode#env-variables), [OWASP data to exclude from logs](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude), [OAuth client identifier](https://www.rfc-editor.org/rfc/rfc6749.html#section-2.2).

## Example: invalid data is different from a valid empty list

Use this frontend example when a list response can be either malformed or legitimately empty. This is an illustrative contract, not the repository's note/search API: adapt its envelope, identifier type, and required fields to the service being changed. The extension should use its existing guards instead of importing Zod for this example.

Shared illustrative schema:

```ts
import { z } from 'zod';

const noteSummariesSchema = z.array(
  z.object({
    id: z.int().positive(),
    title: z.string(),
  }),
);
```

**Incorrect: a malformed payload becomes a successful “no results” response.**

```ts
export function readNoteSummariesWrong(input: unknown) {
  const result = noteSummariesSchema.safeParse(input);
  return result.success ? result.data : [];
}
```

**Correct: return parsed data, and preserve validation failure for the caller.**

```ts
export function parseNoteSummaries(input: unknown) {
  const result = noteSummariesSchema.safeParse(input);
  if (!result.success) {
    throw new Error('Invalid note summary response', { cause: result.error });
  }
  return result.data;
}
```

For this synchronous schema, the installed Zod 4 `safeParse` result is discriminated by `success`; the failure branch contains `error`, and the success branch contains the parsed `data`. The caller must route the thrown validation failure to its existing error state; changing from thrown errors to a result union is a separate contract choice. An explicitly requested fallback may still supply an empty display value while retaining a distinct error status.

| Input | Expected result |
| --- | --- |
| `[]` | Successful empty list |
| `[{ id: 1, title: 'Example' }]` | Successful parsed list |
| `null`, a primitive, or `{}` | Validation failure |
| `[{ id: 1 }]` or `[{ id: '1', title: 'Example' }]` | Validation failure, not an empty list |

A mixed list with an invalid element also fails this schema; do not silently discard that element unless the actual API contract explicitly permits partial acceptance. [Zod parse and safeParse](https://zod.dev/basics#handling-errors)

`z.object` strips unknown keys by default. Include every field consumers need, or choose an explicit unknown-key policy appropriate to the boundary; do not accidentally discard fields by treating a partial schema as the complete response. [Object schemas](https://zod.dev/api#objects)

The manifest, lockfile, and installed Zod types/APIs were checked on 2026-09-24. This guidance does not require React Hook Form or a global form architecture change.
