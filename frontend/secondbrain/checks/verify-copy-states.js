/** Disposable pages, synthetic empty/error data, and an isolated signed-out context.
 * No note writes and no external Google sign-in are performed.
 */
async function verifyCopyStates(page) {
  const checks = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
    checks.push(message);
  };
  const envelope = (data) => ({ success: true, code: 200, message: 'Synthetic QA', data });
  const probe = await page.context().newPage();
  let phase = 'loading';
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let graphRequested = false;
  const json = (route, data, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  try {
    await probe.route('**/api/notes/graph-nodes', async (route) => {
      graphRequested = true;
      if (phase === 'loading') await gate;
      return phase === 'error'
        ? json(route, { success: false, message: 'Synthetic failure' }, 500)
        : json(route, envelope([]));
    });
    await probe.route('**/api/notes/recent', (route) => json(route, envelope([])));
    await probe.route('**/api/notes/search**', (route) =>
      json(
        route,
        envelope({ results: [], totalCount: 0, currentPage: 0, totalPages: 0, pageSize: 10 }),
      ),
    );
    await probe.setViewportSize({ width: 1440, height: 1000 });
    await probe.goto('http://localhost:5173/main');
    await probe.getByRole('status', { name: '불러오는 중', exact: true }).waitFor();
    assert(
      !(await probe.getByText('저장된 노트가 없습니다.', { exact: true }).isVisible()),
      '조회 중을 빈 상태로 표시하지 않는다',
    );
    phase = 'empty';
    release();
    await probe.getByText('저장된 노트가 없습니다.', { exact: true }).waitFor();
    assert(graphRequested, '저장 노트 응답이 빈 상태의 근거다');
    assert(
      await probe.getByRole('button', { name: '새 노트 작성' }).isVisible(),
      '빈 화면에서도 상단 새 노트에 접근한다',
    );
    assert(
      (await probe.getByRole('button', { name: '새 노트 작성' }).count()) === 1 &&
        (await probe.getByText('첫 노트를 작성해 보세요').count()) === 0,
      '중앙의 중복 작성 버튼과 권유 제목을 제거했다',
    );
    await probe.evaluate(() => document.fonts.ready);
    await probe.screenshot({ path: '.playwright-cli/ui-ux-evidence/empty-after.png' });
    for (const width of [320, 390]) {
      await probe.setViewportSize({ width, height: 844 });
      const box = await probe.getByRole('button', { name: '새 노트 작성' }).boundingBox();
      assert(
        box && box.x >= 0 && box.x + box.width <= width,
        `${width}px에서 새 노트 버튼이 화면 안에 있다`,
      );
      assert(
        !(await probe.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `${width}px 빈 화면에 가로 넘침이 없다`,
      );
    }
    await probe.screenshot({ path: '.playwright-cli/ui-ux-evidence/empty-390.png' });
    await probe.getByRole('textbox', { name: '검색', exact: true }).fill('없는 검색어');
    await probe.getByText('검색 결과가 없습니다.', { exact: true }).waitFor();
    assert(
      await probe.getByRole('region', { name: '노트 검색 결과' }).isVisible(),
      '검색 결과 없음은 별도 검색 영역에서 전달한다',
    );
    assert(
      (await probe.getByText('다른 단어나 짧은 검색어로 찾아보세요.').count()) === 0,
      '빈 검색의 반복 권유를 제거했다',
    );
    await probe.keyboard.press('Escape');
    phase = 'error';
    await probe.reload();
    await probe
      .getByRole('alert')
      .filter({ hasText: '저장된 노트를 불러오지 못했습니다.' })
      .waitFor();
    assert(
      !(await probe.getByText('저장된 노트가 없습니다.', { exact: true }).isVisible()),
      '조회 오류를 빈 상태로 숨기지 않는다',
    );
    phase = 'empty';
    await probe.getByRole('button', { name: '다시 시도', exact: true }).click();
    await probe.getByText('저장된 노트가 없습니다.', { exact: true }).waitFor();
    assert(true, '조회 오류 뒤 다시 시도해 실제 새 응답 상태를 표시한다');
  } finally {
    release();
    await probe.close();
  }
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const landing = await context.newPage();
    await landing.goto('http://localhost:5173/');
    const login = landing.getByRole('button', { name: 'Google로 로그인' });
    await login.waitFor();
    await landing.evaluate(() => document.fonts.ready);
    assert(
      (await landing.locator('main').innerText()).trim() === 'Second Brain\nGoogle로 로그인',
      '랜딩에 제품명과 로그인 행동만 남았다',
    );
    assert(
      await landing
        .locator('main img')
        .evaluate(
          (img) =>
            img.complete && img.naturalWidth > 0 && img.getAttribute('src').includes('Logo.svg'),
        ),
      '랜딩에 기존 로고 자산이 표시된다',
    );
    await landing.keyboard.press('Tab');
    assert(
      await login.evaluate((el) => el === document.activeElement),
      'Tab으로 로그인 버튼에 바로 접근한다',
    );
    await landing.screenshot({
      path: '.playwright-cli/ui-ux-evidence/landing-after.png',
    });
    for (const width of [320, 390]) {
      await landing.setViewportSize({ width, height: 844 });
      assert(
        !(await landing.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `${width}px 랜딩에 가로 넘침이 없다`,
      );
      assert(await login.isVisible(), `${width}px에서 로그인 버튼을 볼 수 있다`);
    }
    await landing.screenshot({ path: '.playwright-cli/ui-ux-evidence/landing-390.png' });
    let requested = false;
    await landing.route('**/oauth2/authorization/google**', async (route) => {
      requested = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<p>QA OAuth destination intercepted</p>',
      });
    });
    await login.click();
    await landing.getByText('QA OAuth destination intercepted').waitFor();
    assert(requested, '로그인 클릭이 기존 Google OAuth 진입 경로로 이동한다');
  } finally {
    await context.close();
  }
  return {
    passed: checks.length,
    checks,
    scope:
      'Synthetic empty/loading/error/search; actual signed-out layout and intercepted OAuth destination, not Google provider sign-in',
  };
}
