export default async function handler(req, res) {
  try {
    const { systemPrompt, userPrompt, fileData, fileType } = req.body;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const parts = [{ text: fullPrompt }];

    if (fileData && fileType) {
      parts.push({
        inline_data: {
          mime_type: fileType,
          data: fileData,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
