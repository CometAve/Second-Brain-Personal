# Manual request lifecycles

Use this reference when an existing component or Hook owns a request directly and input changes or unmounting can make its response obsolete. Keep frontend TanStack Query requests in their existing data layer; this example is not a reason to replace caching with a custom fetching Hook.

For delayed writes, save acknowledgement, delete, or navigation with unsaved work, use [save lifecycles](../../state-management/references/save-lifecycle.md). Cancelling transport or ignoring a response does not undo an accepted write or decide whether an unsaved draft may be discarded. For work that can outlive login/logout, also use [session ownership](../../state-management/references/session-data-boundaries.md).

## Contract and scope

The illustrative loader returns an already validated preview and may honor `AbortSignal`. The UI callbacks are non-throwing state updates. `begin` clears old feedback and marks the new request pending. These names do not define the repository's note API.

```ts
type Preview = { title: string };
type PreviewRequest = {
  noteId: string;
  load: (noteId: string, signal: AbortSignal) => Promise<Preview>;
  begin: () => void;
  commit: (preview: Preview) => void;
  report: (error: unknown) => void;
  finish: () => void;
};
```

## Incorrect: guard success, but let stale failure and completion update the UI

```ts
export function startPreviewRequest(input: PreviewRequest): () => void {
  let current = true;
  const controller = new AbortController();
  input.begin();
  void (async () => {
    try {
      const preview = await input.load(input.noteId, controller.signal);
      if (current) input.commit(preview);
    } catch (error: unknown) {
      input.report(error);
    } finally {
      input.finish();
    }
  })();
  return () => {
    current = false;
    controller.abort();
  };
}
```

After request A is replaced by B, A can still clear B's loading indicator or show A's error. An abort may itself reject the loader; cancellation alone does not prevent these callbacks.

## Correct: bind every completion path to the same request lifetime

```ts
export function startPreviewRequest(input: PreviewRequest): () => void {
  let current = true;
  const controller = new AbortController();
  input.begin();
  void (async () => {
    try {
      const preview = await input.load(input.noteId, controller.signal);
      if (current) input.commit(preview);
    } catch (error: unknown) {
      if (current) input.report(error);
    } finally {
      if (current) input.finish();
    }
  })();
  return () => {
    current = false;
    controller.abort();
  };
}
```

An Effect can own the cleanup as follows. The helper above is module-level; the passed functions participate in dependencies, so unstable callback identities can restart the request. Do not hide them in refs solely to silence dependency warnings.

```ts
import { useEffect } from 'react';

export function usePreviewRequest({ noteId, load, begin, commit, report, finish }: PreviewRequest) {
  useEffect(
    () => startPreviewRequest({ noteId, load, begin, commit, report, finish }),
    [noteId, load, begin, commit, report, finish],
  );
}
```

React cleans up the prior Effect before setting up its replacement. Each setup gets its own flag; a shared `isMounted` flag does not distinguish old and new requests while the component stays mounted. Aborting saves work only when the loader honors it; the flag also protects against a late completion when it does not.

This is a read-request example. Aborting or ignoring a write does not undo server-side persistence. Event-triggered overlapping requests need their own ownership/generation policy; do not assume Effect cleanup covers them.

## Observable checks

- Start A, clean it up, and start B. Resolve or reject A while B is pending: B's data, error, and pending state must remain intact.
- Let the current request fail: expose that failure and end its pending state. Do not replace it with a successful empty result.
- Clean up before completion: neither success, error, nor finalization callbacks may update that old view.
- Exercise setup → cleanup → setup, as development Strict Mode can do. Treat this as lifecycle verification, not a performance measurement.

Checked against React/types **19.3.0**, TypeScript **6.0.3**, and the installed Hooks lint plugin **7.1.1**. [React Effect lifecycle](https://react.dev/reference/react/useEffect#parameters) and [manual-fetching race conditions](https://react.dev/reference/react/useEffect#fetching-data-with-effects) establish the cleanup boundary; the error/finally cases above make that boundary explicit for this project's manual-request paths.
