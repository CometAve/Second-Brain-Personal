// Run with playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-note-edit-coordinator.js
// All intercepted notes are random synthetic IDs. This checks save ordering and recovery, not real persistence.
async function verifyNoteEditCoordinator(page) {
  const ids = await page.evaluate(() => {
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return Object.fromEntries(
      ['serial', 'deletion', 'lostAck', 'mismatch'].map((name, index) => [
        name,
        700000000 + index * 100000000 + (values[index] % 90000000),
      ]),
    );
  });
  const synthetic = new Set(Object.values(ids));
  const initial = (id) => ({
    noteId: id,
    title: `Initial ${id}`,
    content: `Body ${id}`,
    createdAt: '2026-09-25T00:00:00',
    updatedAt: '2026-09-25T00:00:00',
    remindAt: null,
    remindCount: 0,
  });
  const notes = new Map(Object.values(ids).map((id) => [id, initial(id)]));
  const calls = [];
  const envelope = (data) => JSON.stringify({ success: true, code: 0, message: 'SUCCESS', data });
  const json = (route, data) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: envelope(data) });
  let releaseSerial;
  let serialStarted;
  const serialHeld = new Promise((resolve) => {
    releaseSerial = resolve;
  });
  const serialSeen = new Promise((resolve) => {
    serialStarted = resolve;
  });
  let releaseDeletion;
  let deletionStarted;
  const deletionHeld = new Promise((resolve) => {
    releaseDeletion = resolve;
  });
  const deletionSeen = new Promise((resolve) => {
    deletionStarted = resolve;
  });
  let serialActive = 0;
  let maxSerialActive = 0;
  let lostAckOnce = true;
  let mismatchOnce = true;

  async function handleNote(route) {
    const request = route.request();
    const match = request.url().match(/\/api\/notes\/(\d+)(?:[?#]|$)/);
    const id = Number(match?.[1]);
    if (!match || !synthetic.has(id)) return route.continue();
    const method = request.method();
    calls.push(`${method} ${id}`);
    if (method === 'GET') return json(route, notes.get(id));
    if (method !== 'PUT') return route.continue();
    const body = request.postDataJSON();
    if (id === ids.serial) {
      serialActive++;
      maxSerialActive = Math.max(maxSerialActive, serialActive);
      if (calls.filter((call) => call === `PUT ${id}`).length === 1) {
        serialStarted();
        await serialHeld;
      }
    }
    if (id === ids.deletion) {
      deletionStarted();
      await deletionHeld;
    }
    const current = notes.get(id);
    notes.set(id, { ...current, title: body.title, content: body.content });
    if (id === ids.serial) serialActive--;
    if (id === ids.lostAck && lostAckOnce) {
      lostAckOnce = false;
      return route.abort('failed');
    }
    if (id === ids.mismatch && mismatchOnce) {
      mismatchOnce = false;
      notes.set(id, { ...current, title: 'Other tab', content: 'Other content' });
      return route.abort('failed');
    }
    return json(route, notes.get(id));
  }

  async function handleDelete(route) {
    const request = route.request();
    if (request.method() !== 'DELETE') return route.continue();
    const targets = request.postDataJSON()?.noteIds;
    if (!Array.isArray(targets) || !targets.every((id) => synthetic.has(id)))
      return route.continue();
    for (const id of targets) {
      calls.push(`DELETE ${id}`);
      notes.delete(id);
    }
    return json(route, null);
  }

  await page.route('**/api/notes/*', handleNote);
  await page.route('**/api/notes', handleDelete);
  let ownerId;
  try {
    ownerId = await page.evaluate(async (testIds) => {
      const { NoteEditCoordinator } =
        await import('/src/features/note/services/noteEditCoordinator.ts');
      const { captureSessionEpoch, useAuthStore } = await import('/src/stores/authStore.ts');
      const epoch = captureSessionEpoch();
      const owner = useAuthStore.getState().user?.id ?? 999999;
      const initial = (id) => ({
        noteId: id,
        title: `Initial ${id}`,
        content: `Body ${id}`,
        createdAt: '2026-09-25T00:00:00',
        updatedAt: '2026-09-25T00:00:00',
        remindAt: null,
        remindCount: 0,
      });
      const serial = new NoteEditCoordinator(testIds.serial, owner, epoch, initial(testIds.serial));
      serial.attach(
        () => {},
        () => {},
      );
      serial.editTitle('Rapid title');
      serial.editContent('First body');
      window.__noteEditCheck = { serial, epoch, owner, serialWork: serial.flush() };
      return owner;
    }, ids);
    await serialSeen;
    await page.evaluate(() => {
      const test = window.__noteEditCheck;
      test.serial.editContent('Last body before close\n\n  ');
      test.closeWork = test.serial.flush();
    });
    releaseSerial();
    const serialResult = await page.evaluate(async () => {
      const test = window.__noteEditCheck;
      await Promise.all([test.serialWork, test.closeWork]);
      const result = { dirty: test.serial.isDirty, status: test.serial.currentStatus };
      test.serial.detach();
      return result;
    });

    await page.evaluate(async (testIds) => {
      const { NoteEditCoordinator } =
        await import('/src/features/note/services/noteEditCoordinator.ts');
      const test = window.__noteEditCheck;
      const remote = {
        noteId: testIds.deletion,
        title: `Initial ${testIds.deletion}`,
        content: `Body ${testIds.deletion}`,
        createdAt: '2026-09-25T00:00:00',
        updatedAt: '2026-09-25T00:00:00',
        remindAt: null,
        remindCount: 0,
      };
      const deletion = new NoteEditCoordinator(testIds.deletion, test.owner, test.epoch, remote);
      deletion.attach(
        () => {},
        () => {
          test.deleteAckPhase = deletion.currentStatus.phase;
        },
      );
      deletion.editTitle('Saved before delete');
      test.deletion = deletion;
      test.deletionWork = deletion.flush();
    }, ids);
    await deletionSeen;
    await page.evaluate((testIds) => {
      const test = window.__noteEditCheck;
      test.deleteWork = (async () => {
        await test.deletion.prepareDelete();
        const { deleteNotes } = await import('/src/api/client/noteApi.ts');
        await deleteNotes([testIds.deletion], { sessionEpoch: test.epoch });
        test.deletion.deleteSucceeded();
      })();
      test.deleteWaitingPhase = test.deletion.currentStatus.phase;
    }, ids);
    releaseDeletion();
    const deletionResult = await page.evaluate(async () => {
      const test = window.__noteEditCheck;
      await Promise.all([test.deletionWork, test.deleteWork]);
      const result = {
        dirty: test.deletion.isDirty,
        status: test.deletion.currentStatus,
        waitingPhase: test.deleteWaitingPhase,
        acknowledgedPhase: test.deleteAckPhase,
      };
      test.deletion.detach();
      return result;
    });

    const recoveryResult = await page.evaluate(async (testIds) => {
      const { NoteEditCoordinator } =
        await import('/src/features/note/services/noteEditCoordinator.ts');
      const test = window.__noteEditCheck;
      const initial = (id) => ({
        noteId: id,
        title: `Initial ${id}`,
        content: `Body ${id}`,
        createdAt: '2026-09-25T00:00:00',
        updatedAt: '2026-09-25T00:00:00',
        remindAt: null,
        remindCount: 0,
      });
      const key = (id, owner = test.owner) => `sb:note:recovery:v1:${owner}:${id}`;
      const lost = new NoteEditCoordinator(
        testIds.lostAck,
        test.owner,
        test.epoch,
        initial(testIds.lostAck),
      );
      lost.attach(
        () => {},
        () => {},
      );
      lost.editTitle('Saved, acknowledgement lost');
      lost.editContent('Body with trailing whitespace\n\n  ');
      let lostFailed = false;
      try {
        await lost.flush();
      } catch {
        lostFailed = true;
      }
      const recoveryKept =
        localStorage.getItem(key(testIds.lostAck))?.includes('Saved, acknowledgement lost') ??
        false;
      await lost.flush();
      const recovered = !lost.isDirty && localStorage.getItem(key(testIds.lostAck)) === null;
      lost.detach();

      const conflict = new NoteEditCoordinator(
        testIds.mismatch,
        test.owner,
        test.epoch,
        initial(testIds.mismatch),
      );
      conflict.attach(
        () => {},
        () => {},
      );
      conflict.editContent('Preserve local content');
      let firstFailed = false;
      try {
        await conflict.flush();
      } catch {
        firstFailed = true;
      }
      let mismatchBlocked = false;
      try {
        await conflict.flush();
      } catch {
        mismatchBlocked = true;
      }
      const conflictKept =
        localStorage.getItem(key(testIds.mismatch))?.includes('Preserve local content') ?? false;
      conflict.detach();

      const ownerTwo = new NoteEditCoordinator(
        testIds.mismatch,
        test.owner + 1,
        test.epoch,
        initial(testIds.mismatch),
      );
      const isolated =
        ownerTwo.snapshot.content === `Body ${testIds.mismatch}` && !ownerTwo.isDirty;
      ownerTwo.detach();
      return {
        lostFailed,
        recoveryKept,
        recovered,
        firstFailed,
        mismatchBlocked,
        conflictKept,
        isolated,
      };
    }, ids);

    const checks = {
      'rapid edits and close flush persist the latest snapshot':
        notes.get(ids.serial)?.title === 'Rapid title' &&
        notes.get(ids.serial)?.content === 'Last body before close\n\n  ' &&
        !serialResult.dirty,
      'overlapping save requests never overlap PUTs':
        maxSerialActive === 1 && calls.filter((call) => call === `PUT ${ids.serial}`).length === 2,
      'delete waits for an in-flight PUT':
        !notes.has(ids.deletion) &&
        !deletionResult.dirty &&
        deletionResult.waitingPhase === 'deleting' &&
        deletionResult.acknowledgedPhase === 'deleting' &&
        calls.indexOf(`PUT ${ids.deletion}`) < calls.indexOf(`DELETE ${ids.deletion}`),
      'lost acknowledgement preserves the local recovery':
        recoveryResult.lostFailed && recoveryResult.recoveryKept,
      'lost acknowledgement reconciles by GET without duplicate PUT':
        recoveryResult.recovered &&
        notes.get(ids.lostAck)?.content === 'Body with trailing whitespace\n\n  ' &&
        calls.filter((call) => call === `PUT ${ids.lostAck}`).length === 1 &&
        calls.includes(`GET ${ids.lostAck}`),
      'server mismatch blocks overwrite and retains recovery':
        recoveryResult.firstFailed &&
        recoveryResult.mismatchBlocked &&
        recoveryResult.conflictKept &&
        calls.filter((call) => call === `PUT ${ids.mismatch}`).length === 1 &&
        calls.includes(`GET ${ids.mismatch}`),
      'recovery content is isolated by owner': recoveryResult.isolated,
    };
    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    if (failed.length)
      throw new Error(
        `Note edit checks failed: ${JSON.stringify({ failed, calls, serialResult, deletionResult, recoveryResult })}`,
      );
    return { passed: Object.keys(checks).length, checks: Object.keys(checks), calls };
  } finally {
    releaseSerial();
    releaseDeletion();
    await page.unroute('**/api/notes/*', handleNote);
    await page.unroute('**/api/notes', handleDelete);
    await page.evaluate(
      ({ testIds, owner }) => {
        if (owner)
          for (const id of Object.values(testIds)) {
            localStorage.removeItem(`sb:note:recovery:v1:${owner}:${id}`);
            localStorage.removeItem(`sb:note:recovery:v1:${owner + 1}:${id}`);
          }
        delete window.__noteEditCheck;
      },
      { testIds: ids, owner: ownerId },
    );
  }
}
