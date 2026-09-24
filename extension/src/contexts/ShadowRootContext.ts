import { createContext, useContext } from 'react';

/**
 * Shadow Root Context
 * - Shadow DOM 내부에서 Portal을 올바른 위치에 렌더링하기 위해 사용
 */

export const ShadowRootContext = createContext<ShadowRoot | HTMLElement | null>(null);

export function useShadowRoot() {
  return useContext(ShadowRootContext);
}
