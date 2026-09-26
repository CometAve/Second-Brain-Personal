/**
 * Authenticated graph regression for playwright-cli run-code --filename.
 * Uses a separate page in the caller's existing browser context. All note and
 * AI responses below are synthetic; no writes or real note contents are used.
 */
async function verifyGraphUi(page) {
  const checks = [];
  const origin = await page.evaluate(() => location.origin);
  const baseId = 2147000000;
  const count = 48;
  const targetId = baseId + 7;
  const title = (index) => `SB Graph QA Node ${String(index).padStart(2, '0')}`;
  const overviewScreenshotPath = '/tmp/second-brain-graph-ui-390-overview.png';
  const searchScreenshotPath = '/tmp/second-brain-graph-ui-390-search.png';
  const createdAt = '2026-09-25T12:00:00Z';
  const savedNodes = Array.from({ length: count }, (_, index) => ({
    noteId: baseId + index + 1,
    title: title(index + 1),
    createdAt,
  }));
  const links = [
    [1, 2, 0.92],
    [2, 3, 0.71],
    [3, 7, 0.63],
    [7, 8, 0.84],
    [8, 48, 0.75],
    // The extra AI-only endpoint must not become a saved note or visible link.
    [1, 49, 0.99],
  ].map(([source, target, score]) => ({
    source: baseId + source,
    target: baseId + target,
    score,
  }));
  const envelope = (data) => ({ success: true, code: 200, message: 'Synthetic success', data });
  const probe = await page.context().newPage();
  let failAi = true;
  let aiRequests = 0;
  let savedRequests = 0;
  let searchRequests = 0;
  let detailRequests = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }
  async function json(route, data, status = 200) {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  }

  try {
    await probe.setViewportSize({ width: 1280, height: 820 });
    await probe.route('**/api/notes/graph-nodes', async (route) => {
      assert(route.request().method() === 'GET', '저장 노트 지도 API는 GET이다');
      savedRequests += 1;
      await json(route, envelope(savedNodes));
    });
    await probe.route('**/ai/api/v1/graph/visualization', async (route) => {
      assert(route.request().method() === 'GET', 'AI 지도 API는 GET이다');
      aiRequests += 1;
      if (failAi) {
        await json(route, { detail: 'Synthetic AI failure' }, 500);
        return;
      }
      await json(route, {
        user_id: 1,
        nodes: [
          ...savedNodes.filter((note) => note.noteId !== baseId + 45),
          { noteId: baseId + 49, title: title(49), createdAt },
        ].map((note) => ({ id: note.noteId, title: note.title, created_at: note.createdAt })),
        links,
        stats: { total_nodes: 48, total_links: 6, avg_connections: 0.25 },
      });
    });
    await probe.route('**/api/notes/recent', (route) =>
      json(
        route,
        envelope(
          savedNodes.slice(0, 10).map(({ noteId, title: text }) => ({
            noteId,
            title: text,
          })),
        ),
      ),
    );
    await probe.route('**/api/notes/search**', async (route) => {
      assert(route.request().method() === 'GET', '검색 API는 GET이다');
      searchRequests += 1;
      await json(
        route,
        envelope({
          results: [
            {
              id: targetId,
              title: title(7),
              content: 'Synthetic graph QA note',
              userId: 1,
              createdAt,
              updatedAt: createdAt,
              remindCount: 0,
            },
          ],
          totalCount: 1,
          currentPage: 0,
          totalPages: 1,
          pageSize: 10,
        }),
      );
    });
    await probe.route(`**/api/notes/${targetId}`, async (route) => {
      assert(route.request().method() === 'GET', '노트 열기는 상세 GET을 보낸다');
      detailRequests += 1;
      await json(
        route,
        envelope({
          noteId: targetId,
          title: title(7),
          content: 'Synthetic graph QA note',
          createdAt,
          updatedAt: createdAt,
          remindAt: null,
          remindCount: 0,
        }),
      );
    });

    await probe.goto(`${origin}/main`);
    await probe.getByText(`저장된 노트 ${count}개 · 분석된 연결 0개`).waitFor();
    await probe.getByRole('alert').filter({ hasText: '노트 연결을 불러오지 못했습니다.' }).waitFor({
      timeout: 20000,
    });
    assert(savedRequests > 0 && aiRequests > 0, '저장 노트와 AI 연결을 각각 요청한다');
    assert((await probe.locator('canvas').count()) > 0, 'AI 500 뒤에도 지도 캔버스를 렌더링한다');
    assert(
      await probe.getByText(`저장된 노트 ${count}개 · 분석된 연결 0개`).isVisible(),
      'AI 500에도 저장된 노트 48개를 유지한다',
    );

    failAi = false;
    const beforeRetry = aiRequests;
    await probe.getByRole('alert').getByRole('button', { name: '다시 시도' }).click();
    await probe.getByText(`저장된 노트 ${count}개 · 분석된 연결 5개`).waitFor();
    assert(aiRequests > beforeRetry, '재시도가 AI 지도 API를 다시 요청한다');
    assert(
      (await probe.getByText(`저장된 노트 ${count}개 · 분석된 연결 5개`).isVisible()) &&
        (await probe.getByText('연결 분석 대기 중').isVisible()),
      '재시도는 저장된 노트 사이의 연결 5개만 표시하고 AI 미분석 노트를 구분한다',
    );

    await probe.setViewportSize({ width: 390, height: 844 });
    for (const name of ['지도 확대', '지도 축소', '모든 노트 보기']) {
      const control = probe.getByRole('button', { name });
      await control.waitFor({ state: 'visible' });
      const box = await control.boundingBox();
      assert(
        box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844,
        `390px 화면에서 ${name} 조작이 화면 안에 있다`,
      );
    }
    assert(
      await probe.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '390px 화면에서 가로 스크롤이 생기지 않는다',
    );
    await probe.getByRole('button', { name: '지도 확대' }).click();
    await probe.getByRole('button', { name: '지도 축소' }).click();
    await probe.getByRole('button', { name: '모든 노트 보기' }).click();
    await probe.screenshot({ path: overviewScreenshotPath });

    const search = probe.getByRole('textbox', { name: '검색' });
    await search.fill(title(7));
    const result = probe.locator('#search-panel [data-note-link]').filter({ hasText: title(7) });
    await result.waitFor();
    assert(searchRequests > 0, '검색 입력이 실제 검색 요청과 결과 행으로 연결된다');
    // Large graphs hide default labels; search should reveal its matching node.
    const graphLabel = probe.locator('div[style*="max-width: 156px"]').filter({
      hasText: title(7),
    });
    await graphLabel.waitFor({ state: 'attached' });
    assert((await graphLabel.count()) === 1, '검색 결과가 큰 지도에서 해당 노드 라벨을 드러낸다');
    await probe.screenshot({ path: searchScreenshotPath });

    await result.click();
    await probe.waitForURL(`**/notes/${targetId}`);
    await probe.getByRole('textbox', { name: '노트 제목' }).waitFor();
    assert(detailRequests > 0, '검색 결과로 연 노트의 상세 내용을 요청한다');
    assert(
      (await probe.getByRole('textbox', { name: '노트 제목' }).inputValue()) === title(7),
      '검색 결과에서 합성 노트 상세 화면으로 이동한다',
    );

    return {
      passed: checks.length,
      checks,
      requests: {
        saved: savedRequests,
        ai: aiRequests,
        search: searchRequests,
        detail: detailRequests,
      },
      screenshots: [overviewScreenshotPath, searchScreenshotPath],
      limitation:
        'Synthetic API responses; animation pause and live AI persistence were not observed.',
    };
  } finally {
    await probe.close();
  }
}
