import { test, expect } from '@playwright/test'

/**
 * The failure mode to eliminate for a live screen-share demo: a stalled
 * connection (bad venue wifi) must never leave the UI sitting on a spinner
 * indefinitely. Every live call (Nominatim, Overpass, Open-Meteo) has a
 * 2.5s AbortController timeout (LIVE_CALL_TIMEOUT_MS) that falls through to
 * the existing honest "unavailable" UI state. These tests simulate a
 * request that never responds and confirm the app recovers well within a
 * few seconds rather than hanging.
 */

test('a hung weather API call falls through to "unavailable" within a few seconds, not forever', async ({
  page,
}) => {
  // Let Nominatim/Overpass behave normally (curated village path doesn't need
  // them to succeed for the test to be meaningful) but hang the weather call.
  await page.route('**open-meteo.com/**', () => {
    // Never fulfill/continue/abort — simulates a connection that neither
    // succeeds nor fails, just stalls.
  })

  await page.goto('/scan')
  await page.getByLabel('Full name').fill('Lakshmi S.')
  await page.getByLabel('Gender').selectOption('female')
  await page.getByLabel('Community').selectOption('sc')
  await page.getByLabel('Village / Block').selectOption('dinka-mandya')
  await page.getByLabel('Business category').selectOption('dairy')
  await page.getByLabel('Available margin capital (₹)').fill('100000')

  const start = Date.now()
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  // Worst case is bounded, not unbounded: Overpass enrichment (~2.5s, both
  // mirrors raced in parallel — see geo.ts) runs before weather (~2.5s,
  // fetchWeather + fetchWeekTemps in parallel with each other), so ~5s of
  // network-bound work plus page/form overhead. Generous ceiling below to
  // avoid CI flakiness while still proving this never approaches "hung."
  await expect(page).toHaveURL(/\/pulse/, { timeout: 12_000 })
  const elapsedMs = Date.now() - start
  console.log('elapsed with hung weather call:', elapsedMs, 'ms')
  expect(elapsedMs).toBeLessThan(9_000)

  await page.waitForTimeout(500)
  const body = await page.locator('body').innerText()
  expect(body).toMatch(/Live weather unavailable|Weather unavailable/i)
})

test('a hung Nominatim geocode fails fast with a clear message, not a hang', async ({ page }) => {
  await page.route('**nominatim.openstreetmap.org/**', () => {
    // never resolve
  })

  await page.goto('/scan')
  await page.getByLabel('Full name').fill('Test User')
  await page.getByLabel('Gender').selectOption('female')
  await page.getByLabel('Community').selectOption('sc')
  await page.getByLabel('Business category').selectOption('dairy')
  await page.getByLabel('Available margin capital (₹)').fill('100000')

  const liveRadio = page.locator('input[type=radio][name=locMode]').nth(1)
  await liveRadio.check()
  await page.getByLabel('Place name').fill('Nowhere Test Place')

  const start = Date.now()
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page.locator('[role=alert]')).toBeVisible({ timeout: 9_000 })
  const elapsedMs = Date.now() - start
  console.log('elapsed with hung geocode:', elapsedMs, 'ms')
  expect(elapsedMs).toBeLessThan(9_000)
  await expect(page).not.toHaveURL(/\/pulse/)
})
