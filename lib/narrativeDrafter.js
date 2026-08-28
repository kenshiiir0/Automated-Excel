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
//
// IMPORTANT: this order is the one confirmed actually working in
// production for this API key/account/region -- 'gemini-2.5-flash' first.
// An earlier revision of this file tried leading with 'gemini-2.0-flash'
// on the assumption it would be faster for a short single-paragraph task,
// but that model was not reliably available for this key and broke
// drafting entirely rather than speeding it up. Do not reorder this list
// without first confirming a candidate model actually succeeds against
// the real GEMINI_API_KEY in use (e.g. a one-off test call), not just
// assuming it based on general model characteristics.
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

// How long a single attempt is allowed to take before we give up on it and
// fall through to the next candidate. Chosen to comfortably fail BEFORE
// Vercel's own function timeout would kill the whole request out from
// under us (that silent hard-kill, with no error ever reaching the
// frontend, was the "drafting stops out of nowhere" symptom) -- 8s leaves
// headroom even under Vercel's shortest (Hobby-plan, 10s) default, and is
// short relative to Pro-plan limits too.
const PER_ATTEMPT_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const err = new Error(`${label} timed out after ${ms}ms`);
            err.code = 'AI_TIMEOUT';
            reject(err);
        }, ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

function isTransient(err) {
    // Worth a fresh attempt: request timed out, or Google's side had a
    // momentary hiccup (5xx / "overloaded" / connection reset). NOT worth
    // retrying: a 404 (model doesn't exist -- next candidate instead),
    // bad API key / auth errors, or quota-exceeded -- those fail
    // identically every time, so retrying just wastes more time before
    // the real error reaches the user.
    if (err.code === 'AI_TIMEOUT') return true;
    const status = err.status || err.httpStatus;
    if (status === 429) return false; // quota -- retrying won't help
    if (status >= 500 && status < 600) return true;
    if (/overloaded|unavailable|econnreset|etimedout|fetch failed/i.test(err.message || '')) return true;
    return false;
}

async function attemptOnce(genAI, modelName, prompt) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await withTimeout(
        model.generateContent(prompt),
        PER_ATTEMPT_TIMEOUT_MS,
        `Gemini (${modelName})`
    );
    const text = result.response.text().trim();
    if (!text) throw new Error('AI drafting returned an empty response.');
    return text;
}

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
        // Up to 2 tries per candidate: the first attempt, and one retry
        // only if that failure looked transient (timeout / momentary
        // server hiccup). A non-transient failure on try 1 (e.g. 404)
        // skips straight to the next candidate instead of wasting a
        // second attempt on the same dead end.
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                return await attemptOnce(genAI, modelName, prompt);
            } catch (err) {
                lastError = err;
                const status = err.status;
                if (status === 404) break; // model retired/unavailable -- next candidate
                if (attempt === 1 && isTransient(err)) continue; // one retry, same candidate
                break; // either used up the retry, or it's a non-transient error -- next candidate
            }
        }
    }
    throw lastError || new Error('No Gemini model candidate was available.');
}

export { draftIncidentNarrative };
