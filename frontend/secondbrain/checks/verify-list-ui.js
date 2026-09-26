/**
 * Authenticated playwright-cli run-code check against the real local backend.
 * Creates one uniquely named QA note and returns its ID for deliberate cleanup.
 * The list interaction uses Playwright keyboard actions; it does not prove IME
 * composition or a physical pointer drag of Crepe's block handle.
 */
async function verifyListUi(page) {
  const checks = [];
  const prefix = `SB QA 목록 ${Date.now().toString(36)}`;
  const title = `${prefix} 접근성 확인`;
  const bulletA = `${prefix} 글머리 첫째`;
  const bulletB = `${prefix} 글머리 둘째`;
  const bulletC = `${prefix} 글머리 셋째`;
  const ordered = `${prefix} 번호 항목`;
  const task = `${prefix} 할 일 항목`;
  let noteId = null;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks.push(message);
  }
  function isNoteResponse(response, method, id) {
    return response.request().method() === method && response.url().endsWith(`/api/notes/${id}`);
  }
  async function assertListMarkup(editor) {
    const result = await editor.evaluate((element) => {
      const lists = Array.from(element.querySelectorAll('ul, ol'));
      return {
        count: lists.length,
        invalid: lists.flatMap((list) =>
          Array.from(list.children)
            .filter((child) => !['LI', 'SCRIPT', 'TEMPLATE'].includes(child.tagName))
            .map((child) => `${list.tagName}>${child.tagName}`),
        ),
        nested: Boolean(element.querySelector('ul > li ul > li')),
      };
    });
    assert(result.count > 0 && result.invalid.length === 0, '모든 UL/OL의 직접 자식이 LI이다');
    return result;
  }
  async function slashBlock(alias, koreanLabel) {
    await page.keyboard.insertText(`/${alias}`);
    const menu = page.locator('.note-editor .milkdown-slash-menu');
    await menu.waitFor({ state: 'visible' });
    assert(
      (await menu.textContent()).includes(koreanLabel),
      `슬래시 메뉴가 '${koreanLabel}' 항목을 표시한다`,
    );
    await page.keyboard.press('Enter');
    await menu.waitFor({ state: 'hidden' });
  }

  // Read the existing rich-text fixture without editing it. This is the exact
  // content on which Lighthouse originally reported UL > DIV > LI.
  await page.goto('http://localhost:5173/notes/95');
  const existingEditor = page.locator('.note-editor .ProseMirror');
  await existingEditor.waitFor();
  const existingLists = await assertListMarkup(existingEditor);
  assert(existingLists.count >= 1, '기존 풍부한 노트의 목록을 실제로 검사했다');

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
  await page.waitForFunction(() => document.activeElement?.matches('.note-editor .ProseMirror'));

  await slashBlock('bullet', '글머리 기호');
  await page.keyboard.insertText(bulletA);
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(bulletB);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => Boolean(document.querySelector('.note-editor ul > li ul > li')));
  assert(
    (await editor.textContent()).includes(bulletB),
    'Tab이 두 번째 글머리를 중첩하고 내용을 보존한다',
  );
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => !document.querySelector('.note-editor ul > li ul > li'));
  assert(
    (await editor.locator('ul > li').count()) >= 2,
    'Shift+Tab이 항목을 바깥 목록으로 되돌린다',
  );
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(bulletC);
  await page.keyboard.press('ControlOrMeta+Z');
  await page.waitForFunction(
    (text) => !document.querySelector('.note-editor .ProseMirror')?.textContent?.includes(text),
    bulletC,
  );
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await page.waitForFunction(
    (text) => document.querySelector('.note-editor .ProseMirror')?.textContent?.includes(text),
    bulletC,
  );
  assert(
    (await editor.textContent()).includes(bulletC),
    '목록 항목의 실행 취소와 다시 실행이 동작한다',
  );

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await slashBlock('number', '번호 목록');
  await page.keyboard.insertText(ordered);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await slashBlock('todo', '할 일');
  await editor.getByRole('checkbox', { name: '할 일 완료' }).first().waitFor();
  assert(
    (await editor.getByRole('checkbox', { name: '할 일 완료' }).count()) >= 1,
    '빈 할 일 항목의 체크박스에는 기본 이름이 있다',
  );
  await page.keyboard.insertText(task);
  const taskCheckbox = editor.getByRole('checkbox', { name: `${task} 완료` });
  await taskCheckbox.waitFor();
  assert((await taskCheckbox.count()) === 1, '할 일 본문으로 체크박스를 구분할 수 있다');
  assert(!(await taskCheckbox.isChecked()), '새 할 일 항목의 체크박스는 해제되어 있다');
  await taskCheckbox.check();
  assert(await taskCheckbox.isChecked(), '실제 체크박스 입력으로 완료 상태를 바꾼다');
  await assertListMarkup(editor);
  assert((await editor.locator('ol > li').count()) >= 1, '번호 목록도 LI로 렌더링된다');

  const promotedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/notes/from-draft/'),
  );
  await dialog.getByRole('button', { name: '작성 마치기' }).click();
  const promoted = await promotedResponse;
  assert(promoted.ok(), '목록 노트의 실제 서버 승격이 성공한다');
  const promotedBody = await promoted.json();
  assert(promotedBody.success === true && promotedBody.data, '서버 승격 응답이 유효하다');
  noteId = promotedBody.data.noteId;
  assert(Number.isSafeInteger(noteId) && noteId > 0, '승격한 QA 노트 ID를 받는다');
  const markdown = promotedBody.data.content;
  assert(
    [bulletA, bulletB, bulletC, ordered, task].every((text) => markdown.includes(text)),
    '실제 Markdown 응답이 모든 목록 항목을 보존한다',
  );
  assert(/[-*+] \[x\]/.test(markdown), '실제 Markdown 응답이 완료된 할 일을 보존한다');
  assert(/\d+\. /.test(markdown), '실제 Markdown 응답이 번호 목록을 보존한다');
  await dialog.waitFor({ state: 'hidden' });

  const getResponse = page.waitForResponse((response) => isNoteResponse(response, 'GET', noteId));
  await page.goto(`http://localhost:5173/notes/${noteId}`);
  const get = await getResponse;
  assert(get.ok(), '새 화면에서 실제 서버 GET이 성공한다');
  const getBody = await get.json();
  assert(
    getBody.success === true && getBody.data.content === markdown,
    'GET이 같은 Markdown을 돌려준다',
  );
  await editor.waitFor();
  assert(
    await editor.getByRole('checkbox', { name: `${task} 완료` }).isChecked(),
    '재진입 뒤 할 일 완료 상태가 보인다',
  );
  await assertListMarkup(editor);

  const blockHandleObserved = await dialog.locator('.milkdown-block-handle').count();
  return {
    passed: checks.length,
    checks,
    qaNoteIds: [noteId],
    blockHandleObserved,
    blockDragVerified: false,
  };
}
