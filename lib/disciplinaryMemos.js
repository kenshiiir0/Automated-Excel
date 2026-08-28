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
// Sourced verbatim from Section V ("List of Deviations and Corrective
// Actions") of the GetMeds Philippines / 2MG Incorporated Code of Conduct
// (2026 rev001) -- the single authoritative rule book, cross-referenced by
// the Employee Handbook rather than duplicated there. Replaces the earlier
// 7-entry placeholder list that only had two rules confirmed verbatim.
// `category`/`categoryLabel` group the dropdown by Rule 1-10 in the UI --
// HR can rename, renumber, add, or remove entries here at any time, since
// this array is the single source of truth for both the dropdown and (if
// ever needed) validation.
const COMPANY_RULES = [
    { code: '1.1', text: 'Rule No. 1.1 Unauthorized use of the Company\'s name, products, logo, or symbols, whether or not resulting in damage to the Company.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '1.2', text: 'Rule No. 1.2 Disclosure of any information pertaining to ongoing investigations or disciplinary proceedings.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '1.3', text: 'Rule No. 1.3 Inappropriate behavior inside or outside Company premises that may damage the reputation of the Company or its pharmaceutical products.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '1.4', text: 'Rule No. 1.4 Unauthorized access, disclosure, reproduction, handling, or destruction of restricted confidential documents or information, including regulatory dossiers, product formulas, or client data.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '1.5', text: 'Rule No. 1.5 Making false, vicious, or malicious statements about the Company and/or its pharmaceutical products.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '1.6', text: 'Rule No. 1.6 Unauthorized posting, publishing, or sharing of Company-related content on social media or any public platform.', category: '1', categoryLabel: 'Rule 1. Company Name, Reputation, and Confidentiality' },
    { code: '2.1', text: 'Rule No. 2.1 Performing work for a competitor or engaging in external business interests that affect Company efficiency or create a conflict of interest.', category: '2', categoryLabel: 'Rule 2. Conflicts of Interest and Company Resources' },
    { code: '2.2', text: 'Rule No. 2.2 Failure to disclose any financial interest or position of responsibility related to competitors, suppliers, or healthcare clients.', category: '2', categoryLabel: 'Rule 2. Conflicts of Interest and Company Resources' },
    { code: '2.3', text: 'Rule No. 2.3 Exploiting Company resources, trade secrets, or proprietary pharmaceutical data for personal projects or external business.', category: '2', categoryLabel: 'Rule 2. Conflicts of Interest and Company Resources' },
    { code: '2.4', text: 'Rule No. 2.4 Unauthorized personal use of Company equipment, time, vehicles, or facilities.', category: '2', categoryLabel: 'Rule 2. Conflicts of Interest and Company Resources' },
    { code: '3.1', text: 'Rule No. 3.1 Tardiness, leaving early, exceeding breaks, or failing to report for agreed overtime. (Per DOLE Rules on Working Hours, Art. 83-96 Labor Code)', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '3.2', text: 'Rule No. 3.2 Absence without official leave (AWOL) -- 1 Day. Employee must file a leave application upon return to work on the same day. Failure to file shall confirm the absence as AWOL.', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '3.3', text: 'Rule No. 3.3 Absence without official leave (AWOL) -- 2 to 3 consecutive days. Employee must submit a Medical Certificate (Med Cert) from a licensed physician upon return to work if the absence is due to illness or injury. Failure to submit a Med Cert within two (2) working days of return shall classify the absence as AWOL regardless of reason. Employee must also file a leave application on the day of return.', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '3.4', text: 'Rule No. 3.4 Absence without official leave (AWOL) -- 4 or more consecutive days, constituting abandonment of work (Art. 300, Labor Code). A Medical Certificate from a licensed physician is mandatory upon return to work for illness-related absences. The Company reserves the right to require a fitness-to-work clearance before allowing the employee to resume duties. Non-submission of required documents within two (2) working days of return shall be treated as confirmed AWOL/abandonment.', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '3.5', text: 'Rule No. 3.5 Repeated absenteeism or habitual neglect of attendance policies.', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '3.6', text: 'Rule No. 3.6 Failure to report for agreed overtime, Sunday, or holiday duty without prior notice or valid reason.', category: '3', categoryLabel: 'Rule 3. Attendance and Punctuality' },
    { code: '4.1', text: 'Rule No. 4.1 Failure to adhere to approved territory management plans, client visit schedules, or field reporting requirements.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.2', text: 'Rule No. 4.2 Misrepresentation, off-label promotion, or false/misleading detailing of pharmaceutical products or services to clients, healthcare professionals, or regulatory bodies.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.3', text: 'Rule No. 4.3 Acceptance of gifts, kickbacks, incentives, or bribes from clients, suppliers, or healthcare professionals, in violation of FDA ethical promotion guidelines and the Anti-Graft laws.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.4', text: 'Rule No. 4.4 Failure to follow product handling, storage, cold chain, or distribution procedures in compliance with FDA/GDP/GMP/GxP regulations.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.5', text: 'Rule No. 4.5 Failure to promptly report product incidents, damages, spills, cold chain deviations, or safety hazards during field operations or in the warehouse.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.6', text: 'Rule No. 4.6 Unauthorized inventory handling, product transfers, sample distribution, or consignment transactions without proper documentation.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.7', text: 'Rule No. 4.7 Failure to secure and properly document Product Recall activities, Adverse Event (AE) reports, or Product Quality Complaints as required by FDA regulations.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.8', text: 'Rule No. 4.8 Falsification of call reports, field activity records, GPS data, or client signature logs.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '4.9', text: 'Rule No. 4.9 Unauthorized access to or tampering with pharmaceutical samples, controlled substances, or regulated products.', category: '4', categoryLabel: 'Rule 4. Field Force and Pharmaceutical Operations Compliance' },
    { code: '5.1', text: 'Rule No. 5.1 Delaying or willfully disobeying lawful instructions from a superior.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.2', text: 'Rule No. 5.2 Neglect of duty or failure to follow established procedures, rules, or work instructions including SOP compliance.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.3', text: 'Rule No. 5.3 Engaging in non-work-related activities during working hours (e.g., personal calls, social media, online gaming).', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.4', text: 'Rule No. 5.4 Sleeping or dozing off during work hours or in work areas.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.5', text: 'Rule No. 5.5 Gross and habitual neglect of duties, or accumulation of three (3) or more suspensions within a calendar year (Art. 297, Labor Code).', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.6', text: 'Rule No. 5.6 Failure to safeguard Company property, equipment, pharmaceutical products, or confidential information.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.7', text: 'Rule No. 5.7 Failure to report damages, safety hazards, or operational issues within twenty-four (24) hours of discovery.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.8', text: 'Rule No. 5.8 Managerial failure to enforce SOPs or regulatory protocols (FDA, PDEA, DOH), resulting in regulatory non-compliance or reputational risk to the Company.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '5.9', text: 'Rule No. 5.9 Failure to meet the performance targets, milestones, or behavioral improvements set under a formally issued and duly acknowledged Performance Improvement Plan (PIP), after the PIP period has lapsed and all coaching, mentoring, and support have been duly provided and documented. This infraction constitutes Gross and Habitual Neglect of Duties under Article 297(b) of the Labor Code of the Philippines. The following conditions must be satisfied prior to invoking this infraction: (a) A formal PIP was issued in writing and duly acknowledged by the employee; (b) Clear, measurable, and reasonable performance targets were set and communicated; (c) The PIP period was completed in full; (d) HR and the Immediate Superior have documented that adequate coaching, feedback, and support were provided throughout the PIP period; (e) A formal PIP evaluation was conducted and results documented showing failure to meet set targets.', category: '5', categoryLabel: 'Rule 5. Job Performance and Work Ethics' },
    { code: '6.1', text: 'Rule No. 6.1 Failure to wear proper uniform, Personal Protective Equipment (PPE), or maintain acceptable grooming and hygiene standards as required by GMP/GDP guidelines.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.2', text: 'Rule No. 6.2 Unprofessional behavior: shouting, cursing, harassment, bullying, intimidation, or disrespect toward employees, clients, or HCPs, in violation of the Safe Spaces Act (RA 11313).', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.3', text: 'Rule No. 6.3 Fighting, threatening, intimidating, or provoking employees, visitors, clients, or HCPs.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.4', text: 'Rule No. 6.4 Misconduct leading to public disturbance or scandal inside or outside the Company while on duty.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.5', text: 'Rule No. 6.5 Sexual harassment as defined under Republic Act No. 7877 and RA 11313 (Safe Spaces Act).', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.6', text: 'Rule No. 6.6 Use, possession, distribution, or being under the influence of dangerous drugs or controlled substances in the workplace, in violation of RA 9165 (Comprehensive Dangerous Drugs Act).', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.7', text: 'Rule No. 6.7 Reporting to work under the influence of intoxicating liquor or consuming alcohol within Company premises or during official duties, including field operations.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.8', text: 'Rule No. 6.8 Gambling or engaging in games of chance within Company premises or during working hours.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '6.9', text: 'Rule No. 6.9 Unauthorized possession or carrying of deadly weapons within Company premises.', category: '6', categoryLabel: 'Rule 6. Personal Conduct and Integrity' },
    { code: '7.1', text: 'Rule No. 7.1 Falsification, misrepresentation, or withholding of critical information in employment records, reports, regulatory submissions, or business documents.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.2', text: 'Rule No. 7.2 Fraud, bribery, or unethical transactions involving clients, suppliers, HCPs, or government regulators (FDA, DOH, PDEA).', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.3', text: 'Rule No. 7.3 Theft, misuse, or unauthorized taking of Company property, products, funds, or confidential information.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.4', text: 'Rule No. 7.4 Creating, using, or submitting false documents, signatures, receipts, contracts, batch records, or regulatory statements.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.5', text: 'Rule No. 7.5 Collusion with clients or suppliers, manipulation of stock records, pricing, rebates, or tender documents.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.6', text: 'Rule No. 7.6 Failure to report client concerns, account discrepancies, product quality issues, adverse events, or unresolved compliance cases.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.7', text: 'Rule No. 7.7 Gross and habitual neglect of duties, including accumulation of three (3) or more suspensions in a calendar year.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.8', text: 'Rule No. 7.8 Failure of the Immediate Superior to enforce and validate compliance with SOPs in relation to governing regulations (FDA, PDEA, DOH), resulting in a grave offense and reputational risk to the Company, constituting a gross managerial lapse and breach of regulatory compliance protocols.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.9', text: 'Rule No. 7.9 Unauthorized diversion, re-labeling, or adulteration of pharmaceutical products, whether for personal gain or otherwise.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '7.10', text: 'Rule No. 7.10 Disclosure of clinical trial data, drug formulas, proprietary product information, or trade secrets to unauthorized parties.', category: '7', categoryLabel: 'Rule 7. Integrity, Fraud, and Dishonesty' },
    { code: '8.1', text: 'Rule No. 8.1 Simple negligence: failure to exercise the care and diligence expected of a prudent employee in the performance of assigned duties, resulting in minor loss, damage, or inconvenience to the Company or clients.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.2', text: 'Rule No. 8.2 Gross negligence: failure to exercise even slight care and diligence in the performance of duties, resulting in significant loss, damage, or harm to the Company, clients, or third parties.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.3', text: 'Rule No. 8.3 Negligent handling, storage, or distribution of pharmaceutical products resulting in product damage, spoilage, or compromise of product integrity (e.g., cold chain failure due to carelessness).', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.4', text: 'Rule No. 8.4 Negligent or improper endorsement of accounts, tasks, or responsibilities during turnover, resulting in operational disruption or financial loss.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.5', text: 'Rule No. 8.5 Failure to exercise due care when operating Company vehicles, equipment, or machinery, resulting in damage or injury.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.6', text: 'Rule No. 8.6 Negligent preparation, submission, or review of regulatory documents (e.g., FDA reports, batch records, PDEA reports) resulting in compliance risk.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '8.7', text: 'Rule No. 8.7 Habitual neglect of duties as demonstrated by a pattern of negligent acts, poor output quality, or repeated failure to meet work standards.', category: '8', categoryLabel: 'Rule 8. Negligence of Duty' },
    { code: '9.1', text: 'Rule No. 9.1 Embezzlement or misappropriation of Company funds, assets, collections, or receivables, regardless of amount.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.2', text: 'Rule No. 9.2 Fraudulent liquidation of expenses: submission of falsified receipts, inflated claims, fictitious expenses, or unauthorized disbursements.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.3', text: 'Rule No. 9.3 Diversion of Company funds, client payments, or collections for personal use, even on a temporary basis.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.4', text: 'Rule No. 9.4 Manipulation or falsification of financial records, accounting entries, petty cash, or expense reports.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.5', text: 'Rule No. 9.5 Unauthorized collection of payments from clients, customers, or third parties without proper issuance of official receipts or without remittance to the Company.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.6', text: 'Rule No. 9.6 Fraudulent claims for reimbursements, allowances, incentives, commissions, or bonuses through misrepresentation of field activities or sales data.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.7', text: 'Rule No. 9.7 Conspiracy or collusion with other employees, clients, or third parties to defraud the Company through manipulated transactions, kickbacks, or ghost deliveries.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.8', text: 'Rule No. 9.8 Fraudulent procurement: rigging of bids, overpricing of purchased goods/services, or undisclosed commissions from suppliers.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '9.9', text: 'Rule No. 9.9 Concealment of discovered errors in financial transactions that benefit the employee or a third party at the expense of the Company.', category: '9', categoryLabel: 'Rule 9. Fraud and Embezzlement' },
    { code: '10.1', text: 'Rule No. 10.1 Failure to file Overtime (OT) authorization or request PRIOR to rendering overtime, in accordance with Company policy. (Note: OT rendered without prior approval may not be compensated, subject to applicable labor law provisions.)', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.2', text: 'Rule No. 10.2 Late filing of Leave Request: filing a leave application after the prescribed lead time without valid reason or prior verbal notice to the immediate superior.', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.3', text: 'Rule No. 10.3 Failure to file any required HR form, administrative document, or compliance report (e.g., trip tickets, purchase requests, incident reports) within the prescribed deadline.', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.4', text: 'Rule No. 10.4 Filing of leave, OT, or other HR requests under another employee\'s name or credentials, or misrepresentation of actual work activities in administrative records.', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.5', text: 'Rule No. 10.5 Habitual late or non-filing of required administrative reports or HR documents, resulting in payroll, operational, or regulatory disruption.', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.6', text: 'Rule No. 10.6 Failure to apply for leave prior to absence (filing retroactively without approval), which shall be treated as AWOL unless expressly approved by the Immediate Superior and HR. For illness-related absences exceeding two (2) consecutive days, a Medical Certificate from a licensed physician must be submitted upon return; non-submission within two (2) working days of return shall confirm the absence as AWOL.', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: '10.7', text: 'Rule No. 10.7 Abuse of the leave privilege: filing for leave with false or exaggerated pretexts, or engaging in unauthorized activities while on approved leave (e.g., working for another employer while on sick leave).', category: '10', categoryLabel: 'Rule 10. Administrative and HR Compliance (Late Filing of OT, Leave, and Other Requests)' },
    { code: 'OTHER', text: 'Other (type the rule manually)', category: 'OTHER', categoryLabel: 'Other' },
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
