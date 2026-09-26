// Existing QA Chrome; real read-only API payloads with explicit synthetic delays.
// Video capture uses a temporary context; its rotated QA cookie is returned to
// the original QA context before cleanup. No note or user data is written.
async function verifyMotionUi(page) {
  const checks = [];
  const positions = [];
  const timelines = [];
  const assert = (ok, label) => {
    if (!ok) throw new Error(label);
    checks.push(label);
  };
  const parent = page.context();
  const context = await parent.browser().newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: '.playwright-cli/ui-ux-evidence/motion-videos',
      size: { width: 1280, height: 900 },
    },
  });
  await context.addCookies(await parent.cookies());
  const probe = await context.newPage();
  const video = probe.video();
  const path = '.playwright-cli/ui-ux-evidence/motion-flow.webm';
  const shot = (name) => probe.screenshot({ path: `.playwright-cli/ui-ux-evidence/${name}.png` });
  const delay = (ms) => probe.waitForTimeout(ms);
  await probe.addInitScript(() => {
    window.__motion = { changes: [], longTasks: [] };
    const visible = (e) => !!e?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    let previous = '';
    new PerformanceObserver((list) =>
      window.__motion.longTasks.push(
        ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    ).observe({ type: 'longtask', buffered: true });
    function sample(t) {
      const dialog = document.querySelector('[role=dialog]');
      const scope = dialog ?? document.querySelector('main') ?? document;
      const canvases = [...scope.querySelectorAll('[role=status] canvas')].filter(visible);
      const graph = scope.querySelector('.scene-container canvas');
      const ready = dialog
        ? visible(scope.querySelector('.ProseMirror'))
        : visible(graph) && !graph?.closest('[inert]');
      const state = {
        loading: canvases.length,
        ready,
        title: visible(scope.querySelector('textarea')),
        empty: (scope.textContent ?? '').includes('저장된 노트가 없습니다.'),
      };
      const key = JSON.stringify(state);
      if (key !== previous) {
        window.__motion.changes.push({ time: t, ...state });
        previous = key;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  async function center(scopeSelector, label) {
    const result = await probe.evaluate((selector) => {
      const area = document.querySelector(selector);
      const c = area.querySelector('[role=status] canvas').getBoundingClientRect();
      const r = area.getBoundingClientRect();
      const style = getComputedStyle(area);
      const left = parseFloat(style.paddingLeft),
        right = parseFloat(style.paddingRight),
        top = parseFloat(style.paddingTop),
        bottom = parseFloat(style.paddingBottom);
      return {
        logo: { x: c.x + c.width / 2, y: c.y + c.height / 2 },
        content: {
          x: r.x + left + (r.width - left - right) / 2,
          y: r.y + top + (r.height - top - bottom) / 2,
        },
        viewport: { width: innerWidth, height: innerHeight },
      };
    }, scopeSelector);
    assert(
      Math.abs(result.logo.x - result.content.x) < 1 &&
        Math.abs(result.logo.y - result.content.y) < 1,
      `${label}: 콘텐츠 중앙 오차 1px 미만`,
    );
    positions.push({ label, ...result });
  }
  try {
    await probe.route('**/api/notes/graph-nodes', async (route) => {
      await delay(1200);
      await route.continue();
    });
    await probe.route('**/api/notes/recent', async (route) => {
      await delay(2500);
      await route.continue();
    });
    await probe.goto('http://localhost:4173/main');
    await probe.waitForFunction(
      () => document.querySelector('main [role=status] canvas')?.style.opacity === '1',
    );
    await center('main', '메인');
    await shot('loading-main-after');
    await probe.getByRole('button', { name: '검색 패널 열기' }).click();
    await probe.locator('#search-panel').evaluate(async (e) => {
      await Promise.all(e.getAnimations().map((a) => a.finished.catch(() => {})));
    });
    await probe.waitForFunction(
      () =>
        document.querySelector('[data-scroll-container] [role=status] canvas')?.style.opacity ===
        '1',
    );
    await center('[data-scroll-container]', '목록');
    await shot('loading-list-after');
    await probe.getByRole('button', { name: 'QA · 읽기와 기록', exact: true }).waitFor();
    await probe.waitForFunction(
      () => !document.querySelector('main [role=status][aria-label="불러오는 중"]'),
    );
    assert(
      (await probe.locator('.scene-container canvas').count()) === 1,
      '그래프 준비 뒤 단일 WebGL canvas 유지',
    );
    timelines.push({ name: 'main/list', ...(await probe.evaluate(() => window.__motion)) });
    await probe.unrouteAll({ behavior: 'wait' });

    // Reverse an in-flight transition with real pointer events (no state injection).
    const toggle = await probe.locator('#search-panel-toggle').boundingBox();
    for (let i = 0; i < 6; i++) {
      await probe.mouse.click(toggle.x + toggle.width / 2, toggle.y + toggle.height / 2);
      await delay(35);
    }
    await delay(230);
    assert(
      await probe
        .locator('#search-panel')
        .evaluate((e) => !e.inert && getComputedStyle(e).opacity === '1'),
      '검색 패널 빠른 왕복 조작 후 최종 열림 상태 일치',
    );
    await probe.getByRole('button', { name: '검색 패널 닫기', exact: true }).click();
    for (const name of ['지도 확대', '지도 축소', '지도 확대', '모든 노트 보기', '지도 축소'])
      await probe.getByRole('button', { name, exact: true }).click();
    await probe.setViewportSize({ width: 390, height: 844 });
    await delay(150);
    assert(
      await probe
        .locator('main')
        .evaluate((e) => Math.abs(e.getBoundingClientRect().height - (innerHeight - 72)) < 1),
      '390px 메인 높이가 헤더 아래 영역과 일치',
    );
    await probe.setViewportSize({ width: 1280, height: 900 });
    await probe.getByRole('button', { name: '사용자 프로필 메뉴' }).click();
    await probe.keyboard.press('Escape');
    await probe.getByRole('button', { name: '사용자 프로필 메뉴' }).click();
    await probe.keyboard.press('Escape');
    assert(
      (await probe
        .getByRole('button', { name: '사용자 프로필 메뉴' })
        .getAttribute('aria-expanded')) === 'false',
      '프로필 메뉴 열기/닫기 반복 후 닫힘',
    );

    await probe.route('**/api/notes/95', async (route) => {
      await delay(900);
      await route.continue();
    });
    await probe.route('**/chunks/NoteEditor-*.js', async (route) => {
      await delay(1900);
      await route.continue();
    });
    const response = probe.waitForResponse(
      (r) => r.url().endsWith('/api/notes/95') && r.status() === 200,
    );
    await probe.goto('http://localhost:4173/notes/95');
    await probe.waitForFunction(
      () => document.querySelector('[role=dialog] [role=status] canvas')?.style.opacity === '1',
    );
    await probe.evaluate(() => {
      window.__firstLoader = document.querySelector('[role=dialog] [role=status] canvas');
    });
    const noteCenter = async (label) => {
      const result = await probe.evaluate(() => {
        const panel = document.querySelector('[role=dialog]').getBoundingClientRect(),
          h = document.querySelector('[role=dialog] header').getBoundingClientRect(),
          c = document.querySelector('[role=dialog] [role=status] canvas').getBoundingClientRect();
        return {
          logo: { x: c.x + c.width / 2, y: c.y + c.height / 2 },
          content: { x: panel.x + panel.width / 2, y: (h.bottom + panel.bottom) / 2 },
        };
      });
      assert(
        Math.abs(result.logo.x - result.content.x) < 1 &&
          Math.abs(result.logo.y - result.content.y) < 1,
        `${label}: toolbar 아래 중앙 유지`,
      );
      positions.push({ label, ...result });
    };
    await noteCenter('노트 데이터');
    await shot('loading-note-data-after');
    await response;
    await delay(200);
    assert(
      await probe.evaluate(
        () => window.__firstLoader === document.querySelector('[role=dialog] [role=status] canvas'),
      ),
      '데이터에서 lazy 편집기 준비로 넘어갈 때 로딩 canvas 재생성 없음',
    );
    await noteCenter('노트 모듈');
    await shot('loading-note-module-after');
    await probe.setViewportSize({ width: 390, height: 844 });
    await noteCenter('390px 노트');
    await probe.locator('.ProseMirror').waitFor({ state: 'visible' });
    assert(
      (await probe.locator('[role=dialog] [role=status] canvas').count()) === 0,
      '편집기 준비 후 로딩 제거',
    );
    assert(
      await probe.getByRole('textbox', { name: '노트 제목' }).isVisible(),
      '편집기와 제목이 함께 표시됨',
    );
    timelines.push({ name: 'note', ...(await probe.evaluate(() => window.__motion)) });
    await probe.unrouteAll({ behavior: 'wait' });
    await probe.getByRole('button', { name: '노트 삭제', exact: true }).click();
    const dialog = probe.getByRole('alertdialog');
    await dialog.waitFor();
    assert(
      await dialog.evaluate((e) => getComputedStyle(e).animationName === 'none'),
      '확인 모달 확대·이동 animation 제거',
    );
    await probe.getByRole('button', { name: '취소', exact: true }).click();
    await probe.getByRole('button', { name: '노트 삭제', exact: true }).click();
    await probe.getByRole('button', { name: '취소', exact: true }).click();
    assert(await probe.locator('.ProseMirror').isVisible(), '확인 모달 반복 취소 후 본문 유지');
    await probe.getByRole('button', { name: '저장 후 닫기', exact: true }).click();
    await probe.waitForURL('**/main');
    await probe.getByRole('button', { name: '검색 패널 열기' }).click();
    await probe.getByRole('button', { name: 'QA · 읽기와 기록', exact: true }).click();
    await probe.locator('.ProseMirror').waitFor({ state: 'visible' });
    assert(
      (await probe.getByRole('textbox', { name: '노트 제목' }).inputValue()) === 'QA · 읽기와 기록',
      '캐시 재진입은 해당 노트 제목·본문 유지',
    );

    // Delayed request closed before completion must never reopen its editor.
    await probe.route('**/api/notes/90', async (route) => {
      await delay(1600);
      await route.continue().catch(() => {});
    });
    await probe.goto('http://localhost:4173/notes/90');
    await probe.getByRole('dialog', { name: '노트 편집' }).waitFor();
    await probe.getByRole('button', { name: '닫기', exact: true }).click();
    await probe.waitForURL('**/main');
    await delay(1900);
    assert(
      (await probe.getByRole('dialog').count()) === 0,
      '노트 로딩 중 닫은 뒤 늦은 응답이 패널을 열지 않음',
    );
    await probe.unrouteAll({ behavior: 'wait' });

    await probe.emulateMedia({ reducedMotion: 'reduce' });
    await probe.getByRole('button', { name: '검색 패널 열기' }).click();
    assert(
      await probe
        .locator('#search-panel')
        .evaluate(
          (e) =>
            getComputedStyle(e).transitionProperty === 'none' && e.getAnimations().length === 0,
        ),
      '동작 줄이기: 검색 패널 전환 없음',
    );
    await probe.getByRole('button', { name: '검색 패널 닫기', exact: true }).click();
    await probe.route('**/api/drafts/**', async (route) => {
      await delay(1200);
      await route.continue().catch(() => {});
    });
    await probe.getByRole('button', { name: '새 노트 작성' }).click();
    await probe.getByRole('dialog', { name: '노트 편집' }).waitFor();
    const panelStyle = await probe.getByRole('dialog', { name: '노트 편집' }).evaluate((e) => ({
      animation: getComputedStyle(e).animationName,
      transition: getComputedStyle(e).transitionProperty,
      active: e.getAnimations().length,
    }));
    assert(
      panelStyle.animation === 'none' &&
        panelStyle.transition === 'none' &&
        panelStyle.active === 0,
      '동작 줄이기: 편집 패널 animation/transition 없음',
    );
    await probe.getByRole('button', { name: '닫기', exact: true }).click();
    await probe.waitForURL('**/main');
    await delay(1400);
    assert(
      (await probe.getByRole('dialog').count()) === 0,
      '초안 로딩 중 닫기 후 늦은 결과 표시 없음',
    );
    return {
      passed: true,
      scope:
        'Real QA GET data; synthetic API/chunk delays; real pointer/menu/resize events; no content edits or deletes',
      checks,
      positions,
      timelines,
      video: path,
    };
  } catch (error) {
    await shot('motion-failure');
    return {
      passed: false,
      error: String(error),
      checks,
      positions,
      timelines,
      url: probe.url(),
      body: await probe.locator('body').innerText(),
    };
  } finally {
    await probe.unrouteAll({ behavior: 'ignoreErrors' });
    await parent.addCookies(await context.cookies());
    await context.close();
    if (video) await video.saveAs(path);
  }
}
