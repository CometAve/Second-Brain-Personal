import { ShadowRootContext } from './ShadowRootContext';

interface ShadowRootProviderProps {
  children: React.ReactNode;
  shadowRoot: ShadowRoot | HTMLElement;
}

export function ShadowRootProvider({ children, shadowRoot }: ShadowRootProviderProps) {
  return <ShadowRootContext.Provider value={shadowRoot}>{children}</ShadowRootContext.Provider>;
}
