import { test, expect } from '@playwright/test'

/**
 * Offline Demo Mode is the presenter's zero-network-risk fallback for a live
 * screen-share demo. With it on, the scan must never attempt a network call
 * (weather, Nominatim, Overpass) and must still produce a correct, complete
 * result using only the 5 seeded villages.
 */
test('Offline Demo Mode: scan completes with zero network calls and honest fallback state', async ({
  page,
}) => {
  const networkCalls: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (
      url.includes('open-meteo.com') ||
      url.includes('nominatim.openstreetmap.org') ||
      url.includes('overpass')
    ) {
      networkCalls.push(url)
    }
  })

  await page.goto('/scan')
  await page.getByRole('checkbox', { name: /Offline Demo Mode/i }).check()

  await page.getByLabel('Full name').fill('Lakshmi S.')
  await page.getByLabel('Gender').selectOption('female')
  await page.getByLabel('Community').selectOption('sc')
  await page.getByLabel('Village / Block').selectOption('dinka-mandya')
  await page.getByLabel('Business category').selectOption('dairy')
  await page.getByLabel('Available margin capital (₹)').fill('100000')

  // Live location should be locked out while Demo Mode is on.
  await expect(page.getByRole('radio', { name: 'Enter any place in India' })).toBeDisabled()

  const start = Date.now()
  await page.getByRole('button', { name: 'Run hyperlocal scan' }).click()
  await expect(page).toHaveURL(/\/pulse/, { timeout: 10_000 })
  const elapsedMs = Date.now() - start

  // No timeout to wait out — this should be near-instant (well under the
  // 2.5s per-call live timeout), proving no network call was attempted.
  expect(elapsedMs).toBeLessThan(2_000)
  expect(networkCalls).toEqual([])

  await page.waitForTimeout(500)
  const body = await page.locator('body').innerText()
  expect(body).toMatch(/Live weather unavailable/i)
  expect(body).toMatch(/Dinka/i)
})

test('Offline Demo Mode forces curated location mode even if live was selected first', async ({
  page,
}) => {
  await page.goto('/scan')
  const liveRadio = page.locator('input[type=radio][name=locMode]').nth(1)
  await liveRadio.check()
  await expect(liveRadio).toBeChecked()

  await page.getByRole('checkbox', { name: /Offline Demo Mode/i }).check()
  const curatedRadio = page.locator('input[type=radio][name=locMode]').nth(0)
  await expect(curatedRadio).toBeChecked()
  await expect(liveRadio).toBeDisabled()
})
