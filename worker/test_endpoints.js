const fs = require('fs');
const path = require('path');

async function testAll() {
  const BASE = 'http://127.0.0.1:8787';
  console.log('Testing Cloudflare Worker at ' + BASE);

  const results = [];

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
    if (!j.status || !j.database) {
      throw new Error(`Unexpected health payload: ${JSON.stringify(j)}`);
    }
    return { status: j.status, database: j.database, model: j.model };
  });

  // 2. Settings
  await test('GET /api/settings', async () => {
    const r = await fetch(`${BASE}/api/settings`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!j.settings || !j.settings.theme) throw new Error('Missing settings.theme');
    return j.settings;
  });

  // 3. Folders list (Monitored sources)
  await test('GET /api/index/folders', async () => {
    const r = await fetch(`${BASE}/api/index/folders`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('Expected folder list array');
    return { folderCount: j.length };
  });

  // 4. Index status
  await test('GET /api/index/status', async () => {
    const r = await fetch(`${BASE}/api/index/status`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (typeof j.total_files !== 'number') throw new Error('Expected total_files number');
    return j;
  });

  // 5. Worker Pause & Resume
  await test('POST /api/index/pause & /api/index/resume', async () => {
    const r1 = await fetch(`${BASE}/api/index/pause`, { method: 'POST' });
    if (!r1.ok) throw new Error(`Pause failed with status ${r1.status}`);
    const j1 = await r1.json();
    if (!j1.success) throw new Error('Expected success=true for pause');

    const r2 = await fetch(`${BASE}/api/index/resume`, { method: 'POST' });
    if (!r2.ok) throw new Error(`Resume failed with status ${r2.status}`);
    const j2 = await r2.json();
    if (!j2.success) throw new Error('Expected success=true for resume');

    return { paused: j1.message, resumed: j2.message };
  });

  // 6. Search
  await test('POST /api/search', async () => {
    const r = await fetch(`${BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test document search' }),
    });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.results)) {
      throw new Error(`Expected results array, got ${JSON.stringify(j)}`);
    }
    return { resultsCount: j.results.length, tookMs: j.took_ms };
  });

  // 7. History
  await test('GET /api/history', async () => {
    const r = await fetch(`${BASE}/api/history`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.items)) throw new Error('Expected history items array');
    return { count: j.items.length };
  });

  // 8. Static SPA Index
  await test('GET / (SPA Index HTML)', async () => {
    const r = await fetch(`${BASE}/`);
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const html = await r.text();
    if (!html.includes('<title>') && !html.includes('id="root"')) {
      throw new Error('Did not return valid React HTML root');
    }
    return 'HTML received';
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
