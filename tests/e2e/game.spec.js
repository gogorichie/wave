import { test, expect } from '@playwright/test';

test.describe('Stadium Wave Game', () => {
  test('should load game page', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/Stadium Wave Game/);
    
    // Check for canvas
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });

  test('should show loading screen initially', async ({ page }) => {
    await page.goto('/');
    
    // Check for loading screen
    const loading = page.locator('#loading');
    await expect(loading).toBeVisible();
  });

  test('should show tutorial', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Pyodide to load (may take a while)
    await page.waitForSelector('#tutorial', { timeout: 30000 });
    
    const tutorial = page.locator('#tutorial');
    await expect(tutorial).toBeVisible();
    await expect(tutorial).toContainText('Stadium Wave Game');
  });

  test('should start game on button click', async ({ page }) => {
    await page.goto('/');
    
    // Wait for loading to complete
    await page.waitForSelector('#start-btn', { timeout: 30000 });
    
    // Click start button
    await page.click('#start-btn');
    
    // Tutorial should be hidden
    const tutorial = page.locator('#tutorial');
    await expect(tutorial).toHaveClass(/hidden/);
    
    // HUD should be visible
    const hud = page.locator('#hud');
    await expect(hud).not.toHaveClass(/hidden/);
  });

  test('should display score and combo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#start-btn', { timeout: 30000 });
    await page.click('#start-btn');
    
    // Check HUD elements
    const score = page.locator('#score');
    const combo = page.locator('#combo');
    
    await expect(score).toBeVisible();
    await expect(combo).toBeVisible();
  });
});
