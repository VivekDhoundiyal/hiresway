async function testCors() {
  const endpoints = [
    { name: 'Ashby linear', url: 'https://api.ashbyhq.com/posting-api/job-board/linear' },
    { name: 'Greenhouse datadog', url: 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs' },
    { name: 'Jobicy', url: 'https://jobicy.com/api/v2/remote-jobs?count=20' },
    { name: 'Remotive', url: 'https://remotive.com/api/remote-jobs?limit=20' }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: {
          'Origin': 'http://localhost:1420',
        }
      });
      console.log(`[${ep.name}] CORS header: access-control-allow-origin = "${res.headers.get('access-control-allow-origin')}"`);
    } catch (err) {
      console.error(`[${ep.name}] error:`, err);
    }
  }
}

testCors();
