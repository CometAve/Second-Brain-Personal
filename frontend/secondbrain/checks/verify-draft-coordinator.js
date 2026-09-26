// Run with the official playwright-cli skill against a running Vite web app:
// playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-draft-coordinator.js
// All HTTP responses below are synthetic. This verifies coordinator behavior, not server persistence.
async function verifyDraftCoordinator(page) {
  const IDs = await page.evaluate(() => ({
    constructor: crypto.randomUUID(),
    lostSave: crypto.randomUUID(),
    discard: crypto.randomUUID(),
    lostPromotion: crypto.randomUUID(),
    conflict: crypto.randomUUID(),
    unsafeLeave: crypto.randomUUID(),
    recoverableLeave: crypto.randomUUID(),
  }));
  const synthetic = new Set(Object.values(IDs));
  const drafts = new Map();
  const notes = new Map();
  const deleted = new Set();
  const calls = [];
  let nextNoteId = 900000;
  let loseSaveOnce = true;
  let losePromotionOnce = true;
  let failUnsafeLeave = true;
  let releaseHeldSave;
  let heldSaveSeen;
  const heldSaveStarted = new Promise((resolve) => {
    heldSaveSeen = resolve;
  });
  const heldSave = new Promise((resolve) => {
    releaseHeldSave = resolve;
  });
  const response = (data) => ({ success: true, code: 0, message: 'SUCCESS', data });
  const draftResponse = (id, draft) => ({
    noteId: id,
    ...draft,
    lastModified: '2026-09-25T00:00:00',
  });
  const noteResponse = (draft) => ({
    noteId: ++nextNoteId,
    title: draft.title,
    content: draft.content,
    createdAt: '2026-09-25T00:00:00',
    updatedAt: '2026-09-25T00:00:00',
    remindAt: null,
    remindCount: 0,
  });
  const fail = async (route, status) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response(null)),
    });

  async function handleDraft(route) {
    const request = route.request();
    const path = request.url().split('?')[0].split('/api/')[1];
    const match = path?.match(/^drafts(?:\/([^/]+))?$/);
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    const id = match?.[1] ?? body?.noteId;
    if (!match || !synthetic.has(id)) return route.continue();
    calls.push(`${request.method()} draft ${id}`);
    if (request.method() === 'GET') {
      const draft = drafts.get(id);
      if (!draft) return fail(route, 404);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response(draftResponse(id, draft))),
      });
    }
    if (request.method() === 'DELETE') {
      drafts.delete(id);
      deleted.add(id);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response(null)),
      });
    }
    if (request.method() === 'POST') {
      if (id === IDs.unsafeLeave && failUnsafeLeave) return route.abort('failed');
      const current = drafts.get(id);
      if (id === IDs.conflict || deleted.has(id) || (current && body.version !== current.version))
        return fail(route, 409);
      const saved = {
        title: body.title,
        content: body.content,
        version: current ? current.version + 1 : 1,
      };
      if (id === IDs.discard) {
        heldSaveSeen();
        await heldSave;
      }
      drafts.set(id, saved);
      if (id === IDs.lostSave && loseSaveOnce) {
        loseSaveOnce = false;
        return route.abort('failed');
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(response(draftResponse(id, saved))),
      });
    }
    return route.continue();
  }

  async function handlePromotion(route) {
    const request = route.request();
    const path = request.url().split('?')[0].split('/api/')[1];
    const match = path?.match(/^notes\/from-draft\/([^/]+)$/);
    const id = match?.[1];
    if (!id || !synthetic.has(id)) return route.continue();
    calls.push(`POST promote ${id}`);
    let note = notes.get(id);
    const created = !note;
    if (!note) {
      const draft = drafts.get(id);
      if (!draft) return fail(route, 404);
      note = noteResponse(draft);
      notes.set(id, note);
      drafts.delete(id);
    }
    if (id === IDs.lostPromotion && losePromotionOnce) {
      losePromotionOnce = false;
      return route.abort('failed');
    }
    return route.fulfill({
      status: created ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify(response(note)),
    });
  }

  await page.route('**/api/drafts**', handleDraft);
  await page.route('**/api/notes/from-draft/**', handlePromotion);
  try {
    const result = await page.evaluate(async (ids) => {
      const { DraftSaveCoordinator } =
        await import('/src/features/note/services/draftSaveCoordinator.ts');
      const { captureSessionEpoch, useAuthStore } = await import('/src/stores/authStore.ts');
      const ownerId = useAuthStore.getState().user?.id ?? 999999;
      window.__foundationDraftOwnerId = ownerId;
      const epoch = captureSessionEpoch();
      const coordinator = (id) => new DraftSaveCoordinator(id, ownerId, epoch, null);
      const key = (id) => `sb:draft:recovery:v1:${ownerId}:${id}`;
      const original = localStorage.getItem(key(ids.constructor));
      const bare = coordinator(ids.constructor);
      const constructorPure = localStorage.getItem(key(ids.constructor)) === original;
      bare.detach();

      const lost = coordinator(ids.lostSave);
      lost.attach(
        () => {},
        () => {},
      );
      lost.editTitle('Lost ack');
      lost.editContent('Newest body');
      let firstSaveFailed = false;
      try {
        await lost.saveLatest();
      } catch {
        firstSaveFailed = true;
      }
      await lost.saveLatest();
      const recovered =
        lost.currentVersion === 1 && localStorage.getItem(key(ids.lostSave)) === null;
      lost.detach();

      const deleting = coordinator(ids.discard);
      deleting.attach(
        () => {},
        () => {},
      );
      deleting.editTitle('Discard');
      deleting.editContent('Body');
      window.__foundationDiscard = Promise.allSettled([deleting.saveLatest(), deleting.discard()]);
      window.__foundationDiscardCoordinator = deleting;

      const promoting = coordinator(ids.lostPromotion);
      promoting.attach(
        () => {},
        () => {},
      );
      promoting.editTitle('Promote');
      promoting.editContent('Exact body');
      await promoting.saveLatest();
      let firstPromotionFailed = false;
      try {
        await promoting.close();
      } catch {
        firstPromotionFailed = true;
      }
      let discardBlocked = false;
      try {
        await promoting.discard();
      } catch {
        discardBlocked = true;
      }
      const retry = await promoting.close();
      promoting.detach();

      const conflicted = coordinator(ids.conflict);
      conflicted.attach(
        () => {},
        () => {},
      );
      conflicted.editTitle('Conflict');
      conflicted.editContent('Must survive');
      let conflictFailed = false;
      try {
        await conflicted.close();
      } catch {
        conflictFailed = true;
      }
      const conflictRecovered =
        localStorage.getItem(key(ids.conflict))?.includes('Must survive') ?? false;
      conflicted.detach();

      const originalSetItem = Storage.prototype.setItem;
      const unsafe = coordinator(ids.unsafeLeave);
      unsafe.attach(
        () => {},
        () => {},
      );
      Storage.prototype.setItem = function (storageKey, value) {
        if (storageKey === key(ids.unsafeLeave)) throw new Error('storage unavailable');
        return originalSetItem.call(this, storageKey, value);
      };
      let unsafeBefore = false;
      let blockedWithoutCopies = false;
      try {
        unsafe.editTitle('Only in memory');
        unsafe.editContent('Must stay visible');
        unsafeBefore = unsafe.hasUnsafeChanges;
        blockedWithoutCopies = !(await unsafe.ensureSafeToLeave());
      } finally {
        Storage.prototype.setItem = originalSetItem;
        unsafe.detach();
      }

      const recoverable = coordinator(ids.recoverableLeave);
      recoverable.attach(
        () => {},
        () => {},
      );
      recoverable.editTitle('Browser recovery');
      recoverable.editContent('No forced promotion');
      const recoveryAllowsLeave =
        !recoverable.hasUnsafeChanges && (await recoverable.ensureSafeToLeave());
      recoverable.detach();

      return {
        ownerId,
        constructorPure,
        firstSaveFailed,
        recovered,
        firstPromotionFailed,
        discardBlocked,
        retry,
        conflictFailed,
        conflictRecovered,
        unsafeBefore,
        blockedWithoutCopies,
        recoveryAllowsLeave,
      };
    }, IDs);
    await heldSaveStarted;
    releaseHeldSave();
    const discardResult = await page.evaluate(async () => {
      const result = await window.__foundationDiscard;
      window.__foundationDiscardCoordinator.detach();
      delete window.__foundationDiscard;
      delete window.__foundationDiscardCoordinator;
      return result.map((item) => item.status);
    });
    const checks = {
      'constructor has no storage write': result.constructorPure,
      'lost save acknowledgement is detected': result.firstSaveFailed,
      'lost save reconciles by GET without another POST':
        result.recovered &&
        calls.filter((call) => call === `POST draft ${IDs.lostSave}`).length === 1 &&
        calls.includes(`GET draft ${IDs.lostSave}`),
      'lost promotion acknowledgement is detected': result.firstPromotionFailed,
      'discard blocks uncertain promotion': result.discardBlocked,
      'promotion retry confirms durable note': result.retry.kind === 'promoted',
      'version conflict prevents close': result.conflictFailed,
      'version conflict preserves scoped recovery': result.conflictRecovered,
      'storage and server failure block unsafe leave':
        result.unsafeBefore && result.blockedWithoutCopies,
      'current browser recovery allows leave without promotion':
        result.recoveryAllowsLeave && !calls.includes(`POST promote ${IDs.recoverableLeave}`),
      'constructor issued no API request': !calls.some((call) => call.includes(IDs.constructor)),
      'in-flight save and discard settle': discardResult.every((item) => item === 'fulfilled'),
      'discard completes after held save': !drafts.has(IDs.discard) && deleted.has(IDs.discard),
      'promotion retry did not create a duplicate note': notes.size === 1,
    };
    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    if (failed.length > 0) {
      throw new Error(
        `Draft coordinator checks failed: ${JSON.stringify({ failed, result, discardResult, calls })}`,
      );
    }
    return { passed: Object.keys(checks).length, checks: Object.keys(checks), calls };
  } finally {
    releaseHeldSave();
    await page.unroute('**/api/drafts**', handleDraft);
    await page.unroute('**/api/notes/from-draft/**', handlePromotion);
    await page.evaluate((ids) => {
      const ownerId = window.__foundationDraftOwnerId;
      if (ownerId)
        for (const id of Object.values(ids))
          localStorage.removeItem(`sb:draft:recovery:v1:${ownerId}:${id}`);
      delete window.__foundationDraftOwnerId;
      delete window.__foundationDiscard;
      window.__foundationDiscardCoordinator?.detach();
      delete window.__foundationDiscardCoordinator;
    }, IDs);
  }
}
