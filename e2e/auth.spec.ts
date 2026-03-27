import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('landing page loads with title and login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Journada' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.locator('form').getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  });

  test('can switch between login and register modes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('form').getByRole('button', { name: 'Create Account' })).toBeVisible();
    await page.getByRole('button', { name: 'Log In' }).first().click();
    await expect(page.locator('form').getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('can navigate to forgot password mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot your password?' }).click();
    await expect(page.getByText('Reset your password')).toBeVisible();
    await expect(page.locator('form').getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Log In' }).click();
    await expect(page.locator('form').getByRole('button', { name: 'Log In' })).toBeVisible();
  });
});
