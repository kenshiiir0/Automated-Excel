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

// Google periodically retires older Gemini model IDs -- 'gemini-1.5-flash'
// returned a 404 "not found for API version v1beta" in production even
// though the API key and network path were both fine (confirmed via
// Vercel's function logs: a real, specific response came back from
// Google, not an auth or network failure). Rather than hardcode a single
// model name that can go stale the same way again, try a short list of
// current candidates in order and use whichever one actually responds.
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

// Turns short bullet facts (e.g. "Jimmy Boy, late 6 times, June 11-25
// cutoff, no prior notice given") into 1-3 formal paragraphs matching the
// tone of the three real HR memos this was modeled on. Returns plain
// text (no markdown) ready to paste into the incident_narrative field --
// HR reviews and edits it before anything is finalized, this never
// writes directly into a sent memo.
async function draftIncidentNarrative({ memoType, ruleText, bulletFacts }) {
    const genAI = getClient();

    const tone = MEMO_TONE_GUIDANCE[memoType] || MEMO_TONE_GUIDANCE.NTE;
    const prompt = `You are drafting the factual narrative paragraph(s) for a Philippine company's internal HR disciplinary memo.

${tone}

Company rule being cited: ${ruleText}

Facts provided by HR (short bullet notes):
${bulletFacts}

Write 1-3 short, formal paragraphs (plain text, no markdown, no headers, no bullet points) stating these facts clearly and professionally, the way an HR department would write them in an official memo. Do not invent any facts not given above. Do not include a greeting, signature, or closing line -- only the narrative paragraph(s) themselves.`;

    let lastError = null;
    for (const modelName of MODEL_CANDIDATES) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            if (!text) throw new Error('AI drafting returned an empty response.');
            return text;
        } catch (err) {
            // A 404 means THIS model name is retired/unavailable -- worth
            // trying the next candidate. Any other error (bad key, quota,
            // network) will fail identically on every candidate, so don't
            // burn through the whole list pointlessly -- surface it now.
            lastError = err;
            if (err.status !== 404) throw err;
        }
    }
    throw lastError || new Error('No Gemini model candidate was available.');
}

export { draftIncidentNarrative };
