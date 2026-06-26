async function test() {
  const imagePrompt = "A beautiful startup office cinematic graphic novel style";
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=576&nologo=true`;

  const response = await fetch(url);
  console.log("STATUS:", response.status);
  console.log("CONTENT-TYPE:", response.headers.get('content-type'));
  // if 200, we can save it.
}
test();
