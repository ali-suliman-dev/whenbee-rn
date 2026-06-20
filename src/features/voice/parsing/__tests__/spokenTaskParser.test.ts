import { parseSpokenTask } from '../spokenTaskParser';

describe('parseSpokenTask (Tier-1 rules)', () => {
  it('strips a leading preamble and capitalizes', () => {
    const d = parseSpokenTask('i need to reply to the henderson emails');
    expect(d.title).toBe('Reply to the henderson emails');
    expect(d.source).toBe('rules');
    expect(d.rawTranscript).toBe('i need to reply to the henderson emails');
  });

  it('handles "remind me to" preamble', () => {
    expect(parseSpokenTask('remind me to call the dentist').title).toBe('Call the dentist');
  });

  it('drops filler words mid-sentence', () => {
    expect(parseSpokenTask('um just basically tidy the kitchen').title).toBe('Tidy the kitchen');
  });

  it('keeps only the first clause for a single task', () => {
    expect(parseSpokenTask('clean the desk and then email sarah').title).toBe('Clean the desk');
  });

  it('caps an over-long ramble at the word limit', () => {
    const d = parseSpokenTask('write the very long detailed report about quarterly sales numbers for the board');
    expect(d.title.split(' ').length).toBeLessThanOrEqual(8);
  });

  it('returns empty title for empty/garbage input without throwing', () => {
    expect(parseSpokenTask('   ').title).toBe('');
    expect(parseSpokenTask('um uh erm').title).toBe('');
  });

  it('leaves an already-clean imperative untouched (besides capitalization)', () => {
    expect(parseSpokenTask('book a flight').title).toBe('Book a flight');
  });
});
