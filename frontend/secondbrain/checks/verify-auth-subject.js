async function verifyRefreshSubjectIsolation(page) {
  // Synthetic route fixtures only; return counts/booleans, never headers or tokens.
  const TOKEN_A = 'synthetic-access-A';
  const TOKEN_B = 'synthetic-access-B';
  let refreshMode = 'initial-401';
  let noteCalls = 0;
  let identityCalls = 0;
  let checkedCandidate = false;
  let identitySeen;
  const identityResponse = new Promise((resolve) => {
    identitySeen = resolve;
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

  await page.route('**/api/notes/9001', (route) => {
    noteCalls += 1;
    return json(route, 401, { success: false, code: -10401, message: 'expired' });
  });
  await page.route('**/api/auth/refresh', (route) => {
    if (refreshMode === 'candidate-B') {
      refreshMode = 'terminal-401';
      return json(route, 200, {
        success: true,
        code: 200,
        message: 'ok',
        data: { accessToken: TOKEN_B, tokenType: 'Bearer', expiresIn: 3600 },
      });
    }
    if (refreshMode === 'initial-401') initialRefreshSeen();
    return json(route, 401, { success: false, code: -10401, message: 'expired' });
  });
  await page.route('**/api/users/me', (route) => {
    identityCalls += 1;
    checkedCandidate = route.request().headers().authorization === `Bearer ${TOKEN_B}`;
    identitySeen();
    return json(route, 200, {
      id: 2,
      email: 'synthetic-b@example.test',
      name: 'Synthetic B',
      picture: null,
      setAlarm: false,
    });
  });

  console.log('AUTH_SUBJECT startup');
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
  refreshMode = 'candidate-B';
  await page.evaluate(async (token) => {
    const { apiClient } = window.__sbAuthClient;
    const { captureSessionEpoch, useAuthStore } = window.__sbAuthStore;
    useAuthStore.getState().setAccessToken(token);
    useAuthStore.getState().setUser({
      id: 1,
      email: 'synthetic-a@example.test',
      name: 'Synthetic A',
      picture: null,
      setAlarm: false,
    });
    void apiClient.get('/api/notes/9001', { sessionEpoch: captureSessionEpoch() }).catch(() => {});
  }, TOKEN_A);

  let observedIdentity = false;
  await Promise.race([
    identityResponse.then(() => {
      observedIdentity = true;
    }),
    page.waitForTimeout(5000),
  ]);
  await page.waitForTimeout(200);
  const results = {
    checkedCandidate,
    observedIdentity,
    noCrossAccountReplay: noteCalls === 1,
    identityCallsOnce: identityCalls === 1,
  };
  for (const [id, ok] of Object.entries(results)) console.log(`AUTH_SUBJECT ${id} ${ok}`);
  return { results, passed: Object.values(results).every(Boolean) };
}
