import type { TFunction } from 'i18next';
import i18n from '@/src/i18n';
import {
  discoveryDirection,
  multiplierValue,
  dirLabel,
  discoveryProof,
  discoverySentence,
  categoryLabel,
} from '../discoveryDisplay';

/** The real whenbee-namespace translator (jest.setup initializes i18n in English). */
const tr = i18n.getFixedT(null, 'whenbee') as TFunction<'whenbee'>;

test('direction: M >= 1 is longer, M < 1 is faster, M === 1 is longer', () => {
  expect(discoveryDirection(1.6)).toBe('longer');
  expect(discoveryDirection(2.3)).toBe('longer');
  expect(discoveryDirection(0.6)).toBe('faster');
  expect(discoveryDirection(1)).toBe('longer');
});

test('multiplierValue formats to one decimal, no times suffix', () => {
  expect(multiplierValue(1.6)).toBe('1.6');
  expect(multiplierValue(2)).toBe('2.0');
  expect(multiplierValue(0.6)).toBe('0.6');
});

test('dirLabel is the uppercase word', () => {
  expect(dirLabel('longer', tr)).toBe('LONGER');
  expect(dirLabel('faster', tr)).toBe('FASTER');
});

test('proof line uses the 15m baseline and the right verb', () => {
  expect(discoveryProof(24, 'longer', tr)).toBe('You plan 15m · really runs ~24m');
  expect(discoveryProof(9, 'faster', tr)).toBe('You plan 15m · really only ~9m');
});

test('featured sentence uses the 15m baseline and the right verb', () => {
  expect(discoverySentence(24, 'longer', tr)).toBe(
    'You plan 15 minutes. It really takes about 24.',
  );
  expect(discoverySentence(9, 'faster', tr)).toBe(
    'You plan 15 minutes. It really takes only about 9.',
  );
});

test('categoryLabel localizes a built-in id, else title-cases the slug', () => {
  expect(categoryLabel('admin')).toBe('Admin & email');
  expect(categoryLabel('deep_work')).toBe('Deep Work');
});

test('a Swedish user reads a Swedish category name', async () => {
  await i18n.changeLanguage('sv');
  try {
    expect(categoryLabel('admin')).toBe('Admin & mejl');
    expect(categoryLabel('deep_work')).toBe('Deep Work');
  } finally {
    await i18n.changeLanguage('en');
  }
});
