/**
 * api.js — Google Gemini API
 * ─────────────────────────────────────────────────────
 * All AI calls hit POST /api/gemini on the local server.
 * The server adds your GEMINI_API_KEY and forwards to Google.
 *
 * Gemini response shape:
 * { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 */

'use strict';

/**
 * Extracts and parses JSON from a string that might contain extra text or markdown.
 */
function parseJsonFromAI(raw) {
    try {
        // 1. Try simple trim first
        let cleaned = raw.replace(/```json|```/gi, '').trim();
        try { return JSON.parse(cleaned); } catch (_) { }

        // 2. Extract anything between [ ] or { }
        const firstOpen = Math.min(
            raw.indexOf('{') === -1 ? Infinity : raw.indexOf('{'),
            raw.indexOf('[') === -1 ? Infinity : raw.indexOf('[')
        );
        const lastClose = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));

        if (firstOpen !== Infinity && lastClose !== -1 && lastClose > firstOpen) {
            cleaned = raw.substring(firstOpen, lastClose + 1);
            return JSON.parse(cleaned);
        }
        throw new Error("No JSON structure found in response.");
    } catch (e) {
        console.error("JSON Parse Error. Raw response:", raw);
        throw new Error("Parsing failure: AI returned a malformed response.");
    }
}

// ── Core Gemini call ───────────────────────────────────
async function callGemini(systemPrompt, userPrompt, fileData = null, fileType = '') {
    const bodyPayload = { systemPrompt, userPrompt };
    if (fileData) {
        bodyPayload.fileData = fileData;
        bodyPayload.fileType = fileType;
    }

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || `Server error ${response.status}`);
    }

    const data = await response.json();

    // Parse Gemini's response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        console.error('Unexpected Gemini response:', JSON.stringify(data));
        throw new Error('Empty response from Gemini. Check your API key.');
    }
    return text.trim();
}

// ── Generate all interview questions ──────────────────
async function generateQuestions(userName, jobRole, domain, expLevel, hrCount, techCount, codeCount, resume = '', resumeData = null, resumeType = '', projectDetails = '') {
    const system = `You are an expert interview question generator.
Return ONLY a valid JSON array of objects. No markdown, no explanation, no extra text.
Ensure all strings are properly escaped for JSON and the JSON is fully closed.`;

    const user = `Generate interview questions for:
- Name            : ${userName}
- Role            : ${jobRole}
- Tech stack      : ${domain}
- Experience      : ${expLevel}
- HR questions    : ${hrCount}
- Tech questions  : ${techCount}
- Coding problems : ${codeCount}
${projectDetails ? `\n- KEY PROJECT DETAILS :\n${projectDetails}\n(CRITICAL: Dedicate a portion of the Technical or HR rounds to discuss this project. Ask about its architecture, challenges, or specific implementation details.)` : ''}
${resume ? `\n- RESUME CONTEXT :\n${resume}\n(CRITICAL: Priority should be given to projects and experiences mentioned in this resume. Ask specific questions that validate these claims.)` : ''}

Rules:
1. List questions in this exact order: HR, then Technical, then Coding.
2. HR = realistic behavioral/situational questions.
3. Technical = domain-specific questions.
4. Coding = small but effective algorithmic or system design coding challenges.
5. Each object MUST have "round" (one of: "hr", "tech", "coding") and "text" fields.

Return ONLY this JSON array format:
[
  {"round":"hr",     "text":"..."},
  {"round":"tech",   "text":"..."},
  {"round":"coding", "text":"..."}
]`;

    const raw = await callGemini(system, user, resumeData, resumeType);
    return parseJsonFromAI(raw);
}

