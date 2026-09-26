/**
 * Run with playwright-cli run-code --filename from the repository root.
 * Authentication and graph responses are synthetic in an isolated context.
 * React Fiber inspection below is test-only: ForceGraph3D exposes its public
 * camera and projection methods through a ref owned inside the application.
 */
async function verifyGraphCamera(page) {
  const origin = await page.evaluate(() => `${location.protocol}//${location.hostname}:5173`);
  const context = await page.context().browser().newContext();
  const probe = await context.newPage();
  const baseId = 2147100000;
  const createdAt = '2026-09-25T12:00:00Z';
  const envelope = (data) => ({ success: true, code: 200, message: 'Synthetic success', data });
  const results = [];
  const failureScreenshot = '/tmp/second-brain-graph-camera-failure.png';
  const fixtures = [
    { count: 2, width: 1280, height: 900, delayedAi: false },
    { count: 3, width: 1280, height: 900, delayedAi: false },
    { count: 48, width: 1280, height: 900, delayedAi: true },
    { count: 2, width: 390, height: 844, delayedAi: false },
    { count: 3, width: 390, height: 844, delayedAi: false },
    { count: 48, width: 390, height: 844, delayedAi: true },
  ];
  let fixture = fixtures[0];
  let savedRequests = 0;
  let aiRequests = 0;
  let updatedTitle = false;
  let failSavedRequests = false;
  let nodeIdOffset = 0;
  let lastSnapshot = null;
  let stage = 'setup';
  let aiGate = Promise.resolve();
  let releaseAiGate = null;

  function savedNodes() {
    return Array.from({ length: fixture.count }, (_, index) => ({
      noteId: baseId + nodeIdOffset + index + 1,
      title: `SB Camera QA ${index + 1}${updatedTitle && index === 0 ? ' updated' : ''}${nodeIdOffset ? ' replacement' : ''}`,
      createdAt,
    }));
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function cameraDistance(snapshot) {
    return Math.hypot(snapshot.camera.x, snapshot.camera.y, snapshot.camera.z);
  }

  async function fulfillJson(route, data, status = 200) {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  }

  // The node positions and projection are read from the mounted renderer,
  // rather than inferred from labels or a screenshot. The renderer ref methods
  // (camera and graph2ScreenCoords) are supported ForceGraph3D public methods.
  async function inspect() {
    return probe.evaluate(() => {
      const canvas = document.querySelector('main .scene-container canvas');
      if (!canvas) return { error: 'Graph canvas absent' };
      const rect = canvas.getBoundingClientRect();
      let graph = null;
      let client = null;
      let fiberCount = 0;
      for (let element = canvas; element; element = element.parentElement) {
        const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'));
        if (!key) continue;
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          fiberCount += 1;
          const candidate = fiber.ref?.current;
          if (
            !graph &&
            candidate &&
            typeof candidate.camera === 'function' &&
            typeof candidate.graph2ScreenCoords === 'function'
          ) {
            graph = candidate;
          }
          if (!client && typeof fiber.memoizedProps?.client?.refetchQueries === 'function') {
            client = fiber.memoizedProps.client;
          }
        }
        if (graph && client) break;
      }
      if (!graph) return { error: 'ForceGraph3D ref absent', rect: rect.toJSON(), fiberCount };
      const camera = graph.camera();
      const nodes = [];
      // Three's live scene is authoritative after React swaps graphData; a
      // host element's private Fiber return chain may point at an old alternate.
      graph.scene().traverse((object) => {
        if (object.__graphObjType !== 'node' || !object.__data) return;
        const node = object.__data;
        const position = { x: object.position.x, y: object.position.y, z: object.position.z };
        const local = graph.graph2ScreenCoords(position.x, position.y, position.z);
        nodes.push({
          id: node.id,
          title: node.title,
          position,
          screen: { x: rect.left + local.x, y: rect.top + local.y },
        });
      });
      return {
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        nodes,
        hasQueryClient: Boolean(client),
        fiberCount,
      };
    });
  }

  function assertVisible(snapshot, expectedCount, stage) {
    assert(!snapshot.error, `${stage}: ${snapshot.error ?? 'unknown projection error'}`);
    assert(
      snapshot.nodes.length === expectedCount,
      `${stage}: expected ${expectedCount} mounted nodes`,
    );
    const inset = 12;
    const outside = snapshot.nodes.filter(
      (node) =>
        !Number.isFinite(node.position.x) ||
        !Number.isFinite(node.position.y) ||
        !Number.isFinite(node.position.z) ||
        !Number.isFinite(node.screen.x) ||
        !Number.isFinite(node.screen.y) ||
        node.screen.x < snapshot.rect.left + inset ||
        node.screen.x > snapshot.rect.right - inset ||
        node.screen.y < snapshot.rect.top + inset ||
        node.screen.y > snapshot.rect.bottom - inset,
    );
    assert(
      outside.length === 0,
      `${stage}: ${outside.length}/${expectedCount} nodes outside canvas inset (${outside.map((node) => node.id).join(', ')})`,
    );
  }

  async function refetchSavedNodes() {
    return probe.evaluate(async () => {
      const root =
        document.querySelector('main .scene-container canvas') ?? document.querySelector('main');
      for (let element = root; element; element = element.parentElement) {
        const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'));
        if (!key) continue;
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          const client = fiber.memoizedProps?.client;
          if (typeof client?.refetchQueries === 'function') {
            await client.refetchQueries({ queryKey: ['notes', 'graph'], type: 'active' });
            return true;
          }
        }
      }
      return false;
    });
  }

  try {
    await probe.route('**/api/auth/refresh', (route) =>
      fulfillJson(
        route,
        envelope({
          accessToken: 'synthetic-camera-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
        }),
      ),
    );
    await probe.route('**/api/users/me', (route) =>
      fulfillJson(route, {
        id: 900002,
        email: 'synthetic-camera@example.test',
        name: 'Camera QA',
        picture: null,
        setAlarm: false,
      }),
    );
    // Disallow note mutations in the disposable page. All graph responses are
    // synthetic, and this test never opens a real note or submits a form.
    await probe.route('**/api/notes/**', async (route) => {
      if (route.request().method() !== 'GET') {
        await fulfillJson(route, { detail: 'Synthetic test is read-only' }, 405);
        return;
      }
      await route.continue();
    });
    await probe.route('**/api/notes/graph-nodes', async (route) => {
      assert(route.request().method() === 'GET', 'Graph nodes request must be GET');
      savedRequests += 1;
      if (failSavedRequests) {
        await fulfillJson(route, { detail: 'Synthetic graph refresh failure' }, 500);
        return;
      }
      await fulfillJson(route, envelope(savedNodes()));
    });
    await probe.route('**/api/notes/recent', (route) => fulfillJson(route, envelope([])));
    await probe.route('**/ai/api/v1/graph/visualization', async (route) => {
      assert(route.request().method() === 'GET', 'AI graph request must be GET');
      aiRequests += 1;
      await aiGate;
      const nodes = savedNodes();
      await fulfillJson(route, {
        user_id: 1,
        nodes: nodes.map((node) => ({
          id: node.noteId,
          title: node.title,
          created_at: node.createdAt,
        })),
        links: nodes.slice(1).map((node, index) => ({
          source: nodes[index].noteId,
          target: node.noteId,
          score: 0.7,
        })),
        stats: {
          total_nodes: nodes.length,
          total_links: Math.max(0, nodes.length - 1),
          avg_connections: nodes.length ? (2 * Math.max(0, nodes.length - 1)) / nodes.length : 0,
        },
      });
    });

    for (const current of fixtures) {
      fixture = current;
      stage = `${current.count} nodes at ${current.width}x${current.height}: initial render`;
      savedRequests = 0;
      aiRequests = 0;
      updatedTitle = false;
      failSavedRequests = false;
      nodeIdOffset = 0;
      aiGate = current.delayedAi
        ? new Promise((resolve) => {
            releaseAiGate = resolve;
          })
        : Promise.resolve();
      await probe.setViewportSize({ width: current.width, height: current.height });
      await probe.goto(`${origin}/main`);
      // The canvas can mount before graph data arrives. The inert shell is
      // released only after the first fitted WebGL frame has been scheduled.
      await probe.waitForFunction(
        () => {
          const canvas = document.querySelector('main .scene-container canvas');
          return Boolean(canvas && !canvas.closest('[inert]'));
        },
        null,
        { timeout: 30000 },
      );
      const label = `${current.count} nodes at ${current.width}x${current.height}`;
      if (current.delayedAi) {
        await probe.getByText(`저장된 노트 ${current.count}개 · 분석된 연결 0개`).waitFor();
        lastSnapshot = await inspect();
        assertVisible(lastSnapshot, current.count, `${label} before AI response`);
        releaseAiGate();
        releaseAiGate = null;
      }
      stage = `${label}: AI response`;
      await probe
        .getByText(`저장된 노트 ${current.count}개 · 분석된 연결 ${current.count - 1}개`)
        .waitFor({
          timeout: 30000,
        });
      lastSnapshot = await inspect();
      assertVisible(lastSnapshot, current.count, `${label} ready`);
      assert(savedRequests > 0 && aiRequests > 0, `${label}: graph requests missing`);
      await probe.screenshot({
        path: `.playwright-cli/ui-ux-evidence/graph-camera-${current.count}-${current.width}.png`,
      });

      await probe.waitForTimeout(5000);
      stage = `${label}: 5s stability`;
      lastSnapshot = await inspect();
      assertVisible(lastSnapshot, current.count, `${label} after 5s`);

      if (current.count === 48) {
        stage = `${label}: zoom buttons from fitted camera`;
        const fittedDistance = cameraDistance(lastSnapshot);
        await probe.getByRole('button', { name: '지도 확대' }).click();
        const zoomedIn = await inspect();
        assert(!zoomedIn.error, `${label}: camera absent after zoom in`);
        const nearDistance = cameraDistance(zoomedIn);
        assert(
          Math.abs(nearDistance / fittedDistance - 0.78) < 0.02,
          `${label}: zoom in did not move one step from fitted distance ${fittedDistance}`,
        );
        await probe.getByRole('button', { name: '모든 노트 보기' }).click();
        const refitted = await inspect();
        assertVisible(refitted, current.count, `${label} after manual fit`);
        const refittedDistance = cameraDistance(refitted);
        await probe.getByRole('button', { name: '지도 축소' }).click();
        const zoomedOut = await inspect();
        assert(!zoomedOut.error, `${label}: camera absent after zoom out`);
        assert(
          Math.abs(cameraDistance(zoomedOut) / refittedDistance - 1.28) < 0.02,
          `${label}: zoom out did not move one step from fitted distance ${refittedDistance}`,
        );
        for (let step = 0; step < 12; step += 1) {
          await probe.getByRole('button', { name: '지도 축소' }).click();
        }
        const atLimit = await inspect();
        assert(!atLimit.error, `${label}: camera absent at zoom limit`);
        const limitDistance = cameraDistance(atLimit);
        assert(
          limitDistance <= Math.max(1400, refittedDistance * 2) + 0.1,
          `${label}: zoom out escaped fitted camera limit (${limitDistance})`,
        );
        await probe.getByRole('button', { name: '지도 확대' }).click();
        const backInside = await inspect();
        assert(
          !backInside.error && cameraDistance(backInside) < limitDistance,
          `${label}: zoom in could not leave the far limit`,
        );
        await probe.getByRole('button', { name: '모든 노트 보기' }).click();
        lastSnapshot = await inspect();
        assertVisible(lastSnapshot, current.count, `${label} after zoom controls`);
      }

      if (current.count === 3) {
        stage = `${label}: same-query refetch`;
        await probe.getByRole('button', { name: '지도 확대' }).click();
        await probe.waitForTimeout(100);
        const beforeRefetch = await inspect();
        assert(!beforeRefetch.error, `${label}: no camera before refetch`);
        updatedTitle = true;
        const requestsBeforeRefetch = savedRequests;
        assert(await refetchSavedNodes(), `${label}: QueryClient absent`);
        await probe.getByText('SB Camera QA 1 updated', { exact: true }).waitFor();
        lastSnapshot = await inspect();
        assert(
          savedRequests > requestsBeforeRefetch,
          `${label}: refetch did not request graph nodes`,
        );
        assert(!lastSnapshot.error, `${label}: no camera after refetch`);
        const cameraShift = Math.hypot(
          lastSnapshot.camera.x - beforeRefetch.camera.x,
          lastSnapshot.camera.y - beforeRefetch.camera.y,
          lastSnapshot.camera.z - beforeRefetch.camera.z,
        );
        assert(cameraShift < 0.01, `${label}: same-query refetch moved camera by ${cameraShift}`);
        assert(
          !(await probe.locator('main [role="status"][aria-label="불러오는 중"]').isVisible()),
          `${label}: same-query refetch restarted loading overlay`,
        );
        stage = `${label}: failed saved-node refetch`;
        failSavedRequests = true;
        const failedRequestsBeforeRefetch = savedRequests;
        assert(await refetchSavedNodes(), `${label}: failure refetch could not reach QueryClient`);
        await probe.getByRole('alert').getByText('노트 갱신에 실패했습니다.').waitFor({
          timeout: 20000,
        });
        const afterFailure = await inspect();
        assertVisible(afterFailure, 3, `${label} after failed refetch`);
        assert(
          savedRequests > failedRequestsBeforeRefetch,
          `${label}: failed refetch sent no request`,
        );
        assert(
          afterFailure.nodes.map((node) => node.id).join(',') ===
            lastSnapshot.nodes.map((node) => node.id).join(',') &&
            afterFailure.nodes.some((node) => node.title === 'SB Camera QA 1 updated'),
          `${label}: failed refetch did not preserve the displayed nodes`,
        );
        assert(
          Math.hypot(
            afterFailure.camera.x - beforeRefetch.camera.x,
            afterFailure.camera.y - beforeRefetch.camera.y,
            afterFailure.camera.z - beforeRefetch.camera.z,
          ) < 0.01,
          `${label}: failed refetch moved camera`,
        );
        stage = `${label}: saved-node retry recovery`;
        failSavedRequests = false;
        const requestsBeforeRecovery = savedRequests;
        await probe.getByRole('button', { name: '다시 시도' }).click();
        await probe.getByRole('alert').getByText('노트 갱신에 실패했습니다.').waitFor({
          state: 'hidden',
          timeout: 10000,
        });
        const afterRecovery = await inspect();
        assertVisible(afterRecovery, 3, `${label} after saved-node retry`);
        assert(
          savedRequests > requestsBeforeRecovery,
          `${label}: retry sent no saved-node request`,
        );
        assert(
          Math.hypot(
            afterRecovery.camera.x - afterFailure.camera.x,
            afterRecovery.camera.y - afterFailure.camera.y,
            afterRecovery.camera.z - afterFailure.camera.z,
          ) < 0.01,
          `${label}: retry recovery moved camera`,
        );
        if (current.width === 1280) {
          stage = `${label}: all IDs replaced`;
          // Replacing every ID is a genuinely new graph in the same session.
          // It must fit again even though GraphPanel already signaled ready.
          nodeIdOffset = 1000;
          assert(await refetchSavedNodes(), `${label}: replacement refetch failed`);
          await probe.getByText('SB Camera QA 1 updated replacement', { exact: true }).waitFor();
          await probe.waitForTimeout(150);
          lastSnapshot = await inspect();
          assert(lastSnapshot.nodes[0]?.id === baseId + 1001, `${label}: old node IDs remain`);
          assertVisible(lastSnapshot, 3, `${label} all IDs replaced`);
          const fitShift = Math.hypot(
            lastSnapshot.camera.x - beforeRefetch.camera.x,
            lastSnapshot.camera.y - beforeRefetch.camera.y,
            lastSnapshot.camera.z - beforeRefetch.camera.z,
          );
          assert(fitShift > 0.1, `${label}: replacement graph did not refit camera`);
        }
      }
      results.push({
        fixture: label,
        requests: { saved: savedRequests, ai: aiRequests },
        camera: lastSnapshot.camera,
        nodes: lastSnapshot.nodes.length,
        outcome: 'projected nodes inside canvas after ready and after 5s',
      });
    }

    fixture = { count: 0, width: 1280, height: 900, delayedAi: false };
    stage = 'empty to one node: empty state';
    nodeIdOffset = 0;
    updatedTitle = false;
    aiGate = Promise.resolve();
    await probe.setViewportSize({ width: 1280, height: 900 });
    await probe.goto(`${origin}/main`);
    await probe.getByText('저장된 노트가 없습니다.').waitFor();
    assert(
      (await probe.locator('main .scene-container canvas').count()) === 0,
      'Empty graph has no canvas',
    );
    fixture = { count: 1, width: 1280, height: 900, delayedAi: false };
    stage = 'empty to one node: new canvas and fit';
    assert(await refetchSavedNodes(), 'Empty-to-one refetch could not reach QueryClient');
    await probe.getByText('저장된 노트 1개 · 분석된 연결 0개').waitFor();
    const singleDeadline = Date.now() + 10000;
    do {
      lastSnapshot = await inspect();
      if (!lastSnapshot.error && Math.abs(lastSnapshot.camera.z - 115) < 0.5) break;
      await probe.waitForTimeout(50);
    } while (Date.now() < singleDeadline);
    assertVisible(lastSnapshot, 1, 'empty to one node');
    assert(
      Math.abs(lastSnapshot.camera.z - 115) < 0.5,
      'Empty-to-one graph did not fit the new node',
    );
    results.push({
      fixture: 'empty to one node at 1280x900',
      camera: lastSnapshot.camera,
      nodes: 1,
      outcome: 'new node fitted after empty state was already ready',
    });

    return {
      passed: results.length,
      results,
      limitation:
        'Synthetic API responses; React Fiber is used only by this test to reach public ForceGraph3D methods.',
    };
  } catch (error) {
    let liveDiagnostic = null;
    let ui = null;
    try {
      liveDiagnostic = await inspect();
      ui = await probe.evaluate(() => ({
        canvasCount: document.querySelectorAll('main .scene-container canvas').length,
        inertCanvas: Boolean(
          document.querySelector('main .scene-container canvas')?.closest('[inert]'),
        ),
        graphInfo: document.querySelector('[aria-label="지식 지도 정보"]')?.textContent,
        graphStatuses: Array.from(
          document.querySelectorAll('main [role="status"], main [role="alert"]'),
        )
          .map((element) => element.textContent?.trim())
          .filter(Boolean),
      }));
    } catch {
      // A missing page can still leave the earlier projection in the result.
    }
    try {
      await probe.screenshot({ path: failureScreenshot });
    } catch {
      // Preserve the original diagnostic if the disposable page has closed.
    }
    return {
      passed: results.length,
      stage,
      failedFixture: `${fixture.count} nodes at ${fixture.width}x${fixture.height}`,
      error: String(error),
      diagnostic: liveDiagnostic,
      previousSnapshot: lastSnapshot,
      ui,
      requests: { saved: savedRequests, ai: aiRequests },
      screenshot: failureScreenshot,
    };
  } finally {
    releaseAiGate?.();
    await context.close();
  }
}
