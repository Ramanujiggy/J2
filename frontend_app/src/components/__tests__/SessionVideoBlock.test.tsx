import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../lib/api.ts', () => ({ api: { get: vi.fn(async () => ({ videos: [] })), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import SessionVideoBlock from '../SessionVideoBlock';
import { FILMING_GUIDE_SEEN_KEY, FILMING_TIPS } from '../FilmingGuide';

describe('SessionVideoBlock filming guide', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows the guide on the first attach, then goes straight to the picker', async () => {
    const user = userEvent.setup();
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<SessionVideoBlock sessionId="s1" />);

    await user.click(await screen.findByRole('button', { name: '+ Attach footage' }));
    expect(screen.getByRole('dialog', { name: 'Filming a roll' })).toBeTruthy();
    for (const tip of FILMING_TIPS) expect(screen.getByText(tip.title)).toBeTruthy();
    expect(pick).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Choose footage' }));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(FILMING_GUIDE_SEEN_KEY)).toBe('1');

    await user.click(screen.getByRole('button', { name: '+ Attach footage' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pick).toHaveBeenCalledTimes(2);
    pick.mockRestore();
  });

  it('can be reopened from the link without opening the picker', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(FILMING_GUIDE_SEEN_KEY, '1');
    render(<SessionVideoBlock sessionId="s1" />);
    await user.click(await screen.findByRole('button', { name: 'How to film a roll' }));
    expect(screen.getByRole('dialog', { name: 'Filming a roll' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
