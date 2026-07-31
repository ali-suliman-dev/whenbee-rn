import { create } from 'zustand';
import type { PendingAutoClose } from '@/src/domain/types';

// Ephemeral (NOT persisted): a forgotten session detected on foreground, waiting
// for the user to confirm/adjust/reopen via the ForgotCard. Cleared once resolved.
interface ForgotState {
  pending: PendingAutoClose | null;
  setPending: (p: PendingAutoClose) => void;
  clear: () => void;
}

export const useForgotStore = create<ForgotState>((set) => ({
  pending: null,
  setPending: (p) => set({ pending: p }),
  clear: () => set({ pending: null }),
}));
