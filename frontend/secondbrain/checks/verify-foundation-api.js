// Run with the official playwright-cli skill against a running Vite web app:
// playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-foundation-api.js
// This checks synthetic API payloads through the real service parsers, not server persistence.
async function verifyFoundationApi(page) {
  return await page.evaluate(async () => {
    const { parseRecentNotes, parseSearchNotes } =
      await import('/src/features/main/services/searchService.ts');
    const { mergeSavedNotesWithGraph, parseGraphVisualization, parseSavedGraphNodes } =
      await import('/src/features/main/services/graphService.ts');
    const passed = [];
    function check(name, action) {
      if (!action()) throw new Error(`Contract regression: ${name}`);
      passed.push(name);
    }
    function rejects(action) {
      try {
        action();
        return false;
      } catch {
        return true;
      }
    }
    const ok = { success: true, code: 200, message: 'Synthetic success' };
    for (const data of [undefined, null, []]) {
      check(
        `recent empty ${data === undefined ? 'omitted' : data === null ? 'null' : 'array'}`,
        () => parseRecentNotes({ ...ok, data }).length === 0,
      );
    }
    check(
      'recent valid IDs',
      () => parseRecentNotes({ ...ok, data: [{ noteId: 1, title: 'Fixture' }] })[0].noteId === 1,
    );
    check('recent failed envelope', () =>
      rejects(() => parseRecentNotes({ ...ok, success: false })),
    );
    check('recent malformed envelope', () => rejects(() => parseRecentNotes({ success: true })));
    check('recent malformed array', () => rejects(() => parseRecentNotes({ ...ok, data: {} })));
    check('recent string ID rejected', () =>
      rejects(() => parseRecentNotes({ ...ok, data: [{ noteId: '1', title: 'Fixture' }] })),
    );
    const emptySearch = { results: [], totalCount: 0, currentPage: 0, totalPages: 0, pageSize: 10 };
    check(
      'search empty data valid',
      () => parseSearchNotes({ ...ok, data: emptySearch }).results.length === 0,
    );
    check('search absent data is failure', () => rejects(() => parseSearchNotes(ok)));
    check('search malformed result is failure', () =>
      rejects(() => parseSearchNotes({ ...ok, data: { ...emptySearch, results: [{ id: 1 }] } })),
    );
    check('search failure is not empty', () =>
      rejects(() => parseSearchNotes({ ...ok, success: false, data: emptySearch })),
    );
    const note = {
      id: 1,
      title: 'Fixture',
      content: 'Synthetic body',
      userId: 1,
      createdAt: '2026-09-25T12:00:00.123456',
      updatedAt: '2026-09-25T12:00:00Z',
      remindCount: 0,
    };
    check(
      'search ISO local/UTC dates accepted',
      () =>
        parseSearchNotes({
          ...ok,
          data: { ...emptySearch, results: [note], totalCount: 1, totalPages: 1 },
        }).results[0].id === 1,
    );
    check('search invalid date rejected', () =>
      rejects(() =>
        parseSearchNotes({
          ...ok,
          data: { ...emptySearch, results: [{ ...note, createdAt: 'invalid' }] },
        }),
      ),
    );
    const graph = {
      user_id: 1,
      nodes: [{ id: 1, title: 'Fixture', created_at: '2026-09-25T12:00:00Z' }],
      links: [],
      stats: null,
    };
    check(
      'graph numeric IDs and null stats',
      () => parseGraphVisualization(graph).nodes[0].id === 1,
    );
    check('graph missing nodes rejected', () =>
      rejects(() => parseGraphVisualization({ user_id: 1, links: [], stats: null })),
    );
    check('graph string ID rejected', () =>
      rejects(() => parseGraphVisualization({ ...graph, nodes: [{ ...graph.nodes[0], id: '1' }] })),
    );
    check('graph invalid score rejected', () =>
      rejects(() =>
        parseGraphVisualization({ ...graph, links: [{ source: 1, target: 1, score: 2 }] }),
      ),
    );
    const savedNotes = Array.from({ length: 12 }, (_, index) => ({
      noteId: index + 1,
      title: `Saved note ${index + 1}`,
      createdAt: '2026-09-25T12:00:00Z',
    }));
    const savedEnvelope = { ...ok, data: savedNotes };
    check(
      'saved graph metadata retains more than ten notes',
      () => parseSavedGraphNodes(savedEnvelope).length === 12,
    );
    const savedWithCanonicalTitle = savedNotes.slice(0, 2);
    const mergedGraph = mergeSavedNotesWithGraph(savedWithCanonicalTitle, {
      ...graph,
      nodes: [
        { id: 1, title: 'AI old title', created_at: '2026-09-25T12:00:00Z' },
        { id: 2, title: 'AI title', created_at: '2026-09-25T12:00:00Z' },
        { id: 99, title: 'AI only note', created_at: '2026-09-25T12:00:00Z' },
      ],
      links: [
        { source: 1, target: 2, score: 0.9 },
        { source: 1, target: 99, score: 0.8 },
        { source: 99, target: 2, score: 0.7 },
        { source: 99, target: 100, score: 0.6 },
      ],
    });
    check(
      'saved graph title overrides stale AI title',
      () => mergedGraph.nodes[0].title === 'Saved note 1',
    );
    check(
      'saved graph keeps links only when both endpoints are saved',
      () =>
        mergedGraph.links.length === 1 &&
        mergedGraph.links[0].source === 1 &&
        mergedGraph.links[0].target === 2,
    );
    const savedOnlyGraph = mergeSavedNotesWithGraph(savedWithCanonicalTitle, undefined);
    check(
      'saved graph without AI keeps nodes and has no links',
      () => savedOnlyGraph.nodes.length === 2 && savedOnlyGraph.links.length === 0,
    );
    check('saved graph invalid metadata rejected', () =>
      rejects(() =>
        parseSavedGraphNodes({
          ...ok,
          data: [{ ...savedNotes[0], createdAt: 'invalid' }],
        }),
      ),
    );
    check('saved graph malformed envelope rejected', () =>
      rejects(() => parseSavedGraphNodes({ success: true, data: savedNotes })),
    );
    return { passed: passed.length, checks: passed };
  });
}
