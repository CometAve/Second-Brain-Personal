/**
 * Authenticated, real-backend editor check for playwright-cli run-code.
 * Creates unique QA notes. Leave their IDs in the result for deliberate cleanup.
 * ClipboardEvent and DragEvent below are DOM-synthetic; insertText is a
 * Playwright keyboard protocol action. Neither proves macOS Korean IME behavior.
 */
async function verifyEditorUi(page) {
  const checks = [];
  const prefix = `SB QA ${Date.now().toString(36)}`;
  const title = `${prefix} 편집 확인`;
  const pasted = `${prefix} 붙여넣기`;
  const typed = `${prefix} 직접 입력`;
  const heading = `${prefix} 소제목`;
  const undoText = `${prefix} 되돌리기`;
  const revised = `${prefix} 수정 후 저장`;
  let noteId = null;
  let recoveredQaTitle = null;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }
  function isNoteResponse(response, method, id) {
    return response.request().method() === method && response.url().endsWith(`/api/notes/${id}`);
  }
  async function data(response) {
    const body = await response.json();
    assert(body.success === true && body.data, '실제 API가 성공 본문을 반환한다');
    return body.data;
  }
  async function dropImage(editor, kind) {
    await editor.evaluate((element, imageKind) => {
      let bytes;
      let type;
      if (imageKind === 'valid') {
        const png = atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOovnrkPwAG9wMUo46IjgAAAABJRU5ErkJggg==',
        );
        bytes = Uint8Array.from(png, (character) => character.charCodeAt(0));
        type = 'image/png';
      } else if (imageKind === 'oversize') {
        bytes = new Uint8Array(512 * 1024 + 1);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        type = 'image/png';
      } else {
        bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
        type = 'image/svg+xml';
      }
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], `qa-${imageKind}`, { type }));
      const bounds = element.getBoundingClientRect();
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: bounds.left + 24,
          clientY: bounds.top + 24,
        }),
      );
    }, kind);
  }

  // A prior interrupted run can leave its own draft open. Close only that QA
  // draft through the app, so navigation never discards a real user document.
  const previousEditor = page.getByRole('dialog', { name: '노트 편집' });
  if (await previousEditor.isVisible()) {
    assert(page.url().includes('draft='), '기존 편집기는 테스트 초안 경로다');
    const previousTitle = await previousEditor
      .getByRole('textbox', { name: '노트 제목' })
      .inputValue();
    assert(previousTitle.startsWith('SB QA '), '기존 편집기에는 테스트 초안만 열려 있다');
    recoveredQaTitle = previousTitle;
    await previousEditor.getByRole('button', { name: '작성 마치기' }).click();
    await previousEditor.waitFor({ state: 'hidden' });
  }
  await page.goto('http://localhost:5173/main');
  const create = page.getByRole('button', { name: '새 노트 작성' });
  await create.waitFor();
  await create.click();
  const dialog = page.getByRole('dialog', { name: '노트 편집' });
  await dialog.waitFor();
  const titleInput = dialog.getByRole('textbox', { name: '노트 제목' });
  const editor = dialog.locator('.note-editor .ProseMirror');
  await editor.waitFor();
  await titleInput.fill(title);
  await titleInput.press('Enter');
  await page.waitForFunction(() =>
    Boolean(document.activeElement?.matches('.note-editor .ProseMirror')),
  );
  assert(
    await editor.evaluate((element) => element === document.activeElement),
    '제목 Enter가 본문에 포커스를 옮긴다',
  );

  await editor.evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    element.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }),
    );
  }, pasted);
  await page.waitForFunction(
    (text) => document.querySelector('.note-editor .ProseMirror')?.textContent?.includes(text),
    pasted,
  );
  assert((await editor.textContent()).includes(pasted), '합성 ClipboardEvent가 본문을 붙여넣는다');
  await editor.focus();
  await page.keyboard.insertText(` ${typed}`);
  assert((await editor.textContent()).includes(typed), 'keyboard.insertText가 본문을 입력한다');

  await page.keyboard.press('Enter');
  await page.keyboard.insertText('/');
  const menu = dialog.locator('.milkdown-slash-menu');
  await menu.waitFor({ state: 'visible' });
  const selectedBefore = await menu.locator('.menu-group li.hover').getAttribute('data-index');
  await page.keyboard.press('ArrowDown');
  const selectedAfter = await menu.locator('.menu-group li.hover').getAttribute('data-index');
  assert(selectedBefore !== selectedAfter, '슬래시 메뉴 방향키가 선택을 이동한다');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('/h2');
  await menu.waitFor({ state: 'visible' });
  assert((await menu.textContent()).includes('제목 2'), 'h2 별칭이 제목 2를 찾는다');
  await page.keyboard.press('Enter');
  await editor.locator('h2').waitFor();
  await page.keyboard.insertText(heading);
  assert(
    (await editor.locator('h2').textContent()).includes(heading),
    '슬래시 명령이 제목 블록을 만든다',
  );

  await page.keyboard.press('Enter');
  await page.keyboard.insertText(undoText);
  await page.keyboard.press('ControlOrMeta+Z');
  await page.waitForFunction(
    (text) => !document.querySelector('.note-editor .ProseMirror')?.textContent?.includes(text),
    undoText,
  );
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await page.waitForFunction(
    (text) => document.querySelector('.note-editor .ProseMirror')?.textContent?.includes(text),
    undoText,
  );
  assert(
    (await editor.textContent()).includes(undoText),
    '실행 취소와 다시 실행이 입력을 보존한다',
  );

  const promotedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/notes/from-draft/'),
  );
  await dialog.getByRole('button', { name: '작성 마치기' }).click();
  const promoted = await promotedResponse;
  assert(promoted.ok(), '작성 마치기가 실제 서버 승격 요청에 성공한다');
  const promotedNote = await data(promoted);
  noteId = promotedNote.noteId;
  assert(Number.isSafeInteger(noteId) && noteId > 0, '승격 응답에서 실제 노트 ID를 받는다');
  assert(
    promotedNote.title === title &&
      [pasted, typed, heading, undoText].every((text) => promotedNote.content.includes(text)),
    '승격 응답이 닫기 직전 최신 제목과 본문을 포함한다',
  );
  await dialog.waitFor({ state: 'hidden' });

  const openedGet = page.waitForResponse((response) => isNoteResponse(response, 'GET', noteId));
  await page.goto(`http://localhost:5173/notes/${noteId}`);
  const openedNote = await data(await openedGet);
  assert(
    openedNote.title === title &&
      [pasted, typed, heading, undoText].every((text) => openedNote.content.includes(text)),
    '새 화면의 실제 GET이 저장된 제목과 본문을 다시 읽는다',
  );
  await dialog.waitFor();
  await editor.waitFor();

  const failedPut = page.waitForResponse((response) => isNoteResponse(response, 'PUT', noteId));
  await page.route(`**/api/notes/${noteId}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, code: 500, message: 'QA synthetic write failure' }),
    });
  });
  try {
    await editor.click();
    await page.keyboard.insertText(revised);
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    assert((await failedPut).status() === 500, '수정 저장 실패는 합성 HTTP 500으로 주입했다');
    await dialog.getByRole('alert').waitFor();
    assert(await dialog.isVisible(), '저장 실패 뒤 편집 화면이 열린 채 유지된다');
    assert((await editor.textContent()).includes(revised), '실패해도 수정한 본문이 유지된다');
  } finally {
    await page.unroute(`**/api/notes/${noteId}`);
  }

  const retryPut = page.waitForResponse((response) => isNoteResponse(response, 'PUT', noteId));
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  const retry = await retryPut;
  assert(retry.ok(), '재시도가 실제 서버 PUT에 성공한다');
  assert((await data(retry)).content.includes(revised), '재시도 응답에 실패 때 보존한 수정이 있다');

  const imageCount = await editor.locator('img').count();
  await dropImage(editor, 'valid');
  const insertedImage = editor.locator('img[src^="data:image/png;base64,"]');
  await insertedImage.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.note-editor img[src^="data:image/png;base64,"]');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  assert(
    await insertedImage.evaluate((image) => image.naturalWidth > 0),
    '삽입한 PNG가 실제 픽셀로 디코드된다',
  );
  assert(
    (await editor.locator('img').count()) === imageCount + 1,
    '합성 drop의 작은 PNG만 삽입된다',
  );
  await dropImage(editor, 'oversize');
  await page.getByText('512KB 이하의 PNG, JPEG, WebP 또는 GIF 이미지를 선택해 주세요.').waitFor();
  assert(
    (await editor.locator('img').count()) === imageCount + 1,
    '큰 파일은 빈 이미지 없이 거절된다',
  );
  await dropImage(editor, 'unsupported');
  await page.getByText('PNG, JPEG, WebP 또는 GIF 이미지만 추가할 수 있습니다.').waitFor();
  assert(
    (await editor.locator('img').count()) === imageCount + 1,
    'SVG 파일은 이미지 노드 없이 거절된다',
  );

  const imagePut = page.waitForResponse((response) => isNoteResponse(response, 'PUT', noteId));
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  assert((await imagePut).ok(), '이미지가 포함된 노트의 실제 PUT이 성공한다');
  const imageGet = page.waitForResponse((response) => isNoteResponse(response, 'GET', noteId));
  await page.reload();
  const savedImage = await data(await imageGet);
  assert(
    savedImage.content.includes('data:image/png;base64,') && !savedImage.content.includes('blob:'),
    '새로고침 뒤 실제 GET에 영속 data URI가 있고 blob URL이 없다',
  );
  const reloadedImage = dialog.locator('img[src^="data:image/png;base64,"]');
  await reloadedImage.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.note-editor img[src^="data:image/png;base64,"]');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  assert(
    await reloadedImage.evaluate((image) => image.naturalWidth > 0),
    '새로고침 뒤 저장된 PNG가 실제 픽셀로 디코드된다',
  );
  return { passed: checks.length, checks, qaNoteIds: [noteId], recoveredQaTitle };
}
