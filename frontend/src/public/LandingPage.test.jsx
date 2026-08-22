import { describe, it, expect } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from '@/public/LandingPage';
import { mockApi, renderApp } from '@/test/testUtils';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';

const MOCK_VENUES_RESPONSE = {
  items: [
    {
      slug: 'dhanmondi-turf-arena',
      name: 'Dhanmondi Turf Arena',
      area: 'Dhanmondi',
      verified: true,
      promotionLabel: 'Popular',
      rating: 4.8,
      reviewCount: 24,
      fromPrice: 1500,
      slotDurationMin: 60,
    },
    {
      slug: 'mirpur-futsal-zone',
      name: 'Mirpur Futsal Zone',
      area: 'Mirpur',
      verified: false,
      rating: 4.5,
      reviewCount: 12,
      fromPrice: 1200,
      slotDurationMin: 60,
    },
  ],
  totalItems: 42,
};

function ExploreDestination() {
  const location = useLocation();
  return <div data-testid="explore-destination">{location.pathname}{location.search}</div>;
}

describe('LandingPage — backend connectivity and features', () => {
  it('renders dynamic venue catalogue and count returned from API', async () => {
    mockApi([
      ['/venues', { body: MOCK_VENUES_RESPONSE }],
    ]);

    renderApp(<LandingPage />, { route: '/' });

    // Dynamic stat counter
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Venues listed')).toBeInTheDocument();

    // Dynamic venue cards
    expect(screen.getByText('Dhanmondi Turf Arena')).toBeInTheDocument();
    expect(screen.getByText('Mirpur Futsal Zone')).toBeInTheDocument();
    expect(screen.getByText('✓ Verified')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByText(/৳1,500/)).toBeInTheDocument();
  });

  it('renders graceful empty state when no venues are returned', async () => {
    mockApi([
      ['/venues', { body: { items: [], totalItems: 0 } }],
    ]);

    renderApp(<LandingPage />, { route: '/' });

    expect(
      await screen.findByText(/No venues are listed yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Venues listed')).not.toBeInTheDocument();
  });

  it('submits search filters and redirects to explore page with query params', async () => {
    mockApi([
      ['/venues', { body: MOCK_VENUES_RESPONSE }],
    ]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <ToastProvider>
            <SessionProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/player/explore" element={<ExploreDestination />} />
              </Routes>
            </SessionProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    const areaSelect = screen.getByLabelText(/Location/i);
    const timeSelect = screen.getByLabelText(/Time/i);
    const sportSelect = screen.getByLabelText(/Sport/i);

    fireEvent.change(areaSelect, { target: { value: 'Mohammadpur' } });
    fireEvent.change(timeSelect, { target: { value: '08:00' } });
    fireEvent.change(sportSelect, { target: { value: 'Football' } });

    const searchBtn = screen.getByRole('button', { name: /Find Available Turfs/i });
    fireEvent.click(searchBtn);

    const dest = await screen.findByTestId('explore-destination');
    expect(dest.textContent).toContain('/player/explore');
    expect(dest.textContent).toContain('area=Mohammadpur');
    expect(dest.textContent).toContain('openAt=08%3A00');
    expect(dest.textContent).toContain('sport=Football');
  });
});
