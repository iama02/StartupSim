const test = async () => {
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: 'You are a bot. Reply with exactly {"status": "ok"}' }],
        jsonMode: true,
        model: 'openai'
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Text:", text);
  } catch (e) {
    console.error(e);
  }
};
test();