// ── Evaluate one answer ────────────────────────────────
async function evaluateAnswer(question, round, answer, jobRole, expLevel, domain) {
    const system = `You are a strict and accurate interview evaluator. Your job is to grade answers honestly.
Return ONLY a valid JSON object. No markdown, no explanation.
Ensure all strings are properly escaped for JSON and correctly terminated.`;

    const user = `Evaluate this interview answer strictly and accurately:
- Question: "${question}"
- Round   : ${round === 'hr' ? 'HR / Behavioral' : 'Technical'}
- Role    : ${jobRole}
- Level   : ${expLevel}
- Stack   : ${domain}
- Answer  : "${answer}"

Scoring rubric (YOU MUST follow this strictly — do NOT default to 5):
- 1-2: No answer, totally wrong, or completely irrelevant response
- 3-4: Partially correct but missing key points or very vague
- 5-6: Acceptable but not impressive; some gaps in knowledge
- 7-8: Good answer with most key points covered correctly
- 9-10: Excellent, complete, and accurate answer with clear understanding

If the answer is empty, garbled, or says nothing relevant, score it 1.
If the answer is correct and complete, score it 8-10.
Do NOT give 5 as a default. Be discriminating and honest.

Return ONLY this JSON format (no markdown, no extra text):
{
  "score"  : <integer 1-10>,
  "good"   : "<1-2 sentences about what was good, or 'Nothing notable' if the answer was poor>",
  "improve": "<2-3 sentences: what was wrong/missing + the ideal correct answer>"
}`;

    const raw = await callGemini(system, user);
    return parseJsonFromAI(raw);
}

// ── Evaluate code submission ──────────────────────────
async function evaluateCode(question, code, jobRole, domain) {
    const system = `You are an expert code reviewer. Grade code submissions honestly and strictly.
Return ONLY a valid JSON object. No markdown, no explanation.
Ensure the response is fully closed and strings properly escaped.`;

    const user = `Evaluate this coding solution strictly and accurately:
- Problem: "${question}"
- Role   : ${jobRole}
- Stack  : ${domain}
- Solution:
\`\`\`
${code}
\`\`\`

Scoring rubric (YOU MUST follow this strictly — do NOT default to 5):
- 1-2: Empty, completely wrong, or does not compile/run
- 3-4: Partially correct but has major logical errors or missing core logic
- 5-6: Roughly correct approach but inefficient, unclean, or has bugs
- 7-8: Correct solution with minor inefficiencies or style issues
- 9-10: Optimal, clean, handles edge cases, excellent solution

If the code is empty or placeholder, score it 1.
If the code correctly solves the problem efficiently, score it 8-10.
Do NOT give 5 as a default. Be discriminating and honest.

Rules:
1. Analyze logic, efficiency, and edge cases.
2. In "improve", provide the fully OPTIMIZED/CORRECTED code inside markdown code blocks.

Return ONLY this JSON format:
{
  "score"  : <integer 1-10>,
  "good"   : "<1-2 sentences analysis>",
  "improve": "<The ideal solution in markdown code blocks + brief tips>"
}`;

    const raw = await callGemini(system, user);
    return parseJsonFromAI(raw);
}

// ── Generate final verdict ─────────────────────────────
async function generateVerdict(userName, jobRole, answers) {
    const scoreLines = answers
        .map((a, i) => `Q${i + 1}[${a.round}]: "${a.question}" → ${a.score}/10`)
        .join('\n');
    const overall = (answers.reduce((s, a) => s + a.score, 0) / answers.length).toFixed(1);

    const system = `You are a warm but honest interview coach. Be concise — 3 to 4 sentences only.`;
    const user = `Write a final verdict for:
- Name   : ${userName}
- Role   : ${jobRole}
- Overall: ${overall}/10

Scores:
${scoreLines}

Write 3-4 sentences: acknowledge overall performance, mention 1-2 strengths, name 1-2 areas to improve, end with encouragement.
Return plain text only — no bullet points, no headers, no JSON.`;

    return await callGemini(system, user);
}

// Expose globally
window.callGemini = callGemini;
window.generateQuestions = generateQuestions;
window.evaluateAnswer = evaluateAnswer;
window.evaluateCode = evaluateCode;
window.generateVerdict = generateVerdict;
