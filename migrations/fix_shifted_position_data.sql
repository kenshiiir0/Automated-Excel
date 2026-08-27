-- Fix column-shifted data for 8 employee records where department, position,
-- position_category, and employment_classification were pulled from the wrong
-- Excel columns during import.
--
-- Root cause: the "Resigned/Inactive" sheet in the source Excel
-- (Dashboard_ProjectSir_Mike.xlsx) has a SECOND header row partway through
-- (row 194) that inserts two extra columns -- DATE and TENURE -- not present
-- in the first header (row 2). The import treated the whole sheet with one
-- fixed column mapping, so every row below that second header shifted two
-- columns to the right: what got stored as 'position' was actually the
-- TENURE column (e.g. '0 years , 3 months'), and 'department' was actually
-- a DATE/timestamp column.
--
-- For GPI-0088 and 2MG-095 specifically, the sheet also had an EARLIER,
-- correctly-formatted row for the same person (from before they were marked
-- separated) that got dropped in favor of the corrupted duplicate during
-- import -- hire_date is corrected here too since that earlier row is where
-- the real hire_date came from.
--
-- Values below were looked up directly against the correct columns in the
-- original Excel source file, row by row.
-- Safe to re-run.

UPDATE employees SET department = 'Prescrition Business', position = 'Product Specialist', position_category = 'Rank and File', employment_classification = 'Probationary', hire_date = '2026-01-05' WHERE emp_id = 'GPI - 0088';
UPDATE employees SET department = 'Prescrition Business', position = 'Sales Admin Coordinator', position_category = 'Rank and File', employment_classification = 'Regular', hire_date = '2024-08-01' WHERE emp_id = '2MG - 095';
UPDATE employees SET department = 'Sales - Field', position = 'Medical Sales Associate', new_designation = 'Customer Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Probationary' WHERE emp_id = '2MG - 205';
UPDATE employees SET department = 'Operations - Pharmacy', position = 'Pharmacy Support Associate', new_designation = 'Employee Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Probationary' WHERE emp_id = '2MG - 208';
UPDATE employees SET department = 'Human Resource', position = 'Housekeeper', new_designation = 'Employee Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Probationary' WHERE emp_id = '2MG - 206';
UPDATE employees SET department = 'B2C Telesales', position = 'B2C Telemarketer', new_designation = 'Customer Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Probationary' WHERE emp_id = '2MG - 194';
UPDATE employees SET department = 'Human Resource', position = 'Housekeeper', new_designation = 'Employee Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Probationary' WHERE emp_id = '2MG - 203';
UPDATE employees SET department = 'Aneathesia Telesales', position = 'Telemarketer', new_designation = 'Customer Happiness Coachee', position_category = 'Rank and File', employment_classification = 'Part-Timer' WHERE emp_id = 'GPI - 012P';

-- Verify:
-- SELECT emp_id, first_name, last_name, department, position, position_category, employment_classification, new_designation, hire_date FROM employees WHERE emp_id IN ('GPI - 0088', '2MG - 095', '2MG - 205', '2MG - 208', '2MG - 206', '2MG - 194', '2MG - 203', 'GPI - 012P') ORDER BY emp_id;
