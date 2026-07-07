import {
  bufferToHourMinute,
  isValidBuffer,
  pushDigit,
  popDigit,
  bufferFromHourMinute,
  formatBuffer,
} from '../timeKeypad';

describe('timeKeypad', () => {
  describe('bufferToHourMinute', () => {
    it('returns null for an empty buffer', () => {
      expect(bufferToHourMinute('')).toBeNull();
    });

    it('left-pads a partial buffer (9 → 00:09)', () => {
      expect(bufferToHourMinute('9')).toEqual({ hour: 0, minute: 9 });
    });

    it('parses a full 4-digit buffer (1347 → 13:47)', () => {
      expect(bufferToHourMinute('1347')).toEqual({ hour: 13, minute: 47 });
    });

    it('parses midnight (0000 → 00:00)', () => {
      expect(bufferToHourMinute('0000')).toEqual({ hour: 0, minute: 0 });
    });

    it('parses the last valid minute (2359 → 23:59)', () => {
      expect(bufferToHourMinute('2359')).toEqual({ hour: 23, minute: 59 });
    });

    it('rejects an out-of-range hour (2500)', () => {
      expect(bufferToHourMinute('2500')).toBeNull();
    });

    it('rejects an out-of-range minute (0099)', () => {
      expect(bufferToHourMinute('0099')).toBeNull();
    });
  });

  describe('pushDigit', () => {
    it('appends a digit', () => {
      expect(pushDigit('', '1')).toBe('1');
      expect(pushDigit('1', '0')).toBe('10');
    });

    it('builds a full time left-to-right (1 0 4 7 → 1047)', () => {
      let b = '';
      for (const d of ['1', '0', '4', '7']) b = pushDigit(b, d);
      expect(b).toBe('1047');
      expect(bufferToHourMinute(b)).toEqual({ hour: 10, minute: 47 });
    });

    it('rolls the window when the shifted result is a valid time (1230 + 5 → 2305)', () => {
      expect(pushDigit('1230', '5')).toBe('2305');
    });

    it('rejects a roll that would make an invalid time (1047 + 5 → 04:75 invalid, unchanged)', () => {
      expect(pushDigit('1047', '5')).toBe('1047');
    });

    it('rejects a digit that would make an invalid time (00:9 + 9 → stays 9)', () => {
      // '9' → 00:09 valid; appending '9' → '99' → 00:99 invalid, so unchanged.
      expect(pushDigit('9', '9')).toBe('9');
    });

    it('rejects a fourth digit that overflows the hour (250 + 0 → stays 250)', () => {
      // '250' → 02:50 valid; '2500' → 25:00 invalid, so the digit is dropped.
      expect(pushDigit('250', '0')).toBe('250');
    });

    it('ignores non-digit input', () => {
      expect(pushDigit('12', 'a')).toBe('12');
      expect(pushDigit('12', '')).toBe('12');
    });
  });

  describe('popDigit', () => {
    it('removes the last digit', () => {
      expect(popDigit('1047')).toBe('104');
      expect(popDigit('1')).toBe('');
    });

    it('is a no-op on an empty buffer', () => {
      expect(popDigit('')).toBe('');
    });
  });

  describe('bufferFromHourMinute', () => {
    it('seeds a 4-digit buffer from a time', () => {
      expect(bufferFromHourMinute({ hour: 9, minute: 5 })).toBe('0905');
      expect(bufferFromHourMinute({ hour: 13, minute: 47 })).toBe('1347');
    });

    it('round-trips through bufferToHourMinute', () => {
      const hm = { hour: 7, minute: 3 };
      expect(bufferToHourMinute(bufferFromHourMinute(hm))).toEqual(hm);
    });
  });

  describe('formatBuffer', () => {
    it('formats with leading zeros', () => {
      expect(formatBuffer('9')).toBe('00:09');
      expect(formatBuffer('1347')).toBe('13:47');
      expect(formatBuffer('')).toBe('00:00');
    });
  });

  describe('isValidBuffer', () => {
    it('mirrors bufferToHourMinute nullability', () => {
      expect(isValidBuffer('1347')).toBe(true);
      expect(isValidBuffer('2500')).toBe(false);
      expect(isValidBuffer('')).toBe(false);
    });
  });
});
