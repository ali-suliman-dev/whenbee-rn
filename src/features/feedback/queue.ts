import { kv } from '@/src/lib/kv';
import type { FeedbackKind } from './types';

const KEY = 'feedback.queue';

export type SubmissionPayload = {
  kind: FeedbackKind;
  category: string | null;
  body: string;
  install_id: string;
  app_version: string | null;
  os: string | null;
  locale: string | null;
};

export function readQueue(): SubmissionPayload[] {
  const raw = kv.getString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SubmissionPayload[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(items: SubmissionPayload[]): void {
  kv.set(KEY, JSON.stringify(items));
}

export function enqueue(p: SubmissionPayload): void {
  writeQueue([...readQueue(), p]);
}
