import { ShadowRootContext } from './ShadowRootContext';

interface ShadowRootProviderProps {
  children: React.ReactNode;
  shadowRoot: ShadowRoot | HTMLElement;
}

export function ShadowRootProvider({ children, shadowRoot }: ShadowRootProviderProps) {
  return <ShadowRootContext value={shadowRoot}>{children}</ShadowRootContext>;
}
