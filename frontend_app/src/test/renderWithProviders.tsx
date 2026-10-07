import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

// Shared render helper for component tests. Every page/component under test
// needs React Router context (SealRevealSheet, RepRouletteFab and the auth
// pages all call useNavigate()), so the only provider the suite actually
// shares today is MemoryRouter. Wrap new providers here as the app grows —
// one edit updates every test instead of a copied boilerplate block.

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Forwarded to the MemoryRouter, e.g. `routerProps: { initialEntries: ['/home'] }`. */
  routerProps?: MemoryRouterProps;
}

export function renderWithProviders(
  ui: ReactElement,
  { routerProps, ...renderOptions }: RenderWithProvidersOptions = {},
) {
  return render(<MemoryRouter {...routerProps}>{ui}</MemoryRouter>, renderOptions);
}
