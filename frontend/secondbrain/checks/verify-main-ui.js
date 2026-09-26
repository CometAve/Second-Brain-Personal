async function verifyMainUi(page) {
  const alphaId = 2147000001;
  const betaId = 2147000002;
  const alphaTitle = 'SB Synthetic Alpha';
  const betaTitle = 'SB Synthetic Beta';
  const envelope = (data) => ({ success: true, code: 200, message: 'Synthetic success', data });
  const note = (id, title) => ({
    id,
    title,
    content: 'Synthetic body',
    userId: 1,
    createdAt: '2026-09-25T12:00:00Z',
    updatedAt: '2026-09-25T12:00:00Z',
    remindCount: 0,
  });
  const seenDeletes = [];
  const checks = [];
  let remaining = [alphaId, betaId];
  let recentGets = 0;
  let searchGets = 0;
  let deleteAttempts = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }

  const recentHandler = async (route) => {
    recentGets += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        envelope(
          remaining.map((id) => ({
            noteId: id,
            title: id === alphaId ? alphaTitle : betaTitle,
          })),
        ),
      ),
    });
  };
  const searchHandler = async (route) => {
    searchGets += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        envelope({
          results: remaining.map((id) => note(id, id === alphaId ? alphaTitle : betaTitle)),
          totalCount: remaining.length,
          currentPage: 0,
          totalPages: remaining.length ? 1 : 0,
          pageSize: 10,
        }),
      ),
    });
  };
  const deleteHandler = async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fulfill({ status: 405, body: 'Synthetic test blocks other note writes' });
      return;
    }
    const body = route.request().postDataJSON();
    seenDeletes.push(body.noteIds);
    deleteAttempts += 1;
    if (deleteAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 500, message: 'Synthetic failure' }),
      });
      return;
    }
    remaining = remaining.filter((id) => !body.noteIds.includes(id));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope(null)),
    });
  };

  assert(page.url().includes('/main'), '현재 탭이 /main이다');
  await page.route('**/api/notes/recent', recentHandler);
  await page.route('**/api/notes/search**', searchHandler);
  await page.route('**/api/notes', deleteHandler);
  try {
    await page.reload();

    const panel = page.locator('#search-panel');
    const toggle = page.locator('#search-panel-toggle');
    const searchInput = page.getByRole('textbox', { name: '검색' });
    await toggle.waitFor();
    assert(await panel.evaluate((element) => element.inert), '닫힌 검색 패널은 inert다');
    await toggle.click();
    await page.getByText(alphaTitle, { exact: true }).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'search-panel-close');
    assert(!(await panel.evaluate((element) => element.inert)), '열린 검색 패널은 활성이다');
    assert(
      !(await toggle.evaluate((element) => element.inert)) &&
        (await toggle.getAttribute('aria-expanded')) === 'true',
      '열린 패널의 토글은 활성이고 펼침 상태를 알린다',
    );
    assert(
      await page.evaluate(() => document.activeElement?.id === 'search-panel-close'),
      '패널 열기 뒤 포커스가 패널 닫기로 이동한다',
    );

    await page.getByRole('button', { name: '삭제 모드 활성화' }).click();
    const firstRecentCheckbox = page.getByRole('checkbox').first();
    await firstRecentCheckbox.focus();
    await page.keyboard.press('Space');
    assert(await firstRecentCheckbox.isChecked(), 'Space가 체크박스를 한 번 선택한다');

    await searchInput.fill('SB Synthetic');
    assert(
      (await searchInput.inputValue()) === 'SB Synthetic' &&
        (await page.getByRole('checkbox').count()) === 0 &&
        (await page.getByRole('button', { name: '삭제 모드 활성화' }).count()) === 1,
      '검색 입력 직후 선택과 삭제 모드가 해제된다',
    );
    await page.getByText(alphaTitle, { exact: true }).waitFor();
    await page.getByText(betaTitle, { exact: true }).waitFor();

    await page.getByRole('button', { name: '삭제 모드 활성화' }).click();
    const firstSearchCheckbox = page.getByRole('checkbox').first();
    await firstSearchCheckbox.focus();
    await page.keyboard.press('Space');
    assert(await firstSearchCheckbox.isChecked(), '검색 결과의 Space 선택이 한 번만 적용된다');
    await page.getByRole('button', { name: '선택 항목 삭제' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert(
      (await dialog.textContent()).includes('선택한 1개의 노트'),
      '삭제 확인 수량이 열 때 고정된다',
    );
    // Synthetic state injection: simulate an asynchronous selection reset while
    // the modal is open. Resolve the exact Vite import used by the live panel
    // so HMR does not create a second Zustand store instance.
    const selectedAfterReset = await page.evaluate(async () => {
      const panelResource =
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.includes('/src/features/main/components/PanelHeader.tsx'))
          .at(-1) ?? '/src/features/main/components/PanelHeader.tsx';
      const panelSource = await (await fetch(panelResource)).text();
      const storeImport = panelSource.match(
        /["'](\/src\/features\/main\/stores\/searchPanelStore\.ts(?:\?[^"']*)?)["']/,
      )?.[1];
      if (!storeImport) throw new Error('Live PanelHeader store import not found');
      const { useSearchPanelStore } = await import(storeImport);
      useSearchPanelStore.getState().deselectAll();
      return useSearchPanelStore.getState().selectedIds.size;
    });
    assert(
      selectedAfterReset === 0 &&
        !(await page.getByRole('checkbox', { includeHidden: true }).first().isChecked()),
      '합성 선택 초기화가 실제 패널 store에 적용된다',
    );
    assert(
      (await dialog.textContent()).includes('선택한 1개의 노트'),
      '확인창 중 선택이 바뀌어도 삭제 수량은 유지된다',
    );

    const searchGetsBeforeSuccess = searchGets;
    const recentGetsBeforeSuccess = recentGets;
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByText('노트 삭제에 실패했습니다').waitFor();
    assert(await dialog.isVisible(), '500 실패 뒤 확인창이 유지된다');
    assert(
      seenDeletes.length === 1 && JSON.stringify(seenDeletes[0]) === JSON.stringify([alphaId]),
      '실패 요청은 확인 시 고정한 ID만 보낸다',
    );

    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert(
      seenDeletes.length === 2 && JSON.stringify(seenDeletes[1]) === JSON.stringify([alphaId]),
      '재시도도 같은 고정 ID만 보낸다',
    );
    await page.getByText(alphaTitle, { exact: true }).waitFor({ state: 'hidden' });
    await page.getByText(betaTitle, { exact: true }).waitFor();
    assert(
      searchGets > searchGetsBeforeSuccess && recentGets > recentGetsBeforeSuccess,
      '삭제 성공 후 검색 및 최근 캐시가 갱신된다',
    );

    await page.getByRole('button', { name: '패널 닫기', exact: true }).click();
    // Panel focus is restored on the next animation frame, after inert is removed.
    await page.waitForFunction(() => document.activeElement?.id === 'search-panel-toggle');
    assert(await panel.evaluate((element) => element.inert), '닫은 검색 패널은 inert다');
    assert(
      await page.evaluate(() => document.activeElement?.id === 'search-panel-toggle'),
      '패널 닫기 뒤 토글에 포커스가 돌아온다',
    );

    const profile = page.getByRole('button', { name: '사용자 프로필 메뉴' });
    await profile.click();
    const firstMenuItem = page.getByRole('menuitem').first();
    await firstMenuItem.waitFor();
    const menu = page.locator('[role="menu"]');
    assert(
      await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem'),
      '프로필 메뉴를 열면 메뉴 항목에 포커스된다',
    );
    await searchInput.evaluate((element) => element.focus());
    await page.keyboard.press('ArrowDown');
    assert(
      await page.evaluate(() => !document.activeElement?.closest('[role="menu"]')),
      '메뉴 밖 검색 입력의 방향키를 프로필 메뉴가 가로채지 않는다',
    );
    await firstMenuItem.focus();
    await page.keyboard.press('Escape');
    assert(
      await menu.evaluate((element) => Boolean(element.closest('[inert]'))),
      'Escape 뒤 메뉴는 inert다',
    );
    assert(
      await profile.evaluate((element) => element === document.activeElement),
      'Escape 뒤 프로필 버튼으로 포커스가 돌아온다',
    );

    await profile.click();
    await page.getByRole('menuitem').first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(
      () => Boolean(document.querySelector('[role="menu"]')?.closest('[inert]')),
      null,
      { timeout: 3000 },
    );
    assert(
      await menu.evaluate((element) => Boolean(element.closest('[inert]'))),
      'Shift+Tab으로 메뉴를 벗어나면 닫힌다',
    );
    await profile.click();
    await page.getByRole('menuitem', { name: 'MCP API Key 관리' }).click();
    const back = page.getByRole('button', { name: '뒤로' });
    await back.waitFor();
    assert(
      await back.evaluate((element) => element === document.activeElement),
      'API Key 관리로 전환하면 뒤로 버튼에 포커스된다',
    );
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(
      () => Boolean(document.querySelector('[role="menu"]')?.closest('[inert]')),
      null,
      { timeout: 3000 },
    );
    assert(
      await menu.evaluate((element) => Boolean(element.closest('[inert]'))),
      'API Key 관리에서도 Tab 이탈 시 메뉴가 닫힌다',
    );
    return { passed: checks.length, checks, seenDeletes, recentGets, searchGets };
  } finally {
    await page.unroute('**/api/notes/recent', recentHandler);
    await page.unroute('**/api/notes/search**', searchHandler);
    await page.unroute('**/api/notes', deleteHandler);
    await page.reload();
  }
}
