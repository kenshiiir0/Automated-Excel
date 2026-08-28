import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas for sensitive POST/PUT routes: auth (login, self-signup) and
// HR record writes (employees, interns, recruitment candidates, user
// accounts). Each schema uses z.object()'s default "strip unknown keys"
// behavior -- matches how the controllers already whitelist fields, so an
// unexpected field is silently dropped rather than rejected outright.
//
// These validate SHAPE and TYPE (required fields present, strings not
// absurdly long, emails look like emails, dates parse). They do not replace
// the controllers' own business-logic checks (duplicate email, self-role-
// change guard, etc.) -- those stay where they are.
// ---------------------------------------------------------------------------

const nonEmptyString = (max = 255) => z.string().trim().min(1).max(max);
const optionalString = (max = 255) => z.string().trim().max(max).optional().nullable();
const optionalDate = () => z.string().trim().max(40).optional().nullable(); // yyyy-mm-dd or ISO, or null to clear
const optionalEmail = () => z.string().trim().email().max(255).optional().nullable().or(z.literal('').transform(() => null));

// ── Auth ─────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    username: nonEmptyString(255),
    password: z.string().min(1).max(200),
});

export const requestOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    fullName: nonEmptyString(200),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

export const verifyOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    code: z.string().trim().length(6, 'Code must be 6 digits.'),
});

// ── Employees ────────────────────────────────────────────────────────────
// Mirrors EMPLOYEE_WRITABLE_FIELDS in controllers/employeeController.js.
// Create requires the same 3 fields the controller already requires
// (emp_id/first_name/last_name); update makes everything optional since a
// PUT here is a partial update (only fields actually sent get applied).

const employeeFieldsPartial = {
    emp_id: optionalString(50),
    first_name: optionalString(100),
    last_name: optionalString(100),
    middle_name: optionalString(100),
    email: optionalEmail(),
    personal_email: optionalEmail(),
    zoho_email: optionalEmail(),
    phone: optionalString(30),
    date_of_birth: optionalDate(),
    gender: optionalString(30),
    marital_status: optionalString(30),
    citizenship: optionalString(50),
    complete_address: optionalString(500),
    department: optionalString(150),
    position: optionalString(150),
    new_designation: optionalString(150),
    position_category: optionalString(100),
    employment_status: optionalString(50),
    employment_classification: optionalString(50),
    employment_contract_status: optionalString(50),
    work_arrangement: optionalString(50),
    territory: optionalString(100),
    reporting_to: optionalString(150),
    hire_date: optionalDate(),
    regularization_date: optionalDate(),
    exit_date: optionalDate(),
    separation_reason: optionalString(200),
    job_description: optionalString(2000),
    company_rules: optionalString(2000),
    salary: z.union([z.number(), z.string()]).optional().nullable(),
    bank_name: optionalString(150),
    bank_account: optionalString(100),
    sss_number: optionalString(50),
    philhealth_number: optionalString(50),
    hdmf_number: optionalString(50),
    tin_number: optionalString(50),
    company_issued_no: optionalString(100),
    issued_equipment: optionalString(500),
    emergency_contact_person: optionalString(150),
    relationship: optionalString(100),
    emergency_contact_details: optionalString(300),
};

export const createEmployeeSchema = z.object({
    ...employeeFieldsPartial,
    emp_id: nonEmptyString(50),
    first_name: nonEmptyString(100),
    last_name: nonEmptyString(100),
});

export const updateEmployeeSchema = z.object(employeeFieldsPartial).partial();

// ── Interns ──────────────────────────────────────────────────────────────

const internFieldsPartial = {
    last_name: optionalString(100),
    first_name: optionalString(100),
    middle_name: optionalString(100),
    middle_initial: optionalString(10),
    complete_name: optionalString(250),
    hire_date: optionalDate(),
    birthday: optionalDate(),
    address: optionalString(500),
    contact_no: optionalString(30),
    email: optionalEmail(),
    school: optionalString(200),
    department: optionalString(150),
};

export const createInternSchema = z.object({
    ...internFieldsPartial,
    last_name: nonEmptyString(100),
    first_name: nonEmptyString(100),
});

export const updateInternSchema = z.object(internFieldsPartial).partial();

// ── Recruitment candidates ──────────────────────────────────────────────

const candidateFieldsPartial = {
    candidate_name: optionalString(200),
    position: optionalString(150),
    department: optionalString(150),
    status: optionalString(50),
    email: optionalEmail(),
    phone: optionalString(30),
    recruiter: optionalString(150),
    previous_company: optionalString(200),
    resume_url: optionalString(1000),
    remarks: optionalString(2000),
};

export const createCandidateSchema = z.object({
    ...candidateFieldsPartial,
    candidate_name: nonEmptyString(200),
    position: nonEmptyString(150),
});

export const updateCandidateSchema = z.object(candidateFieldsPartial).partial();

// ── User accounts ────────────────────────────────────────────────────────

const VALID_ROLES = ['super_admin', 'admin', 'user'];

export const createUserSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    fullName: nonEmptyString(200),
    role: z.enum(VALID_ROLES).optional(),
});

export const updateUserSchema = z.object({
    role: z.enum(VALID_ROLES).optional(),
    is_active: z.boolean().optional(),
}).refine(data => data.role !== undefined || data.is_active !== undefined, {
    message: 'Nothing to update.',
});

export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric.'),
});
