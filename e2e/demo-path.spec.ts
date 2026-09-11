import { test, expect } from '@playwright/test'

/**
 * Exact demo path from MASTER_SPEC Rule 9:
 * Scan (SC woman, dairy, Dinka, ₹1L) → Pulse → Report → Finance → Sanction
 */
test('demo path: Dinka dairy ₹1L margin → Term Loan ₹10L/₹9L → sanction quorum', async ({
  page,
}) => {
  await page.goto('/scan')

  await page.getByLabel('Full name').fill('Lakshmi S.')
  await page.getByLabel('Gender').selectOption('female')
  await page.getByLabel('Community').selectOption('sc')
  await page.getByLabel('Village / Block').selectOption('dinka-mandya')
  await page.getByLabel('Business category').selectOption('dairy')
  await page.getByLabel('Available margin capital (₹)').fill('100000')

  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page).toHaveURL(/\/pulse/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: /Live Opportunity Pulse/i })).toBeVisible({
    timeout: 30_000,
  })

  await page.getByRole('link', { name: 'Open feasibility report' }).click()
  await expect(page).toHaveURL(/\/report/)
  await expect(page.getByRole('heading', { name: /Hyperlocal Feasibility Report/i })).toBeVisible()

  await page.getByRole('link', { name: 'Structure NSFDC finance' }).click()
  await expect(page).toHaveURL(/\/finance/)
  await expect(page.getByText(/10,00,000/).first()).toBeVisible()
  await expect(page.getByText(/9,00,000/).first()).toBeVisible()
  await expect(page.getByText(/Term Loan Scheme/i).first()).toBeVisible()

  await page.getByRole('link', { name: /Adaptive Multi-Sig Sanction/i }).click()
  await expect(page).toHaveURL(/\/sanction/)
  await expect(page.getByText(/0x[0-9a-f]+/i).first()).toBeVisible()

  for (let i = 0; i < 5; i++) {
    const btn = page.getByRole('button', { name: 'Sign as verifier' }).first()
    if ((await btn.count()) === 0) break
    await btn.click()
    await page.waitForTimeout(150)
  }

  await expect(page.getByRole('button', { name: /Release subsidy escrow|Escrow released/i })).toBeVisible({
    timeout: 15_000,
  })
})
