// No node-fetch require

async function test() {
  const token = process.env.REPLICATE_API_TOKEN; 
  const imagePrompt = "test prompt";

  const response = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt: imagePrompt,
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 90
        },
      }),
    }
  );

  const errorText = await response.text();
  console.log("STATUS:", response.status);
  console.log("RESPONSE:", errorText);
}
test();
