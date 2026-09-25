# Effect dependencies and Effect Events

Use this reference when considering `useEffectEvent` to read fresh values without reconnecting an external subscription. The key decision is which changes require resynchronization, not how to shorten the dependency array.

## API boundary

Use `useEffectEvent` only for non-reactive logic that belongs to an Effect. It reads the latest committed values. Calls may come from the local Effect, another local Effect Event, or a callback registered by that Effect, such as a timer or native event listener. Do not call an Effect Event during render or from a JSX UI event handler, or pass it to another component or Hook.

The returned function does not have a stable identity and must be omitted from dependency arrays. Keep values that should resynchronize the Effect as ordinary dependencies; this API is not a dependency-avoidance mechanism. [useEffectEvent](https://react.dev/reference/react/useEffectEvent)

## Illustrative subscription contract

```ts
import { useEffect, useEffectEvent } from 'react';

type SubscriptionOptions = {
  sourceId: string;
  theme: 'light' | 'dark';
  subscribe: (sourceId: string, listener: (message: string) => void) => () => void;
  notify: (message: string, theme: 'light' | 'dark') => void;
};
```

Here, changing `sourceId` or the subscription implementation must disconnect the previous subscription and connect the new one. Changing `theme` or the notification callback only affects later notifications. The supplied cleanup must remove the old listener; this is an illustrative contract, not an existing repository service.

## Incorrect: hide the subscription inputs in an Effect Event

```ts
export function useSourceNotifications({ sourceId, theme, subscribe, notify }: SubscriptionOptions) {
  const connectLatest = useEffectEvent(() =>
    subscribe(sourceId, (message) => notify(message, theme)),
  );
  useEffect(() => connectLatest(), []);
}
```

The Effect never reruns when `sourceId` changes. Reading the latest values when `connectLatest` is called does not arrange another call or make its registered listener refresh automatically. Type/lint acceptance does not prove that these product-level dependency choices are correct.

## Correct: keep subscription inputs reactive and notification formatting non-reactive

```ts
export function useSourceNotifications({ sourceId, theme, subscribe, notify }: SubscriptionOptions) {
  const onMessage = useEffectEvent((message: string) => {
    notify(message, theme);
  });
  useEffect(
    () => subscribe(sourceId, (message) => onMessage(message)),
    [sourceId, subscribe],
  );
}
```

The callback registered by this local Effect invokes the Effect Event. On the next notification it reads the latest committed `theme` and `notify`, while `sourceId`/`subscribe` changes resynchronize the subscription. Do not pass `onMessage` to another component or Hook, call it from a JSX event handler, or add it to the dependency array: React 19.3 Effect Events do not have stable identities.

Use an ordinary reactive Effect if the changed value should reconfigure the external system. For example, a theme value used to configure a third-party renderer belongs in that renderer's synchronization dependencies. An ordinary UI event handler usually needs no Effect Event.

## Observable checks and version evidence

- Change only the theme, then deliver a message: retain the subscription and use the new theme.
- Change the source: remove the previous listener and subscribe to the new source.
- Unmount: remove the listener. If the underlying service can queue work after unsubscribe, handle that lifetime in the subscription adapter.

Checked against React/types **19.3.0** and Hooks lint plugin **7.1.1**. The official [useEffectEvent reference](https://react.dev/reference/react/useEffectEvent) distinguishes latest committed values, local Effect-owned calls, unstable identity, and genuine reactive dependencies. These examples preserve those distinctions; they do not claim that every subscription needs this API.
