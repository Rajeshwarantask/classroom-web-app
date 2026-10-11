import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Northstar authentication screen', async () => {
  render(<App />);
  expect(await screen.findByText(/Sign in to Northstar/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
});
