import { GoogleGenerativeAI } from '@google/generative-ai';

// Uses Google's Gemini API (free tier -- see migrations/README notes if
// this ever needs to move to a paid key) to expand a few bullet facts
// into a formal HR-memo-style paragraph. Only the bullet facts and memo
// type are sent -- never the employee's full record (salary, government
// IDs, etc.) -- to keep what reaches a third party to the minimum
// needed for this one task.
let client = null;

function getClient() {
    if (!process.env.GEMINI_API_KEY) {
        const err = new Error('AI drafting is not configured (GEMINI_API_KEY is not set).');
        err.code = 'AI_NOT_CONFIGURED';
        throw err;
    }
    if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return client;
}

const MEMO_TONE_GUIDANCE = {
    NTE: 'This is a Notice to Explain. Write in a neutral, fact-stating tone -- describe what happened and why it matters, without stating a conclusion about guilt (the employee has not yet had a chance to respond). End by transitioning naturally into a statement that the employee is being asked to explain.',
    WRITTEN_WARNING: 'This is a Written Warning. Write in a firm but professional tone, stating the specific violation(s) and their pattern (dates, frequency) as established facts, since this warning is already being issued.',
    FINAL_WRITTEN_WARNING: 'This is a Final Written Warning, issued after a prior warning did not resolve the issue. Write in a firm, serious tone that acknowledges the continued/repeated nature of the violation despite the earlier warning.',
};

// Turns short bullet facts (e.g. "Jimmy Boy, late 6 times, June 11-25
// cutoff, no prior notice given") into 1-3 formal paragraphs matching the
// tone of the three real HR memos this was modeled on. Returns plain
// text (no markdown) ready to paste into the incident_narrative field --
// HR reviews and edits it before anything is finalized, this never
// writes directly into a sent memo.
async function draftIncidentNarrative({ memoType, ruleText, bulletFacts }) {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const tone = MEMO_TONE_GUIDANCE[memoType] || MEMO_TONE_GUIDANCE.NTE;
    const prompt = `You are drafting the factual narrative paragraph(s) for a Philippine company's internal HR disciplinary memo.

${tone}

Company rule being cited: ${ruleText}

Facts provided by HR (short bullet notes):
${bulletFacts}

Write 1-3 short, formal paragraphs (plain text, no markdown, no headers, no bullet points) stating these facts clearly and professionally, the way an HR department would write them in an official memo. Do not invent any facts not given above. Do not include a greeting, signature, or closing line -- only the narrative paragraph(s) themselves.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) throw new Error('AI drafting returned an empty response.');
    return text;
}

export { draftIncidentNarrative };
