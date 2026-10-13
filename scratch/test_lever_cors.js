async function testLeverCors() {
  try {
    const res = await fetch('https://api.lever.co/v0/postings/canva?mode=json', {
      headers: { 'Origin': 'http://localhost:1420' }
    });
    console.log('Lever status:', res.status);
    console.log('Lever CORS:', res.headers.get('access-control-allow-origin'));
  } catch (err) {
    console.error('Lever error:', err);
  }
}
testLeverCors();
