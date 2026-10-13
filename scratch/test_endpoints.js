async function testEndpoints() {
  const endpoints = [
    { name: 'Ashby linear', url: 'https://api.ashbyhq.com/posting-api/job-board/linear' },
    { name: 'Greenhouse datadog', url: 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs' },
    { name: 'Lever canva', url: 'https://api.lever.co/v0/postings/canva?mode=json' },
    { name: 'Workable', url: 'https://apply.workable.com/api/v1/widget/accounts/invision' },
    { name: 'Jobicy', url: 'https://jobicy.com/api/v2/remote-jobs?count=20' },
    { name: 'Remotive', url: 'https://remotive.com/api/remote-jobs?limit=20' }
  ];

  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch(ep.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const elapsed = Date.now() - t0;
      console.log(`[${ep.name}] status: ${res.status} (${elapsed}ms)`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  body length: ${text.length}`);
      }
    } catch (err) {
      console.error(`[${ep.name}] FAILED after ${Date.now() - t0}ms:`, err.message);
    }
  }
}

testEndpoints();
