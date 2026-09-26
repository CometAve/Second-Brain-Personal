// Run in a separate in-memory Chrome session with the official playwright-cli skill.
// Every token and HTTP response below is synthetic; this checks browser routing, not Google OAuth.
async function verifyAuthRoutes(page) {
  let refreshMode = '500';
  let tokenMode = 'logical-failure';
  let meMode = '200';
  let refreshCalls = 0;
  let tokenCalls = 0;
  let meCalls = 0;
  const results = [];
  const record = (id, ok) => {
    const result = { id, ok: Boolean(ok) };
    results.push(result);
    console.log(`AUTH_ROUTE ${id} ${result.ok}`);
  };
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const token = {
    success: true,
    code: 200,
    message: 'ok',
    data: { accessToken: 'synthetic-route-token', tokenType: 'Bearer', expiresIn: 3600 },
  };
  const user = {
    id: 900001,
    email: 'synthetic-route@example.test',
    name: 'Synthetic Route',
    picture: null,
    setAlarm: false,
  };

  await page.route('**/api/auth/refresh', (route) => {
    refreshCalls += 1;
    if (refreshMode === '500') {
      return json(route, 500, { success: false, code: -10500, message: 'synthetic failure' });
    }
    if (refreshMode === '401') {
      return json(route, 401, { success: false, code: -10401, message: 'synthetic expired' });
    }
    return json(route, 200, token);
  });
  await page.route('**/api/auth/token*', (route) => {
    tokenCalls += 1;
    if (tokenMode === 'logical-failure') {
      return json(route, 200, { success: false, code: -10422, message: 'synthetic failure' });
    }
    return json(route, 200, token);
  });
  await page.route('**/api/users/me', (route) => {
    meCalls += 1;
    if (meMode === '500') {
      return json(route, 500, { success: false, code: -10500, message: 'synthetic failure' });
    }
    return json(route, 200, user);
  });
  await page.route('**/api/notes/recent', (route) =>
    json(route, 200, { success: true, code: 200, message: 'ok', data: [] }),
  );
  await page.route('**/api/notes/graph-nodes', (route) =>
    json(route, 200, { success: true, code: 200, message: 'ok', data: [] }),
  );
  await page.route('**/ai/api/v1/graph/visualization', (route) =>
    json(route, 200, { user_id: user.id, nodes: [], links: [], stats: null }),
  );

  await page.goto('http://localhost:5173/main');
  await page.getByText('로그인 상태를 확인하지 못했습니다.').waitFor();
  record('refresh-500-shows-retry', page.url().endsWith('/main') && refreshCalls === 1);

  refreshMode = '200';
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByRole('button', { name: '사용자 프로필 메뉴' }).waitFor();
  record(
    'retry-restores-main-with-one-identity-check',
    page.url().endsWith('/main') && meCalls === 1,
  );

  refreshMode = '401';
  await page.goto('http://localhost:5173/');
  await page.getByRole('heading', { name: 'Second Brain' }).waitFor();
  record('refresh-401-shows-landing', page.url().endsWith('/') && refreshCalls >= 3);

  tokenMode = 'logical-failure';
  const beforeLogical = tokenCalls;
  await page.goto('http://localhost:5173/auth/callback?code=synthetic-logical-failure');
  await page.waitForURL(/error=login_failed/);
  await page.getByRole('heading', { name: 'Second Brain' }).waitFor();
  record('token-success-false-not-authenticated', tokenCalls === beforeLogical + 1);

  tokenMode = '200';
  meMode = '500';
  const beforeMeFailure = meCalls;
  await page.goto('http://localhost:5173/auth/callback?code=synthetic-me-failure');
  await page.waitForURL(/error=login_failed/);
  await page.getByRole('heading', { name: 'Second Brain' }).waitFor();
  record('token-then-me-500-not-partial-auth', meCalls === beforeMeFailure + 1);

  return { results, passed: results.every((result) => result.ok) };
}
