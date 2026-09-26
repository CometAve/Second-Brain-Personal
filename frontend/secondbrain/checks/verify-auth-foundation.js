async function verifyAuthFoundation(page) {
  // Run in a separate synthetic Chrome session; never reuse the user's session.
  // Public APIs exercised by this check:
  //   src/stores/authStore.ts:
  //     useAuthStore, sessionEpoch, captureSessionEpoch(), isCurrentSession(epoch),
  //     assertCurrentSession(epoch), StaleSessionError.
  //   src/shared/api/responseSchemas.ts:
  //     parseSuccessEnvelope(input, parseData) -- data remains unknown for the endpoint parser.
  // Recent-response parser: src/features/main/services/searchService.ts.
  // This file uses only synthetic token labels; it must never return/log cookies,
  // Authorization headers, response bodies, API keys, fixture account data, or raw errors.

  const results = [];
  const record = (id, ok) => {
    const result = { id, ok: Boolean(ok) };
    results.push(result);
    console.log(`AUTH_CHECK ${id} ${result.ok}`);
  };
  const SYNTHETIC_A = 'synthetic-access-A';
  const SYNTHETIC_B = 'synthetic-access-B';
  const fixture = {
    noteMode: 'idle',
    refreshMode: '401',
    noteCalls: 0,
    refreshCalls: 0,
    refreshToken: SYNTHETIC_A,
    identityCalls: 0,
    identityMode: 'A',
    logoutCalls: 0,
    logoutMode: '500',
    logoutHeaderMatches: false,
    waitBeforeRefreshReply: null,
    signalRefreshSeen: null,
  };
  let initialRefreshSeen;
  const initialRefresh = new Promise((resolve) => {
    initialRefreshSeen = resolve;
  });
  const json = (route, status, data) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  const tokenEnvelope = (token) => ({
    success: true,
    code: 200,
    message: 'ok',
    data: { accessToken: token, tokenType: 'Bearer', expiresIn: 3600 },
  });

  await page.route('**/api/auth/refresh', async (route) => {
    fixture.refreshCalls += 1;
    if (fixture.refreshCalls === 1) initialRefreshSeen();
    fixture.signalRefreshSeen?.();
    if (fixture.waitBeforeRefreshReply) await fixture.waitBeforeRefreshReply;
    if (fixture.refreshMode === '200') return json(route, 200, tokenEnvelope(fixture.refreshToken));
    if (fixture.refreshMode === '500')
      return json(route, 500, { success: false, code: -10500, message: 'synthetic failure' });
    return json(route, 401, { success: false, code: -10416, message: 'synthetic expired' });
  });
  await page.route('**/api/notes/9001', async (route) => {
    fixture.noteCalls += 1;
    if (fixture.noteMode === '403')
      return json(route, 403, { success: false, code: -10423, message: 'synthetic forbidden' });
    if (fixture.noteMode === 'replay-500' && fixture.noteCalls > 1) {
      return json(route, 500, { success: false, code: -10500, message: 'synthetic failure' });
    }
    return json(route, 401, { status: 401, message: 'synthetic expired' });
  });
  await page.route('**/api/notes/9002', async (route) => {
    fixture.noteCalls += 1;
    return json(route, 401, { status: 401, message: 'synthetic expired' });
  });
  let lateReadSeen;
  let releaseLateRead;
  let lateReadGate = null;
  let lateReadCalls = 0;
  await page.route('**/api/notes/9003', async (route) => {
    lateReadCalls += 1;
    lateReadSeen?.();
    if (lateReadGate) await lateReadGate;
    return json(route, 200, { success: true, code: 200, message: 'ok', data: { noteId: 9003 } });
  });
  let oldDispatchCalls = 0;
  await page.route('**/api/notes/9004', (route) => {
    oldDispatchCalls += 1;
    return json(route, 200, { success: true, code: 200, message: 'ok' });
  });
  await page.route('**/api/users/me', (route) => {
    fixture.identityCalls += 1;
    const id = fixture.identityMode === 'B' ? 2 : 1;
    return json(route, 200, {
      id,
      email: `synthetic-${id}@example.test`,
      name: `Synthetic ${id}`,
      picture: null,
      setAlarm: false,
    });
  });
  await page.route('**/api/auth/logout', (route) => {
    fixture.logoutCalls += 1;
    fixture.logoutHeaderMatches =
      route.request().headers().authorization === `Bearer ${SYNTHETIC_A}`;
    if (fixture.logoutMode === '500') {
      return json(route, 500, { success: false, code: -10500, message: 'synthetic failure' });
    }
    return json(route, 200, { success: true, code: 200, message: 'ok' });
  });
  let recentMode = 'empty';
  await page.route('**/api/notes/recent', async (route) => {
    if (recentMode === 'empty')
      return json(route, 200, { success: true, code: 200, message: 'ok' });
    if (recentMode === 'malformed')
      return json(route, 200, {
        success: true,
        code: 200,
        message: 'ok',
        data: [{ noteId: 'bad' }],
      });
    return json(route, 200, { success: false, code: -10500, message: 'synthetic failure' });
  });

  // The app may redirect while the synthetic refresh route returns 401.
  console.log('AUTH_CHECK startup');
  await page.goto('http://localhost:5173/');
  let initialReady = false;
  await Promise.race([
    initialRefresh.then(() => {
      initialReady = true;
    }),
    page.waitForTimeout(5000),
  ]);
  record('initial-refresh-observed', initialReady);
  if (!initialReady) return { results, passed: false };
  console.log('AUTH_CHECK landing-loaded');
  const modulesReady = await page.evaluate(async () => {
    try {
      const [searchSource, authSource] = await Promise.all([
        fetch('/src/features/main/services/searchService.ts').then((response) => response.text()),
        fetch('/src/features/auth/services/authService.ts').then((response) => response.text()),
      ]);
      const clientPattern = /from\s+["']([^"']*\/api\/client\.ts[^"']*)["']/;
      const searchClientUrl = searchSource.match(clientPattern)?.[1];
      const authClientUrl = authSource.match(clientPattern)?.[1];
      if (!searchClientUrl || searchClientUrl !== authClientUrl) return false;
      const clientSource = await fetch(searchClientUrl).then((response) => response.text());
      const storeUrl = clientSource.match(
        /from\s+["']([^"']*\/stores\/authStore\.ts[^"']*)["']/,
      )?.[1];
      if (!storeUrl) return false;
      const [store, schemas, main, client] = await Promise.all([
        import(storeUrl),
        import('/src/shared/api/responseSchemas.ts'),
        import('/src/features/main/services/searchService.ts'),
        import(searchClientUrl),
      ]);
      window.__sbAuthStore = store;
      window.__sbAuthClient = client;
      return Boolean(
        store.captureSessionEpoch &&
        store.isCurrentSession &&
        store.assertCurrentSession &&
        schemas.parseSuccessEnvelope &&
        main.searchAPI &&
        client.apiClient,
      );
    } catch {
      return false;
    }
  });
  record('public-modules', modulesReady);
  if (!modulesReady) return { results, passed: false, reason: 'planned API not implemented' };

  const pure = await page.evaluate(async () => {
    const { parseSuccessEnvelope } = await import('/src/shared/api/responseSchemas.ts');
    const { parseTokenResponse, parseUserResponse } =
      await import('/src/features/auth/schemas/authSchemas.ts');
    const { captureSessionEpoch, isCurrentSession, assertCurrentSession, useAuthStore } =
      window.__sbAuthStore;
    const parseNumber = (data) => {
      if (typeof data !== 'number' || !Number.isInteger(data)) throw new Error('invalid data');
      return data;
    };
    const valid =
      parseSuccessEnvelope({ success: true, code: 200, message: 'ok', data: 7 }, parseNumber) === 7;
    const validToken =
      parseTokenResponse({
        success: true,
        code: 200,
        message: 'ok',
        data: {
          accessToken: 'synthetic-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
      }).tokenType === 'Bearer';
    const validUser =
      parseUserResponse({
        id: 1,
        email: 'synthetic@example.test',
        name: 'Synthetic',
        picture: null,
        setAlarm: false,
      }).id === 1;
    let rejectedFalse = false;
    let rejectedInvalid = false;
    let rejectedToken = false;
    let rejectedUser = false;
    try {
      parseSuccessEnvelope({ success: false, code: -1, message: 'no', data: 7 }, parseNumber);
    } catch {
      rejectedFalse = true;
    }
    try {
      parseSuccessEnvelope({ success: true, code: 200, message: 'ok', data: '7' }, parseNumber);
    } catch {
      rejectedInvalid = true;
    }
    try {
      parseTokenResponse({ success: true, code: 200, message: 'ok', data: { accessToken: 42 } });
    } catch {
      rejectedToken = true;
    }
    try {
      parseUserResponse({ id: '1', email: 'synthetic@example.test' });
    } catch {
      rejectedUser = true;
    }
    const oldEpoch = captureSessionEpoch();
    const currentBefore = isCurrentSession(oldEpoch);
    // Synthetic lifetime advance only; the production login/logout action is tested by UI later.
    useAuthStore.setState((state) => ({ sessionEpoch: state.sessionEpoch + 1 }));
    const oldRetired = !isCurrentSession(oldEpoch);
    let assertRejected = false;
    try {
      assertCurrentSession(oldEpoch);
    } catch {
      assertRejected = true;
    }
    return {
      valid,
      validToken,
      validUser,
      rejectedFalse,
      rejectedInvalid,
      rejectedToken,
      rejectedUser,
      currentBefore,
      oldRetired,
      assertRejected,
    };
  });
  Object.entries(pure).forEach(([id, ok]) => record(`pure-${id}`, ok));

  const recent = async () =>
    page.evaluate(async () => {
      const { searchAPI } = await import('/src/features/main/services/searchService.ts');
      const { captureSessionEpoch } = window.__sbAuthStore;
      try {
        const value = await searchAPI.getRecentNote(captureSessionEpoch());
        return { resolved: true, isEmptyArray: Array.isArray(value) && value.length === 0 };
      } catch {
        return { resolved: false, isEmptyArray: false };
      }
    });
  recentMode = 'empty';
  const emptyRecent = await recent();
  record('recent-valid-omitted-data', emptyRecent.resolved && emptyRecent.isEmptyArray);
  recentMode = 'malformed';
  record('recent-reject-malformed', !(await recent()).resolved);
  recentMode = 'failure';
  record('recent-reject-success-false', !(await recent()).resolved);

  const setSyntheticToken = (token) =>
    page.evaluate(async (value) => {
      const { useAuthStore } = window.__sbAuthStore;
      useAuthStore.getState().setAccessToken(value);
    }, token);
  const setSyntheticUserA = () =>
    page.evaluate(async () => {
      const { useAuthStore } = window.__sbAuthStore;
      useAuthStore.getState().setUser({
        id: 1,
        email: 'synthetic-1@example.test',
        name: 'Synthetic 1',
        picture: null,
        setAlarm: false,
      });
    });
  const getSyntheticTokenChecks = () =>
    page.evaluate(async () => {
      const { useAuthStore } = window.__sbAuthStore;
      const token = useAuthStore.getState().accessToken;
      return {
        hasToken: typeof token === 'string' && token.length > 0,
        isB: token === 'synthetic-access-B',
      };
    });
  const protectedGet = (path) =>
    page.evaluate(async (p) => {
      const { apiClient } = window.__sbAuthClient;
      const { captureSessionEpoch } = window.__sbAuthStore;
      try {
        await apiClient.get(p, { sessionEpoch: captureSessionEpoch() });
        return { resolved: true, status: null };
      } catch (error) {
        return {
          resolved: false,
          status: typeof error?.response?.status === 'number' ? error.response.status : null,
        };
      }
    }, path);

  const missingEpoch = await page.evaluate(async () => {
    const { apiClient } = window.__sbAuthClient;
    try {
      await apiClient.get('/api/notes/9001');
      return false;
    } catch {
      return true;
    }
  });
  record('missing-epoch-blocks-dispatch', missingEpoch && fixture.noteCalls === 0);

  const oldDispatchBlocked = await page.evaluate(async () => {
    const { apiClient } = window.__sbAuthClient;
    const { captureSessionEpoch, useAuthStore } = window.__sbAuthStore;
    const pending = apiClient.get('/api/notes/9004', { sessionEpoch: captureSessionEpoch() });
    useAuthStore.getState().clearAuth();
    try {
      await pending;
      return false;
    } catch {
      return true;
    }
  });
  record('old-epoch-before-dispatch', oldDispatchBlocked && oldDispatchCalls === 0);

  await setSyntheticToken(SYNTHETIC_A);
  fixture.noteMode = '403';
  fixture.noteCalls = 0;
  fixture.refreshCalls = 0;
  const forbidden = await protectedGet('/api/notes/9001');
  record(
    '403-no-refresh',
    !forbidden.resolved &&
      forbidden.status === 403 &&
      fixture.noteCalls === 1 &&
      fixture.refreshCalls === 0,
  );

  await setSyntheticToken(SYNTHETIC_A);
  fixture.noteMode = 'always-401';
  fixture.refreshMode = '500';
  fixture.noteCalls = 0;
  fixture.refreshCalls = 0;
  const transientRefresh = await protectedGet('/api/notes/9001');
  const afterTransient = await getSyntheticTokenChecks();
  record(
    'refresh-500-preserves-session',
    !transientRefresh.resolved &&
      afterTransient.hasToken &&
      fixture.refreshCalls === 1 &&
      fixture.noteCalls === 1,
  );

  await setSyntheticToken(SYNTHETIC_A);
  fixture.noteMode = 'replay-500';
  fixture.refreshMode = '200';
  fixture.noteCalls = 0;
  fixture.refreshCalls = 0;
  const replayFailure = await protectedGet('/api/notes/9001');
  const afterReplay = await getSyntheticTokenChecks();
  record(
    'replay-500-not-logout',
    !replayFailure.resolved &&
      replayFailure.status === 500 &&
      afterReplay.hasToken &&
      fixture.refreshCalls === 1 &&
      fixture.noteCalls === 2,
  );

  await setSyntheticToken(SYNTHETIC_A);
  await setSyntheticUserA();
  fixture.noteMode = 'replay-500';
  fixture.noteCalls = 0;
  fixture.refreshCalls = 0;
  fixture.identityCalls = 0;
  fixture.refreshMode = '200';
  fixture.refreshToken = SYNTHETIC_A;
  fixture.identityMode = 'A';
  const sameIdentity = await protectedGet('/api/notes/9001');
  record(
    'refresh-same-subject-checks-before-replay',
    !sameIdentity.resolved &&
      sameIdentity.status === 500 &&
      fixture.identityCalls === 1 &&
      fixture.noteCalls === 2,
  );

  fixture.logoutMode = '500';
  fixture.logoutCalls = 0;
  const failedLogout = await page.evaluate(async () => {
    const { logout } = await import('/src/features/auth/services/authService.ts');
    const { captureSessionEpoch } = window.__sbAuthStore;
    try {
      await logout(captureSessionEpoch());
      return false;
    } catch {
      return true;
    }
  });
  const retainedAfterLogoutFailure = await getSyntheticTokenChecks();
  record(
    'logout-500-fails-with-session-retained',
    failedLogout &&
      retainedAfterLogoutFailure.hasToken &&
      fixture.logoutCalls === 1 &&
      fixture.logoutHeaderMatches,
  );
  fixture.logoutMode = '200';
  const successfulLogout = await page.evaluate(async () => {
    const { logout } = await import('/src/features/auth/services/authService.ts');
    const { captureSessionEpoch } = window.__sbAuthStore;
    try {
      await logout(captureSessionEpoch());
      return true;
    } catch {
      return false;
    }
  });
  record(
    'logout-200-validated',
    successfulLogout && fixture.logoutCalls === 2 && fixture.logoutHeaderMatches,
  );

  // A successful HTTP response arriving after account turnover must not populate B's cache.
  await setSyntheticToken(SYNTHETIC_A);
  const seenLateRead = new Promise((resolve) => {
    lateReadSeen = resolve;
  });
  lateReadGate = new Promise((resolve) => {
    releaseLateRead = resolve;
  });
  const staleRead = protectedGet('/api/notes/9003');
  let observedLateRead = false;
  await Promise.race([
    seenLateRead.then(() => {
      observedLateRead = true;
    }),
    page.waitForTimeout(5000),
  ]);
  if (observedLateRead) {
    await page.evaluate(async () => {
      const { useAuthStore } = window.__sbAuthStore;
      useAuthStore.getState().clearAuth();
      useAuthStore.getState().setAccessToken('synthetic-access-B');
    });
  }
  releaseLateRead();
  releaseLateRead = null;
  lateReadGate = null;
  lateReadSeen = null;
  const lateResult = await staleRead.catch(() => ({ resolved: false }));
  record(
    'old-success-response-rejected',
    observedLateRead && lateReadCalls === 1 && !lateResult.resolved,
  );

  // Hold A's refresh response, advance to B, then release A. No A retry or B mutation.
  await setSyntheticToken(SYNTHETIC_A);
  fixture.noteCalls = 0;
  fixture.refreshCalls = 0;
  fixture.refreshMode = '200';
  let releaseRefresh;
  fixture.waitBeforeRefreshReply = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  let seenRefresh;
  const refreshSeen = new Promise((resolve) => {
    seenRefresh = resolve;
  });
  fixture.signalRefreshSeen = seenRefresh;
  const epochA = await page.evaluate(async () => {
    const { captureSessionEpoch } = window.__sbAuthStore;
    return captureSessionEpoch();
  });
  const staleRequest = protectedGet('/api/notes/9002');
  let sawRefresh = false;
  await Promise.race([
    refreshSeen.then(() => {
      sawRefresh = true;
    }),
    page.waitForTimeout(5000),
  ]);
  if (sawRefresh) {
    await page.evaluate(async () => {
      const { useAuthStore } = window.__sbAuthStore;
      useAuthStore.getState().clearAuth();
      useAuthStore.getState().setAccessToken('synthetic-access-B');
    });
  }
  const epochAIsRetired = await page.evaluate(async (oldEpoch) => {
    const { isCurrentSession } = window.__sbAuthStore;
    return !isCurrentSession(oldEpoch);
  }, epochA);
  releaseRefresh();
  fixture.waitBeforeRefreshReply = null;
  fixture.signalRefreshSeen = null;
  const staleOutcome = await staleRequest.catch(() => ({ resolved: false, status: null }));
  const afterSwitch = await getSyntheticTokenChecks();
  record(
    'old-refresh-cannot-replay-under-B',
    sawRefresh &&
      epochAIsRetired &&
      !staleOutcome.resolved &&
      afterSwitch.isB &&
      fixture.noteCalls === 1,
  );

  // Never include actual headers, cookies, tokens, or response bodies in the result.
  return { results, passed: results.every((item) => item.ok) };
}
