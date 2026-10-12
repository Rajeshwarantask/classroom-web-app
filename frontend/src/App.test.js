import { render, screen } from '@testing-library/react';
import App, { campusLocalToUtc, isValidDate, safeTimeZone } from './App';

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
