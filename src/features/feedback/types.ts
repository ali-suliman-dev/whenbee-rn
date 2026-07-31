export type FeedbackKind = 'idea' | 'problem' | 'love';

export interface FeedbackInput {
  kind: FeedbackKind;
  category?: string;
  body: string;
}

export interface ChangelogEntry {
  id: string;
  status: 'shipped' | 'planned';
  title: string;
  body: string;
  publishedAt: string; // ISO timestamp
}
