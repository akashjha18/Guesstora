import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createIsolatedApi } from '../../server/scripts/testSupport.js';

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function waitForFrontend(baseUrl, child, output) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Vite exited before becoming ready.\n${output()}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for Vite.\n${output()}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exitPromise = once(child, 'exit');
  child.kill();
  await exitPromise;
}

let api;
let vite;
let browser;
let pageErrors = [];
let customerPage;
const failedResponses = [];
let output = '';

try {
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  api = await createIsolatedApi('smoke', { clientUrl: baseUrl });
  vite = spawn(process.execPath, [
    resolve(clientDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ], {
    cwd: clientDir,
    env: { ...process.env, VITE_API_URL: api.baseUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const appendOutput = chunk => { output = `${output}${chunk}`.slice(-8000); };
  vite.stdout.on('data', appendOutput);
  vite.stderr.on('data', appendOutput);
  await waitForFrontend(baseUrl, vite, () => output);

  browser = await chromium.launch({ headless: true });

  const customerContext = await browser.newContext();
  customerPage = await customerContext.newPage();
  customerPage.on('pageerror', error => pageErrors.push(`Customer: ${error.message}`));
  customerPage.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  await customerPage.goto(`${baseUrl}/c/demo-cafe`, { waitUntil: 'domcontentloaded' });
  await customerPage.locator('.brix-sidebar-brand-title').waitFor({ timeout: 10000 });
  assert.ok(await customerPage.locator('article.brix-compact-card').count(), 'Customer menu should render menu items');

  const addButtons = customerPage.locator('article.brix-compact-card .brix-card-add-btn');
  assert.ok(await addButtons.count(), 'At least one standard menu item should be directly addable');
  await addButtons.first().click();
  await customerPage.getByRole('button', { name: /View Cart & Checkout/ }).click();
  await customerPage.getByPlaceholder('Enter your name').fill('Browser Test Customer');
  await customerPage.getByPlaceholder('For order status & stamps').fill('9876543219');
  await customerPage.getByRole('button', { name: /Place Order/ }).click();
  await customerPage.getByText('Order Confirmed & Queued').waitFor({ timeout: 15000 });
  await customerPage.waitForTimeout(500);
  assert.deepEqual(failedResponses, [], `API errors: ${failedResponses.join('; ')}`);
  console.log('PASS customer menu browsing and order placement');

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  ownerPage.on('pageerror', error => pageErrors.push(`Owner: ${error.message}`));
  await ownerPage.goto(`${baseUrl}/owner/login`, { waitUntil: 'domcontentloaded' });
  const brandLogo = ownerPage.getByRole('img', { name: 'GUESTORA Coffee Logo' });
  await brandLogo.waitFor({ state: 'visible' });
  assert.ok(await brandLogo.evaluate(image => image.complete && image.naturalWidth > 0), 'GUESTORA wordmark should load');
  await ownerPage.locator('#auth-email').fill('owner@perkbyte.demo');
  await ownerPage.locator('#auth-password').fill('Demo@123');
  await ownerPage.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  await ownerPage.waitForURL('**/owner');
  await ownerPage.getByText('Browser Test Customer').waitFor({ timeout: 15000 });
  console.log('PASS owner sign-in and order visibility');

  const ownerToken = await ownerPage.evaluate(() =>
    localStorage.getItem('perkbyte_token') || localStorage.getItem('gusstora_token')
  );
  await ownerPage.getByRole('button', { name: 'Settings' }).click();
  const brandColorText = ownerPage.locator('input[pattern="^#[0-9A-Fa-f]{6}$"]');
  const brandColorPicker = ownerPage.locator('input[type="color"]');
  await brandColorText.fill('#123456');
  assert.equal(await brandColorPicker.inputValue(), '#123456', 'Hex entry should synchronize the color picker');
  await ownerPage.getByRole('button', { name: 'Cognac Roast' }).click();
  assert.equal(await brandColorText.inputValue(), '#7b3d22', 'Selecting a preset should update the hex value');
  await ownerPage.getByRole('button', { name: /Save Café, Social & CFD Settings/ }).click();
  await ownerPage.getByText(/Café settings, social links & CFD display updated successfully/i).waitFor();
  const invalidBrandColorResponse = await fetch(`${api.baseUrl}/owner/cafe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ brandColor: 'not-a-color' }),
  });
  assert.equal(invalidBrandColorResponse.status, 400, 'Invalid brand colors should be rejected');
  const publicCafeResponse = await fetch(`${api.baseUrl}/public/cafes/demo-cafe`);
  const publicCafe = await publicCafeResponse.json();
  assert.equal(publicCafe.brandColor, '#7b3d22', 'Saved accent should be returned to guest clients');
  await customerPage.goto(`${baseUrl}/c/demo-cafe`, { waitUntil: 'domcontentloaded' });
  await customerPage.locator('.brix-sidebar-brand-title').waitFor({ timeout: 10000 });
  assert.equal(
    await customerPage.locator('.brix-app-shell').evaluate(element => getComputedStyle(element).getPropertyValue('--cafe-brand-color').trim()),
    '#7b3d22',
    'Guest menu should apply the saved brand accent',
  );
  assert.equal(
    await customerPage.locator('.brix-card-add-btn').first().evaluate(element => getComputedStyle(element).backgroundColor),
    'rgb(123, 61, 34)',
    'Guest menu primary action should use the saved brand accent',
  );
  const cfdPage = await browser.newPage();
  await cfdPage.goto(`${baseUrl}/cfd/demo-cafe`, { waitUntil: 'domcontentloaded' });
  await cfdPage.locator('.cfd-logo-badge').waitFor({ timeout: 10000 });
  assert.equal(
    await cfdPage.locator('.cfd-root').evaluate(element => getComputedStyle(element).getPropertyValue('--cfd-brand-color').trim()),
    '#7b3d22',
    'Customer-facing display should use the saved brand accent',
  );
  await cfdPage.close();
  console.log('PASS brand accent editing, validation, persistence, guest menu, and customer display');

  const waiterEmail = `browser-waiter-${Date.now()}@test.invalid`;
  const waiterResponse = await fetch(`${api.baseUrl}/owner/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      name: 'Browser Test Waiter',
      email: waiterEmail,
      password: 'BrowserWaiter@123',
      role: 'waiter',
      assignedSection: 'Window Section',
    }),
  });
  assert.equal(waiterResponse.status, 201, 'Owner should be able to provision a waiter account');

  const passwordResetEmail = `browser-password-reset-${Date.now()}@test.invalid`;
  const passwordResetStaff = await fetch(`${api.baseUrl}/owner/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      name: 'Browser Password Reset Test',
      email: passwordResetEmail,
      password: 'InitialPass@123',
      role: 'cashier',
    }),
  });
  assert.equal(passwordResetStaff.status, 201, 'Owner should be able to create a staff account for password reset');
  await ownerPage.getByRole('button', { name: /Staff & Roles/ }).click();
  const passwordResetRow = ownerPage.locator('.crm-orders-row').filter({ hasText: passwordResetEmail });
  await passwordResetRow.waitFor({ timeout: 10000 });
  await passwordResetRow.getByRole('button', { name: 'Edit' }).click();
  await ownerPage.getByPlaceholder('Leave blank to keep the current password').fill('UpdatedPass@456');
  await ownerPage.getByPlaceholder('Confirm new password').fill('UpdatedPass@456');
  await ownerPage.getByRole('button', { name: 'Update Staff Member' }).click();
  await ownerPage.getByText(/updated successfully/i).waitFor({ timeout: 10000 });
  const updatedPasswordLogin = await fetch(`${api.baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: passwordResetEmail, password: 'UpdatedPass@456' }),
  });
  assert.equal(updatedPasswordLogin.status, 200, 'Staff should be able to log in with the owner-reset password');
  console.log('PASS owner changes staff login password through Staff & Roles');

  const waiterContext = await browser.newContext();
  const waiterPage = await waiterContext.newPage();
  waiterPage.on('pageerror', error => pageErrors.push(`Waiter: ${error.message}`));
  waiterPage.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  await waiterPage.goto(`${baseUrl}/owner/login`, { waitUntil: 'domcontentloaded' });
  assert.equal(
    await waiterPage.getByRole('button', { name: 'Waiter sign in' }).count(),
    0,
    'Owner login portal should not expose a waiter sign-in option',
  );
  await waiterPage.goto(`${baseUrl}/captain/demo-cafe`, { waitUntil: 'domcontentloaded' });
  await waiterPage.getByLabel('Staff email').fill(waiterEmail);
  await waiterPage.getByLabel('Password').fill('BrowserWaiter@123');
  await waiterPage.getByRole('button', { name: 'Sign in to Captain' }).click();
  await waiterPage.locator('.captain-header-waiter-badge').getByText('Browser Test Waiter').waitFor({ timeout: 10000 });
  assert.ok(await waiterPage.locator('.captain-table-card').count(), 'Waiter should see assigned floor tables');
  const waiterTableNumbers = await waiterPage.locator('.captain-table-num').allTextContents();
  assert.ok(waiterTableNumbers.every(number => ['1', '2', '3', '4'].includes(number.trim())),
    'Waiter should not see tables outside the assigned Window Section');
  for (const label of ['Vacant Tables', 'Active KOT', 'Billed Tables', 'Clean Tables']) {
    await waiterPage.getByText(label, { exact: true }).waitFor();
  }
  const allTablesTab = waiterPage.locator('.captain-sections-scroll').getByRole('button', { name: 'All Tables' });
  await allTablesTab.click();
  assert.match(await allTablesTab.getAttribute('class'), /active/, 'All Tables tab should activate');
  const allAccessibleTableNumbers = await waiterPage.locator('.captain-table-num').allTextContents();
  assert.equal(allAccessibleTableNumbers.length, 4, 'All Tables should show every table available to the signed-in waiter');
  assert.ok(allAccessibleTableNumbers.every(number => ['1', '2', '3', '4'].includes(number.trim())),
    'All Tables should not bypass the waiter assigned-section permission');
  const sectionButtons = await waiterPage.locator('.captain-section-tab').all();
  for (const button of sectionButtons) {
    const sectionName = (await button.textContent()).trim();
    await button.click();
    assert.equal(
      await button.getAttribute('class').then(className => className.includes('active')),
      true,
      `Section tab ${sectionName} should become active`,
    );
  }
  const sectionTab = waiterPage.locator('.captain-sections-scroll').getByRole('button', { name: 'Window Section' });
  await sectionTab.click();
  assert.ok(await waiterPage.locator('.captain-table-card').count(), 'Window Section tab should show its real tables');
  assert.equal(await waiterPage.getByRole('navigation', { name: 'Floor sections' }).getByRole('button', { name: 'Floor Map' }).count(), 0,
    'Floor Map view should not be available');
  const firstTableNumber = (await waiterPage.locator('.captain-table-num').first().textContent()).trim();
  const tableSearch = waiterPage.getByRole('searchbox', { name: 'Search table number' });
  await tableSearch.fill(firstTableNumber);
  assert.equal(await waiterPage.locator('.captain-table-card').count(), 1, 'Table search should filter by actual table identifier');
  await tableSearch.fill('');
  await waiterPage.getByTitle('Mute Sound').click();
  await waiterPage.getByTitle('Unmute Sound').waitFor();
  await waiterPage.getByTitle('Unmute Sound').click();
  await waiterPage.getByTitle('Refresh Floor Plan').click();
  await waiterPage.setViewportSize({ width: 390, height: 844 });
  const mobileFloorLayout = await waiterPage.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    columns: getComputedStyle(document.querySelector('.captain-table-grid')).gridTemplateColumns.split(' ').length,
  }));
  assert.equal(mobileFloorLayout.overflow, false, 'Mobile Table Management should not overflow horizontally');
  assert.equal(mobileFloorLayout.columns, 2, 'Mobile table grid should use two columns');
  await waiterPage.setViewportSize({ width: 1280, height: 800 });
  const desktopFloorAppearance = await waiterPage.evaluate(() => {
    const tableGrid = document.querySelector('.captain-table-grid');
    return {
      workspace: getComputedStyle(document.querySelector('.captain-app')).backgroundColor,
      statusCards: document.querySelectorAll('.captain-status-panel .captain-kpi-item').length,
      tableCards: document.querySelectorAll('.captain-table-grid .captain-table-card').length,
      gridColumns: getComputedStyle(tableGrid).gridTemplateColumns.split(' ').length,
      floorMapCanvas: document.querySelector('.captain-map-canvas') !== null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert.equal(desktopFloorAppearance.workspace, 'rgb(241, 247, 242)', 'Workspace should use the pale sage background');
  assert.equal(desktopFloorAppearance.statusCards, 4, 'All four live status summaries should be visible');
  assert.equal(desktopFloorAppearance.tableCards, 4, 'Grid should show all actual tables in the selected section');
  assert.ok(desktopFloorAppearance.gridColumns >= 2, 'Desktop table grid should show multiple columns');
  assert.equal(desktopFloorAppearance.floorMapCanvas, false, 'Floor map canvas should be removed');
  assert.equal(desktopFloorAppearance.overflow, false, 'Desktop Table Management should not overflow horizontally');
  assert.ok(
    await waiterPage.locator('.captain-table-card.available').count(),
    'Waiter should have an available assigned-section table to serve',
  );
  await waiterPage.locator('.captain-table-card.available').first().click();
  assert.ok(await waiterPage.locator('.captain-table-card.available.selected').count(), 'Selected table should have a clear selection state');
  await waiterPage.getByRole('button', { name: 'Seat & Take Order Now' }).click();
  await waiterPage.locator('.captain-menu-card .captain-add-item-btn').first().click();
  await waiterPage.locator('.captain-fire-kot-cta').click();
  await waiterPage.getByText(/KOT Fired!/).waitFor({ timeout: 10000 });
  await waiterPage.locator('.captain-sheet-close').click();
  await waiterPage.getByTitle('Switch Waiter / Lock').click();
  await waiterPage.getByLabel('Staff email').waitFor();
  assert.deepEqual(failedResponses, [], `Waiter API errors: ${failedResponses.join('; ')}`);
  console.log('PASS Table Management section tabs, grid, search, status summary, responsive layout, controls, and waiter order flow');

  const kitchenContext = await browser.newContext();
  const kitchenPage = await kitchenContext.newPage();
  kitchenPage.on('pageerror', error => pageErrors.push(`Kitchen: ${error.message}`));
  await kitchenPage.goto(`${baseUrl}/owner/login`, { waitUntil: 'domcontentloaded' });
  await kitchenPage.getByRole('button', { name: /Kitchen/ }).click();
  await kitchenPage.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  await kitchenPage.waitForURL('**/owner');
  await kitchenPage.goto(`${baseUrl}/kds/demo-cafe`, { waitUntil: 'domcontentloaded' });
  await kitchenPage.getByText('Kitchen Display & Expediter Board').waitFor();
  await kitchenPage.getByText('Browser Test Customer').waitFor({ timeout: 15000 });

  const kdsLayout = await kitchenPage.evaluate(() => {
    const grid = document.querySelector('.kds-workflow-grid');
    const columns = Array.from(document.querySelectorAll('.kds-col'));
    return {
      gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      columnCount: columns.length,
      background: getComputedStyle(document.querySelector('.kds-viewport')).backgroundColor,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert.equal(kdsLayout.gridColumns, 4, 'Desktop KDS should display four workflow columns');
  assert.equal(kdsLayout.columnCount, 4, 'All KDS workflow columns should be present');
  assert.equal(kdsLayout.background, 'rgb(241, 247, 242)', 'KDS should use the pale mint workspace');
  assert.equal(kdsLayout.overflow, false, 'Desktop KDS should not overflow horizontally');

  const allStationsButton = kitchenPage.getByRole('button', { name: /All Stations/ });
  const kitchenStationButton = kitchenPage.getByRole('button', { name: 'Kitchen & Food' });
  await kitchenStationButton.click();
  assert.match(await kitchenStationButton.getAttribute('class'), /active/, 'Kitchen station filter should activate');
  await allStationsButton.click();

  const orderSearch = kitchenPage.getByPlaceholder('Search table / #');
  await orderSearch.fill('no-matching-kds-order');
  assert.equal(await kitchenPage.locator('.kds-col .kds-ticket-card').count(), 0, 'KDS search should filter tickets');
  await orderSearch.fill('');

  await kitchenPage.getByRole('button', { name: 'Sound ON' }).click();
  await kitchenPage.getByRole('button', { name: 'Muted' }).waitFor();
  await kitchenPage.getByRole('button', { name: 'Muted' }).click();
  await kitchenPage.getByRole('button', { name: 'Sound ON' }).waitFor();
  await kitchenPage.getByRole('button', { name: 'Manual sync' }).click();

  const incomingTicket = kitchenPage.locator('.kds-col.col-incoming .kds-ticket-card')
    .filter({ hasText: 'Browser Test Customer' })
    .first();
  const waitForStatusUpdate = () => kitchenPage.waitForResponse(response =>
    response.request().method() === 'PATCH' && response.url().includes('/owner/orders/')
  );
  let statusResponse = waitForStatusUpdate();
  await incomingTicket.getByRole('button', { name: /Start Cooking/ }).click();
  assert.ok((await statusResponse).ok(), 'Start Cooking request should succeed');

  const cookingTicket = kitchenPage.locator('.kds-col.col-cooking .kds-ticket-card')
    .filter({ hasText: 'Browser Test Customer' })
    .first();
  await cookingTicket.getByRole('button', { name: /Mark Ready/ }).waitFor();
  statusResponse = waitForStatusUpdate();
  await cookingTicket.getByRole('button', { name: /Mark Ready/ }).click();
  assert.ok((await statusResponse).ok(), 'Mark Ready request should succeed');

  const readyTicket = kitchenPage.locator('.kds-col.col-ready .kds-ticket-card')
    .filter({ hasText: 'Browser Test Customer' })
    .first();
  await readyTicket.getByRole('button', { name: /Served & Fulfilled/ }).waitFor();
  statusResponse = waitForStatusUpdate();
  await readyTicket.getByRole('button', { name: /Served & Fulfilled/ }).click();
  assert.ok((await statusResponse).ok(), 'Fulfillment request should succeed');

  const fulfilledTicket = kitchenPage.locator('.kds-col.col-completed .kds-ticket-card')
    .filter({ hasText: 'Browser Test Customer' })
    .first();
  await fulfilledTicket.getByRole('button', { name: /Recall to Ready/ }).waitFor();
  statusResponse = waitForStatusUpdate();
  await fulfilledTicket.getByRole('button', { name: /Recall to Ready/ }).click();
  assert.ok((await statusResponse).ok(), 'Recall to Ready request should succeed');
  await kitchenPage.locator('.kds-col.col-ready .kds-ticket-card')
    .filter({ hasText: 'Browser Test Customer' })
    .waitFor();
  console.log('PASS kitchen sign-in and live order board');
  console.log('PASS KDS layout, search, station filters, sound controls, and order workflow');

  await customerContext.close();
  await ownerContext.close();
  await waiterContext.close();
  await kitchenContext.close();
  assert.deepEqual(pageErrors, [], `Browser JavaScript errors: ${pageErrors.join('; ')}`);
  console.log('PASS no uncaught browser JavaScript errors');
  if (failedResponses.length) console.warn(`Browser HTTP errors: ${failedResponses.join('; ')}`);
} catch (error) {
  console.error(error);
  if (customerPage) {
    try {
      console.error('Customer page text:', (await customerPage.locator('body').innerText()).slice(0, 3000));
    } catch {}
  }
  if (pageErrors.length) console.error('Browser errors:', pageErrors.join('\n'));
  if (output) console.error(output);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (vite) await stopProcess(vite);
  if (api) await api.cleanup();
}
