import { render, screen } from '@testing-library/react';
import App, { campusLocalToUtc, getBookingWindowStatus, isValidDate, safeTimeZone } from './App';

test('renders the Northstar authentication screen', async () => {
  render(<App />);
  expect(await screen.findByText(/Sign in to Northstar/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
});

test('converts campus-local intervals to UTC and rejects invalid dates', () => {
  const start = campusLocalToUtc('2026-10-12', '09:00', 'America/New_York');
  expect(start.toISOString()).toBe('2026-10-12T13:00:00.000Z');
  expect(isValidDate(start)).toBe(true);
  expect(isValidDate(new Date('not-a-date'))).toBe(false);
  expect(safeTimeZone('not/a-zone')).toBe('UTC');
});

test('keeps status and countdown consistent at booking boundaries', () => {
  const policy = { timezone: 'UTC', operating_days: [1, 2, 3, 4, 5], normal_submission_open_time: '09:00:00', normal_submission_close_time: '14:00:00' };
  const before = getBookingWindowStatus('normal', new Date('2026-10-12T08:59:59Z'), 'UTC', '2026-10-12', policy);
  const open = getBookingWindowStatus('normal', new Date('2026-10-12T09:00:00Z'), 'UTC', '2026-10-12', policy);
  const closed = getBookingWindowStatus('normal', new Date('2026-10-12T14:00:00Z'), 'UTC', '2026-10-12', policy);
  expect(before.status).toBe('NOT OPEN');
  expect(before.countdownMs).toBeGreaterThan(0);
  expect(open.status).toBe('OPEN');
  expect(open.countdownMs).toBeNull();
  expect(closed.status).toBe('CLOSED');
  expect(closed.countdownMs).toBeNull();
});

test('matches the reproduced live UTC scenario', () => {
  const policy = { timezone: 'UTC', operating_days: [1, 2, 3, 4, 5], normal_submission_open_time: '09:00:00', normal_submission_close_time: '14:00:00' };
  const state = getBookingWindowStatus('normal', new Date('2026-10-13T05:41:12Z'), 'UTC', '2026-10-13', policy);
  expect(state.status).toBe('NOT OPEN');
  expect(state.message).toBe('Opens today at 09:00 UTC');
  expect(state.countdownMs).toBe(3 * 60 * 60 * 1000 + 18 * 60 * 1000 + 48 * 1000);
});

test('opens priority booking for the previous day window', () => {
  const policy = { timezone: 'UTC', operating_days: [1, 2, 3, 4, 5] };
  expect(getBookingWindowStatus('priority', new Date('2026-10-12T09:00:00Z'), 'UTC', '2026-10-13', policy).status).toBe('OPEN');
  expect(getBookingWindowStatus('priority', new Date('2026-10-12T16:00:00Z'), 'UTC', '2026-10-13', policy).status).toBe('CLOSED');
});
