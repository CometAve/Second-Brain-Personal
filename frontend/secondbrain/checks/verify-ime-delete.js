/** Chrome protocol composition, immediate close, real GET and DELETE of a disposable QA note. */
async function verifyImeDelete(page) {
  const checks = [];
  function assert(ok, message) {
    if (!ok) throw new Error(message);
    checks.push(message);
  }
  const title = `QA IME ${Date.now().toString(36)}`;
  const text = '한글 조합을 마친 직후에도 마지막 글자가 보존됩니다.';
  await page.goto('http://localhost:5173/main');
  await page.getByRole('button', { name: '새 노트 작성' }).click();
  const dialog = page.getByRole('dialog', { name: '노트 편집' });
  const editor = dialog.locator('.ProseMirror');
  await editor.waitFor();
  await dialog.getByRole('textbox', { name: '노트 제목' }).fill(title);
  await editor.click();
  await editor.evaluate((element) => {
    window.__qaComposition = [];
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend']) {
      element.addEventListener(type, (event) =>
        window.__qaComposition.push({ type, data: event.data }),
      );
    }
  });
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const composition of ['ㅎ', '하', '한', '한글']) {
      await cdp.send('Input.imeSetComposition', {
        text: composition,
        selectionStart: composition.length,
        selectionEnd: composition.length,
      });
    }
    await cdp.send('Input.insertText', { text });
    const events = await page.evaluate(() => window.__qaComposition);
    assert(
      events.some((event) => event.type === 'compositionstart'),
      'Chrome 프로토콜이 compositionstart를 발생시킨다',
    );
    assert(
      events.some((event) => event.type === 'compositionend'),
      '조합 확정이 compositionend를 발생시킨다',
    );
    const promoted = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/notes/from-draft/'),
    );
    await dialog.getByRole('button', { name: '작성 마치기' }).click();
    const promotion = await (await promoted).json();
    assert(
      promotion.success && promotion.data.title === title && promotion.data.content.includes(text),
      '조합 직후 닫기가 마지막 글자까지 실제 서버에 저장한다',
    );
    const id = promotion.data.noteId;
    await dialog.waitFor({ state: 'hidden' });
    const get = page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().endsWith(`/api/notes/${id}`),
    );
    await page.goto(`http://localhost:5173/notes/${id}`);
    const saved = await (await get).json();
    assert(
      saved.success && saved.data.content.includes(text),
      '독립 GET으로 조합 확정 내용을 다시 확인한다',
    );
    await editor.waitFor();
    await dialog.getByRole('button', { name: '노트 삭제', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await confirmation.getByRole('button', { name: '취소', exact: true }).click();
    assert(await dialog.isVisible(), '삭제 취소가 편집 내용을 유지한다');
    await dialog.getByRole('button', { name: '노트 삭제', exact: true }).click();
    const deleted = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().endsWith('/api/notes'),
    );
    await confirmation.getByRole('button', { name: '삭제', exact: true }).click();
    assert((await deleted).ok(), '별도 QA 노트의 실제 DELETE가 성공한다');
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '검색 패널 열기' }).click();
    await page.locator('#search-panel').waitFor();
    assert(
      (await page.locator('#search-panel').textContent()).includes(title) === false,
      '삭제한 노트가 갱신된 최근 목록에 없다',
    );
    const missingGet = page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().endsWith(`/api/notes/${id}`),
    );
    await page.goto(`http://localhost:5173/notes/${id}`);
    assert((await missingGet).status() === 404, '삭제 후 독립 GET이 실제 404를 반환한다');
    await page.getByText('노트를 불러올 수 없습니다.', { exact: true }).waitFor();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    return {
      passed: checks.length,
      checks,
      deletedQaNoteId: id,
      compositionEvents: events,
      limitation: 'Chrome Input protocol; macOS Korean input method was not exercised.',
    };
  } finally {
    await cdp.detach();
  }
}
