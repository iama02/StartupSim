const imagePrompt = [
  'Use case: illustration-story',
  'Asset type: web startup simulation stage visual',
  `Primary request: Create a single, completely unified scene illustration (NO PANELS) for a startup simulation game - Stage: 3.`,
  `Scene/backdrop: A beautiful, modern, semi-realistic startup setting perfectly matching the stage title: "Menu Engineering and Supply Chain Establishment". Minimalist and ultra-clean.`,
  `Story Context: The startup idea is "cloudkitchen" for "B2B/B2C".`,
  `Objective: "Validate your core assumptions before building."`,
  `Immediate scenario: A difficult decision must be made.`,
  `Subject Focus:`,
  `- Emphasize human stakeholders (founders, team, investors, or customers).`,
  `- Characters should be engaged in meaningful interaction fitting the scenario context without speech bubbles.`,
  `- Maintain a clean, uncluttered central area to ensure UI overlays remain highly readable.`,
  `Text rendering rules (CRITICAL & ABSOLUTE):`,
  `- DO NOT include any text whatsoever. NO WORDS, NO LETTERS, NO NUMBERS, NO UI DASHBOARD SCREENS.`,
  `- Replace all posters, laptop screens, or documents with blank glowing surfaces or simple geometric shapes.`,
  `Art Style:`,
  `- Modern, minimal, premium semi-realistic digital illustration.`,
  `- Completely avoid clutter, noisy lighting, and messy backgrounds. Keep the composition simple.`
].join(' ');

console.log("Prompt length:", imagePrompt.length);

fetch('https://image.pollinations.ai/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: imagePrompt,
    width: 1024,
    height: 1024,
    model: 'flux',
    nologo: true,
    enhance: true
  }),
  signal: AbortSignal.timeout(15000)
})
  .then(res => {
    console.log("Status:", res.status, res.statusText);
    res.arrayBuffer().then(buffer => console.log("Bytes received:", buffer.byteLength));
  })
  .catch(err => console.error("Error:", err));
