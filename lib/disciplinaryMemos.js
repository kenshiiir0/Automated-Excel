import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'disciplinary');

// Maps the memo_type stored in the DB to its template file and a
// human-readable label used in emails/UI.
const MEMO_TYPES = {
    NTE: {
        label: 'Notice to Explain',
        file: 'NTE_template.docx',
        narrativeStarter: 'On {{incident_date}}, the employee ',
    },
    WRITTEN_WARNING: {
        label: 'Written Warning',
        file: 'WrittenWarning_template.docx',
        narrativeStarter: 'Records show that the employee ',
    },
    FINAL_WRITTEN_WARNING: {
        label: 'Final Written Warning',
        file: 'FinalWrittenWarning_template.docx',
        narrativeStarter: 'Despite the prior warning, the employee ',
    },
};

// Company rules HR can pick from when filling out "Company Rule Violated".
// Rule 3.1 and 5.2 are copied verbatim from real GetMeds disciplinary memos
// already on file -- everything else here is a placeholder in the same
// numbering family (attendance = 3.x, conduct/performance = 5.x) so the
// dropdown isn't oddly thin while only two rules are confirmed. HR can
// rename, renumber, add, or remove entries here at any time -- this array
// is the single source of truth for both the dropdown and (if ever
// needed) validation, so there is only one place to update the real list
// once the full company rule book/handbook is available.
const COMPANY_RULES = [
    { code: '3.1', text: 'Rule No. 3.1 Tardiness, leaving early, exceeding breaks, or failing to report for agreed overtime. (Per DOLE Rules on Working Hours, Art. 83-96 Labor Code)' },
    { code: '3.2', text: 'Rule No. 3.2 Unauthorized or unexplained absence from work (AWOL).' },
    { code: '3.3', text: 'Rule No. 3.3 Failure to log in/out or falsifying time records.' },
    { code: '5.1', text: 'Rule No. 5.1 Insubordination or refusal to follow lawful instructions from a supervisor.' },
    { code: '5.2', text: 'Rule No. 5.2 Neglect of duty or failure to follow established procedures, rules, or work instructions including SOP compliance.' },
    { code: '5.3', text: 'Rule No. 5.3 Gross and habitual negligence resulting in loss, damage, or risk to the Company or its clients.' },
    { code: '5.4', text: 'Rule No. 5.4 Discourtesy or disrespectful conduct towards a client, co-worker, or supervisor.' },
    { code: 'OTHER', text: 'Other (type the rule manually)' },
];

function getMemoTypeConfig(memoType) {
    const config = MEMO_TYPES[memoType];
    if (!config) throw new Error(`Unknown memo type: ${memoType}`);
    return config;
}

// docxtemplater in the version installed here defaults to a SINGLE-brace
// delimiter ('{'/'}'), not the double-brace '{{ }}' shown in most online
// examples -- using {{tag}} without explicitly setting delimiters here
// makes the lexer see two adjacent single-brace opens and fail with a
// confusing "duplicate open tag" error. This was diagnosed by testing
// against the simplest possible one-tag document and reading the
// lexer's own duplicate-detection logic (adjacent-delimiter check) --
// it is NOT related to document corruption or the specific templates.
const DOCXTEMPLATER_OPTIONS = {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
};

// Renders one memo_type's template with the given field values and
// returns the finished .docx as a Buffer. Every template placeholder
// must have a value here or docxtemplater throws (better to fail loudly
// than silently ship a memo with a literal "{{position}}" left in it).
function renderMemoDocx(memoType, fields) {
    const config = getMemoTypeConfig(memoType);
    const templatePath = path.join(TEMPLATES_DIR, config.file);
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, DOCXTEMPLATER_OPTIONS);
    doc.render(fields);
    return doc.getZip().generate({ type: 'nodebuffer' });
}

const TODAY_LONG = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

export { MEMO_TYPES, getMemoTypeConfig, renderMemoDocx, TODAY_LONG, COMPANY_RULES };
