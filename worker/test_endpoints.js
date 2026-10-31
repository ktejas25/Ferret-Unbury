async function testAll() {
  const BASE = 'http://127.0.0.1:8787';
  console.log('Testing Cloudflare Worker at ' + BASE);

  const results = [];

  // Helper
  async function test(name, fn) {
    try {
      const start = Date.now();
      const res = await fn();
      const duration = Date.now() - start;
      results.push({ name, passed: true, duration, data: res });
      console.log(`[PASS] ${name} (${duration}ms)`);
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Health
  await test('GET /api/health', async () => {
    const r = await fetch(`${BASE}/api/health`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (j.status !== 'healthy' || j.database !== 'connected') {
      throw new Error(`Unexpected health payload: ${JSON.stringify(j)}`);
    }
    return j;
  });

  // 2. Settings
  await test('GET /api/settings', async () => {
    const r = await fetch(`${BASE}/api/settings`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!j.settings || !j.settings.theme) throw new Error('Missing settings.theme');
    return j.settings;
  });

  // 3. Search: Semantic / Keyword query
  await test('POST /api/search (annual tax invoice)', async () => {
    const r = await fetch(`${BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'annual tax invoice' }),
    });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.results) || j.results.length === 0) {
      throw new Error(`Expected results, got ${JSON.stringify(j)}`);
    }
    return { resultsCount: j.results.length, topMatch: j.results[0].filename, score: j.results[0].score };
  });

  // 4. Search suggestions
  await test('GET /api/search/suggest?q=tax', async () => {
    const r = await fetch(`${BASE}/api/search/suggest?q=tax`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.suggestions)) throw new Error('Expected suggestions array');
    return j.suggestions;
  });

  // 5. Open file
  await test('POST /api/search/open', async () => {
    const r = await fetch(`${BASE}/api/search/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: 1 }),
    });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!j.success) throw new Error('Expected success=true');
    return j.message;
  });

  // 6. Index status
  await test('GET /api/index/status', async () => {
    const r = await fetch(`${BASE}/api/index/status`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (typeof j.total_files !== 'number') throw new Error('Expected total_files number');
    return j;
  });

  // 7. Folders list
  await test('GET /api/index/folders', async () => {
    const r = await fetch(`${BASE}/api/index/folders`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j) || j.length === 0) throw new Error('Expected folder list');
    return { folderCount: j.length };
  });

  // 8. History
  await test('GET /api/history', async () => {
    const r = await fetch(`${BASE}/api/history`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.items)) throw new Error('Expected history items array');
    return { count: j.items.length };
  });

  // 9. Static Assets (SPA index.html)
  await test('GET / (SPA Index HTML)', async () => {
    const r = await fetch(`${BASE}/`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const html = await r.text();
    if (!html.includes('<title>') && !html.includes('id="root"')) {
      throw new Error('Did not return valid React HTML root');
    }
    return 'HTML received';
  });

  // 10. Static JS Bundle
  await test('GET /assets/index-DlyeZ-1E.js (Static Vite JS)', async () => {
    const r = await fetch(`${BASE}/assets/index-DlyeZ-1E.js`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const js = await r.text();
    if (js.length < 1000) throw new Error('Vite JS bundle too short');
    return { length: js.length };
  });

  console.log('\n--- Test Summary ---');
  const allPassed = results.every(r => r.passed);
  console.log(`Passed: ${results.filter(r => r.passed).length} / ${results.length}`);
  if (!allPassed) {
    process.exit(1);
  }
}

testAll().catch(e => {
  console.error(e);
  process.exit(1);
});

