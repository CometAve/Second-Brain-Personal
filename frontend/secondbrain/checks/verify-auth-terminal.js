async function verifyTerminalRefresh401(page) {
  // Synthetic route fixtures only; no tokens, cookies, headers, or bodies returned.
  let refreshCalls = 0;
  let noteCalls = 0;
  let started = false;
  let refreshSeen;
  const refreshResponse = new Promise((resolve) => {
    refreshSeen = resolve;
  });
  let initialRefreshSeen;
  const initialRefresh = new Promise((resolve) => {
    initialRefreshSeen = resolve;
  });
  const json = (route, status, body) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  await page.route('**/api/auth/refresh', (route) => {
    if (started) {
      refreshCalls += 1;
      refreshSeen();
    } else initialRefreshSeen();
    return json(route, 401, { success: false, code: -10401, message: 'expired' });
  });
  await page.route('**/api/notes/9001', (route) => {
    noteCalls += 1;
    return json(route, 401, { success: false, code: -10401, message: 'expired' });
  });
  console.log('AUTH_TERMINAL startup');
  await page.goto('http://localhost:5173/');
  let initialReady = false;
  await Promise.race([
    initialRefresh.then(() => {
      initialReady = true;
    }),
    page.waitForTimeout(5000),
  ]);
  if (!initialReady) return { results: { initialReady }, passed: false };
  const modulesReady = await page.evaluate(async () => {
    const clientSource = await fetch('/src/api/client.ts').then((response) => response.text());
    const storeUrl = clientSource.match(
      /from\s+["']([^"']*\/stores\/authStore\.ts[^"']*)["']/,
    )?.[1];
    if (!storeUrl) return false;
    window.__sbAuthClient = await import('/src/api/client.ts');
    window.__sbAuthStore = await import(storeUrl);
    return Boolean(window.__sbAuthClient.apiClient && window.__sbAuthStore.captureSessionEpoch);
  });
  if (!modulesReady) return { results: { modulesReady }, passed: false };
  started = true;
  await page.evaluate(async () => {
    const { apiClient } = window.__sbAuthClient;
    const { captureSessionEpoch, useAuthStore } = window.__sbAuthStore;
    useAuthStore.getState().setAccessToken('synthetic-access-A');
    useAuthStore.getState().setUser({
      id: 1,
      email: 'synthetic-a@example.test',
      name: 'Synthetic A',
      picture: null,
      setAlarm: false,
    });
    void apiClient.get('/api/notes/9001', { sessionEpoch: captureSessionEpoch() }).catch(() => {});
  });
  let observedRefresh = false;
  await Promise.race([
    refreshResponse.then(() => {
      observedRefresh = true;
    }),
    page.waitForTimeout(5000),
  ]);
  await page.waitForTimeout(200);
  const results = { observedRefresh, oneRefresh: refreshCalls === 1, noReplay: noteCalls === 1 };
  for (const [id, ok] of Object.entries(results)) console.log(`AUTH_TERMINAL ${id} ${ok}`);
  return { results, passed: Object.values(results).every(Boolean) };
}
