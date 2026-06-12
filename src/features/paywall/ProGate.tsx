import { type ReactNode } from 'react';
import { useEntitlement } from './useEntitlement';
export function ProGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const isPro = useEntitlement((s) => s.isPro);
  return <>{isPro ? children : fallback}</>;
}
