import { parseSpokenTask } from '../spokenTaskParser';

describe('parseSpokenTask (Tier-1 rules)', () => {
  it('strips a leading preamble and capitalizes', () => {
    const d = parseSpokenTask('i need to reply to the henderson emails', 'en');
    expect(d.title).toBe('Reply to the henderson emails');
    expect(d.source).toBe('rules');
    expect(d.rawTranscript).toBe('i need to reply to the henderson emails');
  });

  it('handles "remind me to" preamble', () => {
    expect(parseSpokenTask('remind me to call the dentist', 'en').title).toBe('Call the dentist');
  });

  it('drops filler words mid-sentence', () => {
    expect(parseSpokenTask('um just basically tidy the kitchen', 'en').title).toBe('Tidy the kitchen');
  });

  it('keeps only the first clause for a single task', () => {
    expect(parseSpokenTask('clean the desk and then email sarah', 'en').title).toBe('Clean the desk');
  });

  it('caps an over-long ramble at the word limit', () => {
    const d = parseSpokenTask('write the very long detailed report about quarterly sales numbers for the board', 'en');
    expect(d.title.split(' ').length).toBeLessThanOrEqual(8);
  });

  it('returns empty title for empty/garbage input without throwing', () => {
    expect(parseSpokenTask('   ', 'en').title).toBe('');
    expect(parseSpokenTask('um uh erm', 'en').title).toBe('');
  });

  it('leaves an already-clean imperative untouched (besides capitalization)', () => {
    expect(parseSpokenTask('book a flight', 'en').title).toBe('Book a flight');
  });

  it('strips a Swedish preamble', () => {
    expect(parseSpokenTask('jag måste ringa tandläkaren', 'sv').title).toBe('Ringa tandläkaren');
  });

  it('drops Swedish filler', () => {
    expect(parseSpokenTask('eh typ boka bord', 'sv').title).toBe('Boka bord');
  });

  it('unknown locale keeps the raw first clause (no English rules applied)', () => {
    // must NOT strip "jag måste" using the English table
    expect(parseSpokenTask('jag måste ringa', 'de').title).toBe('Jag måste ringa');
  });

  it('still strips English preamble for en', () => {
    expect(parseSpokenTask('i need to email bob', 'en').title).toBe('Email bob');
  });
});
