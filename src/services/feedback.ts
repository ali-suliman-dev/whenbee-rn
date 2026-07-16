import { Platform } from 'react-native';
import { nativeApplicationVersion } from 'expo-application';
import { getLocales } from 'expo-localization';
import { getFeedbackClient } from './feedbackClient';
import { getInstallId } from '@/src/features/feedback/installId';
import { enqueue, readQueue, writeQueue, type SubmissionPayload } from '@/src/features/feedback/queue';
import type { FeedbackInput, ChangelogEntry } from '@/src/features/feedback/types';

const MAX_ATTEMPTS = 3;

function buildPayload(input: FeedbackInput): SubmissionPayload {
  return {
    kind: input.kind,
    category: input.category ?? null,
    body: input.body,
    install_id: getInstallId(),
    app_version: nativeApplicationVersion ?? null,
    os: Platform.OS,
    locale: getLocales()[0]?.languageTag ?? null,
  };
}

async function tryInsert(payload: SubmissionPayload): Promise<boolean> {
  const client = getFeedbackClient();
  if (!client) return false;
  const { error } = await client.from('feedback_submissions').insert(payload);
  return !error;
}

async function insertWithRetry(payload: SubmissionPayload): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (await tryInsert(payload)) return true;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, attempt * 400));
    }
  }
  return false;
}

/** Fire-and-forget. Optimistic UI has already confirmed; never throws. */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const payload = buildPayload(input);
  const ok = await insertWithRetry(payload);
  if (!ok) enqueue(payload);
}

export async function fetchChangelog(): Promise<ChangelogEntry[]> {
  const client = getFeedbackClient();
  if (!client) return [];
  const { data, error } = await client
    .from('feedback_changelog')
    .select('id,status,title,body,published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    status: r.status as ChangelogEntry['status'],
    title: String(r.title),
    body: String(r.body),
    publishedAt: String(r.published_at),
  }));
}

/** Best-effort drain; keeps anything still failing in the queue. */
export async function drainQueue(): Promise<void> {
  const items = readQueue();
  if (items.length === 0) return;
  const remaining: SubmissionPayload[] = [];
  for (const item of items) {
    const ok = await tryInsert(item);
    if (!ok) remaining.push(item);
  }
  writeQueue(remaining);
}
