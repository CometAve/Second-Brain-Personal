# Extension message guards

Read this when changing an extension runtime/window-message boundary or a type predicate over `unknown`. The extension has no direct Zod dependency. The examples use TypeScript 6.0.3 with the extension's strict ES2022 configuration and add no library.

## Claim only the fields actually checked

An explicit type predicate can compile while lying about its payload. The fictional `USER_PREVIEW` message below illustrates the failure; it is **not** the repository's message protocol or `UserInfo` type.

Shared illustrative contract:

```ts
type UserPreviewMessage = {
  type: 'USER_PREVIEW';
  user: { id: number; displayName: string };
};
```

**Incorrect: checking a tag does not validate `user`.**

```ts
export function isUserPreviewWrong(input: unknown): input is UserPreviewMessage {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    input.type === 'USER_PREVIEW'
  );
}
```

This accepts `{ type: 'USER_PREVIEW', user: null }`, yet lets the caller dereference `input.user.displayName`. A successful typecheck is not evidence that the predicate is truthful.

**Correct: check the entire claimed payload, including null and primitive cases.**

```ts
export function isUserPreviewMessage(input: unknown): input is UserPreviewMessage {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  if (!('type' in input) || input.type !== 'USER_PREVIEW' || !('user' in input)) return false;

  const user = input.user;
  return (
    typeof user === 'object' &&
    user !== null &&
    !Array.isArray(user) &&
    'id' in user &&
    typeof user.id === 'number' &&
    'displayName' in user &&
    typeof user.displayName === 'string'
  );
}
```

| Input | Expected result |
| --- | --- |
| `null`, a primitive, `[]`, or `{}` | `false`, without throwing |
| `{ type: 'USER_PREVIEW' }` or a null/partial `user` | `false` |
| `{ type: 'USER_PREVIEW', user: { id: '1', displayName: 'Example' } }` | `false` |
| `{ type: 'USER_PREVIEW', user: { id: 1, displayName: 'Example' } }` | `true`; both user fields can be read |

This example checks a structural `number`, not a positive integer or a known account ID. Add domain constraints only when the real contract requires them. If the caller needs only a tag, narrow to a tag-only type instead of promising a complete payload. For example, the repository's `AUTH_CHANGED` notification in [useExtensionAuth.ts](../../../../extension/src/hooks/useExtensionAuth.ts) triggers a refetch and does not require an invented `user` field; validating a `CHECK_AUTH` response requires checking the actual response and [UserInfo](../../../../extension/src/types/auth.ts) fields. [Type predicates and narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

## Shape validation does not authorize a sender

Keep transport trust checks separate from payload guards. Preserve applicable runtime sender/tab/frame checks and `window.message` source/origin restrictions when changing a handler; a valid object must not expand which senders can trigger privileged actions. Same-page `postMessage` data can be produced by page scripts, so a matching source/origin does not by itself identify an extension sender. Follow the actual message contract rather than inserting an arbitrary origin or treating the example guard as an authorization check. [Chrome message security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations), [postMessage sender and syntax checks](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns)

When adapting the example, test null, primitives, a valid tag with invalid nested fields, and a valid payload. Also verify the real message's response/no-response and sender rules; these standalone guards do not test Chrome delivery, listener lifecycle, or authorization.
