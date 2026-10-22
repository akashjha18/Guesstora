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
  await customerPage.goto(`${baseUrl}/c/demo-cafe`);
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
  await ownerPage.goto(`${baseUrl}/owner/login`);
  await ownerPage.locator('#auth-email').fill('owner@perkbyte.demo');
  await ownerPage.locator('#auth-password').fill('Demo@123');
  await ownerPage.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  await ownerPage.waitForURL('**/owner');
  await ownerPage.getByText('Browser Test Customer').waitFor({ timeout: 15000 });
  console.log('PASS owner sign-in and order visibility');

  const kitchenContext = await browser.newContext();
  const kitchenPage = await kitchenContext.newPage();
  kitchenPage.on('pageerror', error => pageErrors.push(`Kitchen: ${error.message}`));
  await kitchenPage.goto(`${baseUrl}/owner/login`);
  await kitchenPage.getByRole('button', { name: /Kitchen/ }).click();
  await kitchenPage.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  await kitchenPage.waitForURL('**/owner');
  await kitchenPage.goto(`${baseUrl}/kds/demo-cafe`);
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
