import { render, screen } from '@testing-library/react';
import App, { campusLocalToUtc, getBookingWindowStatus, isValidDate, safeTimeZone } from './App';

test('renders the Northstar authentication screen', async () => {
  render(<App />);
  expect(await screen.findByText(/Sign in to Northstar/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
});

test('converts campus-local intervals to UTC and rejects invalid dates', () => {
  const start = campusLocalToUtc('2026-10-12', '09:00', 'Asia/Kolkata');
  expect(start.toISOString()).toBe('2026-10-12T03:30:00.000Z');
  const midnight = campusLocalToUtc('2026-10-12', '00:15', 'Asia/Kolkata');
  expect(midnight.toISOString()).toBe('2026-10-11T18:45:00.000Z');
  expect(isValidDate(start)).toBe(true);
  expect(isValidDate(new Date('not-a-date'))).toBe(false);
  expect(safeTimeZone('not/a-zone')).toBe('Asia/Kolkata');
});

test('keeps status and countdown consistent at booking boundaries', () => {
  const policy = { timezone: 'Asia/Kolkata', operating_days: [1, 2, 3, 4, 5], normal_submission_open_time: '09:00:00', normal_submission_close_time: '14:00:00' };
  const before = getBookingWindowStatus('normal', new Date('2026-10-12T03:29:59Z'), 'Asia/Kolkata', '2026-10-12', policy);
  const open = getBookingWindowStatus('normal', new Date('2026-10-12T03:30:00Z'), 'Asia/Kolkata', '2026-10-12', policy);
  const midday = getBookingWindowStatus('normal', new Date('2026-10-12T08:29:59Z'), 'Asia/Kolkata', '2026-10-12', policy);
  const closed = getBookingWindowStatus('normal', new Date('2026-10-12T08:30:00Z'), 'Asia/Kolkata', '2026-10-12', policy);
  expect(before.status).toBe('NOT OPEN');
  expect(before.countdownMs).toBeGreaterThan(0);
  expect(open.status).toBe('OPEN');
  expect(open.countdownMs).toBeNull();
  expect(midday.status).toBe('OPEN');
  expect(closed.status).toBe('CLOSED');
  expect(closed.countdownMs).toBe(19 * 60 * 60 * 1000);
});

test('skips weekend openings and schedules Monday in IST', () => {
  const policy = { timezone: 'Asia/Kolkata', operating_days: [1, 2, 3, 4, 5], normal_submission_open_time: '09:00:00', normal_submission_close_time: '14:00:00' };
  const saturday = getBookingWindowStatus('normal', new Date('2026-10-17T04:00:00Z'), 'Asia/Kolkata', '2026-10-17', policy);
  expect(saturday.status).toBe('CLOSED');
  expect(saturday.nextOpenDate).toBe('2026-10-19');
  expect(saturday.countdownMs).toBe(47 * 60 * 60 * 1000 + 30 * 60 * 1000);
});

test('matches the reproduced IST scenario', () => {
  const policy = { timezone: 'Asia/Kolkata', operating_days: [1, 2, 3, 4, 5], normal_submission_open_time: '09:00:00', normal_submission_close_time: '14:00:00' };
  const state = getBookingWindowStatus('normal', new Date('2026-10-13T00:11:12Z'), 'Asia/Kolkata', '2026-10-13', policy);
  expect(state.status).toBe('NOT OPEN');
  expect(state.message).toBe('Opens today at 09:00 IST');
  expect(state.countdownMs).toBe(3 * 60 * 60 * 1000 + 18 * 60 * 1000 + 48 * 1000);
});

test('opens priority booking for the previous day window', () => {
  const policy = { timezone: 'Asia/Kolkata', operating_days: [1, 2, 3, 4, 5] };
  expect(getBookingWindowStatus('priority', new Date('2026-10-12T03:30:00Z'), 'Asia/Kolkata', '2026-10-13', policy).status).toBe('OPEN');
  expect(getBookingWindowStatus('priority', new Date('2026-10-12T10:30:00Z'), 'Asia/Kolkata', '2026-10-13', policy).status).toBe('CLOSED');
});
