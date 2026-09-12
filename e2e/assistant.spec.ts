import { test, expect } from '@playwright/test'

/**
 * AI Government Scheme Assistant — no local Ollama is running in this test
 * environment, so every reply is expected to come from the deterministic
 * offline provider (labelled as such in the UI). That's fine: the point of
 * this test is the pipeline (extraction -> retrieval -> eligibility ->
 * ranking -> UI), not the AI provider itself.
 */

test('assistant: poultry/Karnataka/SC profile surfaces matching schemes with sources and an action plan', async ({
  page,
}) => {
  await page.goto('/assistant')
  await expect(page.getByRole('heading', { name: /AI Government Scheme Assistant/i })).toBeVisible()

  await page.getByLabel('Message').fill(
    'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.',
  )
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText(/offline reasoning/i).first()).toBeVisible({ timeout: 15_000 })

  await expect(page.getByText('Karnataka').first()).toBeVisible()
  await expect(page.getByText('poultry').first()).toBeVisible()

  await expect(page.getByRole('heading', { name: /NSFDC Term Loan Scheme/i })).toBeVisible()

  // PMEGP explicitly excludes poultry farming — it should still be listed
  // (never hidden), but clearly labelled as an unlikely match rather than
  // silently omitted or mislabelled as a good fit.
  const pmegpCard = page.getByRole('article', { name: /Prime Minister's Employment Generation/i })
  await expect(pmegpCard).toBeVisible()
  await expect(pmegpCard.getByText(/unlikely match/i)).toBeVisible()

  await page.getByRole('article', { name: /NSFDC Term Loan Scheme/i }).getByText('View details').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('link', { name: /official information/i })).toHaveAttribute(
    'href',
    /^https:\/\//,
  )
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(page.getByRole('heading', { name: /Your action plan/i })).toBeVisible()
})

test('assistant: a materially different profile (Kerala tailoring woman) surfaces different top schemes', async ({
  page,
}) => {
  await page.goto('/assistant')

  await page.getByLabel('Message').fill(
    'I am a 47-year-old woman in Kerala with an existing tailoring business. I earn ₹6 lakh annually and need ₹8 lakh to expand.',
  )
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByRole('heading', { name: /Kudumbashree/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /NSFDC Term Loan Scheme/i })).toHaveCount(0)
})

test('assistant: starter question chips are clickable and existing app routes remain unaffected', async ({
  page,
}) => {
  await page.goto('/assistant')
  await expect(page.getByRole('article')).toHaveCount(0)

  const starter = page.getByRole('button').filter({ hasText: /poultry business/i }).first()
  await expect(starter).toBeVisible()
  await starter.click()

  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 15_000 })

  // Existing routes must still work unmodified.
  await page.goto('/scan')
  await expect(page.getByRole('heading', { name: /Tell LokPulse who you are/i })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Start Opportunity Scan/i })).toBeVisible()
})
