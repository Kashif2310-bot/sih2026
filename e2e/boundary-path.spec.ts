import { test, expect } from '@playwright/test'

/**
 * Boundary-value pass through /scan's real UI validation, complementing the
 * unit-level boundary tests in finance.test.ts (which test buildSchemePlan
 * directly). This confirms the same boundaries are enforced end-to-end
 * through the form a real user fills in.
 */

async function fillBaseForm(page: import('@playwright/test').Page) {
  await page.getByLabel('Full name').fill('Lakshmi S.')
  await page.getByLabel('Gender').selectOption('female')
  await page.getByLabel('Community').selectOption('sc')
  await page.getByLabel('Village / Block').selectOption('dinka-mandya')
  await page.getByLabel('Business category').selectOption('dairy')
}

test('rejects zero margin capital with a clear message and does not proceed', async ({ page }) => {
  await page.goto('/scan')
  await fillBaseForm(page)
  await page.getByLabel('Available margin capital (₹)').fill('0')
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page.locator('[role=alert]')).toBeVisible()
  await expect(page).toHaveURL(/\/scan/)
})

test('rejects margin capital above the Rs 50L project cap with a clear message', async ({ page }) => {
  await page.goto('/scan')
  await fillBaseForm(page)
  // 500,000.1 rupees margin -> project cost > Rs 50L (the reject boundary from finance.test.ts)
  await page.getByLabel('Available margin capital (₹)').fill('500001')
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page.locator('[role=alert]')).toBeVisible()
  await expect(page).toHaveURL(/\/scan/)
})

test('exact Rs 1,40,000 project cost boundary routes to Micro Finance end-to-end', async ({ page }) => {
  await page.goto('/scan')
  await fillBaseForm(page)
  // margin 14,000 -> project cost exactly Rs 1,40,000 (MICRO_CAP boundary)
  await page.getByLabel('Available margin capital (₹)').fill('14000')
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page).toHaveURL(/\/pulse/, { timeout: 60_000 })

  await page.getByRole('link', { name: 'Open feasibility report' }).click()
  await page.getByRole('link', { name: 'Structure NSFDC finance' }).click()
  await expect(page).toHaveURL(/\/finance/)
  await expect(page.getByText(/1,40,000/).first()).toBeVisible()
  await expect(page.getByText(/Micro Finance/i).first()).toBeVisible()
  await expect(page.getByText(/6\.5% p\.a\./).first()).toBeVisible()
})

test('at Rs 50L project cost exactly, still structures a Term Loan (not rejected)', async ({ page }) => {
  await page.goto('/scan')
  await fillBaseForm(page)
  // margin 500,000 -> project cost exactly Rs 50,00,000 (TERM_CAP boundary, in-scope)
  await page.getByLabel('Available margin capital (₹)').fill('500000')
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page).toHaveURL(/\/pulse/, { timeout: 60_000 })

  await page.getByRole('link', { name: 'Open feasibility report' }).click()
  await page.getByRole('link', { name: 'Structure NSFDC finance' }).click()
  await expect(page).toHaveURL(/\/finance/)
  await expect(page.getByText(/50,00,000/).first()).toBeVisible()
  await expect(page.getByText(/45,00,000/).first()).toBeVisible()
  await expect(page.getByText(/Term Loan Scheme/i).first()).toBeVisible()
})
