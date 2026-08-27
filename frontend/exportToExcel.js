import * as XLSX from 'xlsx';

// Shared export helper used by Employees, Interns, and Recruitment.
// Takes the CURRENTLY FILTERED rows a page already has in state (not a
// fresh fetch) so the exported file always matches exactly what's on
// screen -- same search term, same status/department/recruiter filters,
// same everything -- with no separate "what counts as filtered" logic
// to keep in sync with the table itself.
//
// columns: [{ header: 'Employee ID', key: 'emp_id', format?: (row) => value }]
// format() lets a column combine multiple fields (e.g. first + last name)
// or reformat a raw value (e.g. a date) for the spreadsheet, without
// needing the row data itself reshaped first.
export function exportRowsToExcel(rows, columns, { fileName, sheetName = 'Sheet1' }) {
    const headerRow = columns.map(c => c.header);
    const dataRows = rows.map(row =>
        columns.map(c => (c.format ? c.format(row) : (row[c.key] ?? '')))
    );

    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    // Rough auto-width per column so the file doesn't open with every
    // column crushed to its header's width -- based on the longest
    // value in that column (header included), capped so one very long
    // remark/address doesn't blow a column out to an unusable width.
    worksheet['!cols'] = columns.map((c, i) => {
        const longest = Math.max(
            String(c.header).length,
            ...dataRows.map(r => String(r[i] ?? '').length)
        );
        return { wch: Math.min(Math.max(longest + 2, 10), 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
}

// Timestamp suffix for filenames, e.g. "employees_2026-08-27". Local
// date, not UTC -- see the same reasoning as formatLocalDate in
// dashboardController.js: toISOString() would silently roll the date
// back a day in timezones ahead of UTC.
export function todayStamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
