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

export { MEMO_TYPES, getMemoTypeConfig, renderMemoDocx, TODAY_LONG };
