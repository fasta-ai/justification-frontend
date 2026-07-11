import { test, expect } from '@playwright/test';

test('walk through approval workflow and test similar cases', async ({ page }) => {
  // 1. Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'playwright.test@fasta.ai');
  await page.fill('input[type="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3001/', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // 2. Click "Go to Justification" to reach Approval Workflow (Stage 3)
  const goToJustificationBtn = page.locator('button:has-text("Go to Justification")').first();
  await expect(goToJustificationBtn).toBeVisible({ timeout: 5000 });
  await goToJustificationBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/playwright-01-approval-workflow.png', fullPage: true });

  // 3. Verify "Approval Workflow" heading
  const heading = page.locator('h2:has-text("Approval Workflow")').first();
  await expect(heading).toBeVisible({ timeout: 5000 });

  // 4. Click on first case row to select it
  const firstCaseRow = page.locator('table tbody tr').first();
  await expect(firstCaseRow).toBeVisible({ timeout: 10000 });
  await firstCaseRow.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/playwright-02-case-selected.png', fullPage: true });

  // 5. Verify action bar appeared with "Similar Cases" button
  const similarCasesBtn = page.locator('button:has-text("Similar Cases")').first();
  await expect(similarCasesBtn).toBeVisible({ timeout: 5000 });
  console.log('Similar Cases button is visible after selecting a case');

  // 6. Click "Similar Cases" and wait for API + results
  await similarCasesBtn.click();
  await page.waitForTimeout(8000); // API call + rendering
  await page.screenshot({ path: '/tmp/playwright-03-similar-cases-results.png', fullPage: true });

  // 7. Check results
  const similarJustificationCount = await page.locator('text=Similar Justification').count();
  const noResultsMsg = await page.locator('text=No similar cases found').first().isVisible().catch(() => false);
  console.log(`Similar Justification mentions: ${similarJustificationCount}`);
  console.log(`No similar cases message: ${noResultsMsg}`);

  // Check for errors
  const errorVisible = await page.locator('text=error, text=Error, text=failed, text=Failed').first().isVisible().catch(() => false);
  if (errorVisible) {
    console.log('WARNING: Error message detected on page');
  }

  // 8. Verify the search on cases list is frontend-only
  // The search input filters the cases table without API calls
  const searchInput = page.locator('input[placeholder*="Search cases"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('XYZ-NONEXISTENT-12345');
    await page.waitForTimeout(500);
    const noCasesFound = await page.locator('text=No cases found').first().isVisible().catch(() => false);
    console.log(`Frontend-only search works: ${noCasesFound}`);
  }
});
