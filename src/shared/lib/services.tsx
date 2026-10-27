import { createContext, useContext, type ReactNode } from 'react';
import type { Services } from '../../ports';

// Dependency injection for features: they ask for ports, never for adapters.
// Only app/ builds the Services (composition root) and passes them to <ServicesProvider>.
// Tests and stories can provide fakes the same way.

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('useServices() outside <ServicesProvider>');
  return s;
}
