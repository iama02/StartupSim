const fs = require('fs');

let content = fs.readFileSync('c:/StartupSim/server.js', 'utf8');

const helperFn = `
async function generateAIContent(systemPrompt, userPrompt = null, forceJson = true) {
  let groqFailed = false;
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const messages = [{ role: "system", content: systemPrompt }];
      if (userPrompt) messages.push({ role: "user", content: userPrompt });
      const options = { messages, model: "llama-3.3-70b-versatile" };
      if (forceJson) options.response_format = { type: "json_object" };
      const chatCompletion = await groq.chat.completions.create(options);
      return chatCompletion.choices[0].message.content.trim();
    } catch (err) {
      console.warn("Groq API Failed, falling back to Pollinations AI. Error:", err.message);
      groqFailed = true;
    }
  }
  
  if (!process.env.GROQ_API_KEY || groqFailed) {
    console.log("Using Pollinations AI for text generation...");
    const messages = [{ role: "system", content: systemPrompt }];
    if (userPrompt) messages.push({ role: "user", content: userPrompt });
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: "openai", jsonMode: forceJson })
    });
    if (!res.ok) throw new Error(\`Pollinations API failed: \${res.statusText}\`);
    return await res.text();
  }
}
`;

// Insert helper
content = content.replace(
  "fs.mkdirSync(generatedComicsDir, { recursive: true });",
  "fs.mkdirSync(generatedComicsDir, { recursive: true });\n" + helperFn
);

// 1. resolve-opportunity
content = content.replace(
  /if \(process\.env\.GROQ_API_KEY\) \{\s*const groq = new Groq\(\{ apiKey: process\.env\.GROQ_API_KEY \}\);\s*(const systemPrompt = `[\s\S]*?ACCEPT it fully \(e.g. full budget boost, high investor trust \+15\).`;)\s*const chatCompletion = await groq\.chat\.completions\.create\(\{\s*messages: \[\{ role: "system", content: systemPrompt \}\],\s*model: "llama-3\.3-70b-versatile",\s*response_format: \{ type: "json_object" \}\s*\}\);\s*const text = chatCompletion\.choices\[0\]\.message\.content\.trim\(\);\s*try \{\s*finalOutcomeData = JSON\.parse\(text\);\s*\} catch \(e\) \{\s*console\.error\("Opportunity parse error:", text\);\s*\/\/ Stick to fallback\s*\}\s*\}/,
  `$1
    try {
      const text = await generateAIContent(systemPrompt, null, true);
      finalOutcomeData = JSON.parse(text);
    } catch (e) {
      console.error("Opportunity parse/API error:", e);
    }`
);

// 2. generate-journey
content = content.replace(
  /if \(!process\.env\.GROQ_API_KEY\) \{\s*console\.warn\("Missing GROQ_API_KEY, using fallback journey\."\);\s*return res\.json\(fallbackJourney\);\s*\}\s*const groq = new Groq\(\{ apiKey: process\.env\.GROQ_API_KEY \}\);\s*(const systemPrompt = `[\s\S]*?and one has "debate".`;)\s*(const userPrompt = [\s\S]*?;)\s*console\.log\("Generating AI journey for idea:", idea\);\s*const chatCompletion = await groq\.chat\.completions\.create\(\{\s*messages: \[\{ role: "user", content: userPrompt \}\],\s*model: "llama-3\.3-70b-versatile",\s*response_format: \{ type: "json_object" \}\s*\}\);\s*let text = chatCompletion\.choices\[0\]\.message\.content\.trim\(\);/,
  `$1
    $2
    console.log("Generating AI journey for idea:", idea);
    let text;
    try {
      text = await generateAIContent(systemPrompt, userPrompt, true);
    } catch (apiError) {
      console.warn("API Error, using fallback journey.", apiError);
      return res.json(fallbackJourney);
    }`
);

// 3. generate-outcome
content = content.replace(
  /if \(process\.env\.GROQ_API_KEY\) \{\s*const groq = new Groq\(\{ apiKey: process\.env\.GROQ_API_KEY \}\);\s*(const systemPrompt = `[\s\S]*?EXACTLY 4 strings in the array\)\.`;)\s*const chatCompletion = await groq\.chat\.completions\.create\(\{\s*messages: \[\{ role: "system", content: systemPrompt \}\],\s*model: "llama-3\.3-70b-versatile",\s*response_format: \{ type: "json_object" \}\s*\}\);\s*const text = chatCompletion\.choices\[0\]\.message\.content\.trim\(\);\s*try \{\s*finalOutcomeData = JSON\.parse\(text\);\s*\} catch \(parseError\) \{\s*console\.error\("Failed to parse JSON response from Groq Outcome:", text\);\s*return res\.status\(500\)\.json\(\{ error: "AI generated invalid data format\." \}\);\s*\}\s*\}/,
  `$1
    try {
      const text = await generateAIContent(systemPrompt, null, true);
      finalOutcomeData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON response from Outcome API:", parseError);
      return res.status(500).json({ error: "AI generated invalid data format." });
    }`
);

// 4. generate-dashboard
content = content.replace(
  /const groq = new Groq\(\{ apiKey: process\.env\.GROQ_API_KEY \}\);\s*(const historyTimeline = [\s\S]*?Respond EXACTLY with this JSON schema:[\s\S]*?\}\`);\s*const chatCompletion = await groq\.chat\.completions\.create\(\{\s*messages: \[\{ role: "system", content: prompt \}\],\s*model: "llama-3\.3-70b-versatile",\s*response_format: \{ type: "json_object" \}\s*\}\);\s*const data = JSON\.parse\(chatCompletion\.choices\[0\]\.message\.content\.trim\(\)\);/,
  `$1
    let data;
    try {
      const text = await generateAIContent(prompt, null, true);
      data = JSON.parse(text);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "API generation failed." });
    }`
);

// 5. generate-scenario
content = content.replace(
  /const groq = new Groq\(\{ apiKey: process\.env\.GROQ_API_KEY \}\);\s*(\/\/ Inject branching context[\s\S]*?rather than standard actions\.`;)\s*console\.log\("Generating scenario for:", stageName\);\s*const chatCompletion = await groq\.chat\.completions\.create\(\{\s*messages: \[\{ role: "system", content: systemPrompt \}\],\s*model: "llama-3\.3-70b-versatile",\s*response_format: \{ type: "json_object" \}\s*\}\);\s*const text = chatCompletion\.choices\[0\]\.message\.content\.trim\(\);/,
  `$1
    console.log("Generating scenario for:", stageName);
    const text = await generateAIContent(systemPrompt, null, true);`
);

fs.writeFileSync('c:/StartupSim/server.js', content);
console.log('Server updated');
