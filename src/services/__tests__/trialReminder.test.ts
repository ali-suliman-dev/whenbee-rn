import { trialReminderDate, trialChargeDate } from '../trialReminder';

describe('trial reminder dates', () => {
  it('reminder lands 5 days after purchase at 10:00 local', () => {
    const purchased = new Date(2026, 6, 19, 18, 42, 13); // Jul 19, 18:42:13 local
    const reminder = trialReminderDate(purchased);
    expect(reminder.getFullYear()).toBe(2026);
    expect(reminder.getMonth()).toBe(6);
    expect(reminder.getDate()).toBe(24);
    expect(reminder.getHours()).toBe(10);
    expect(reminder.getMinutes()).toBe(0);
    expect(reminder.getSeconds()).toBe(0);
  });

  it('reminder rolls across month ends', () => {
    const purchased = new Date(2026, 0, 29, 9, 0, 0); // Jan 29
    const reminder = trialReminderDate(purchased);
    expect(reminder.getMonth()).toBe(1); // Feb
    expect(reminder.getDate()).toBe(3);
    expect(reminder.getHours()).toBe(10);
  });

  it('charge date is exactly 7 days after purchase, same wall time', () => {
    const purchased = new Date(2026, 6, 19, 18, 42, 13);
    const charge = trialChargeDate(purchased);
    expect(charge.getDate()).toBe(26);
    expect(charge.getMonth()).toBe(6);
    expect(charge.getHours()).toBe(18);
  });

  it('does not mutate the input date', () => {
    const purchased = new Date(2026, 6, 19, 12, 0, 0);
    const before = purchased.getTime();
    trialReminderDate(purchased);
    trialChargeDate(purchased);
    expect(purchased.getTime()).toBe(before);
  });
});
