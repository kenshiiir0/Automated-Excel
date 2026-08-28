import { supabaseAdmin } from '../lib/supabase.js';

// 1. getDashboardStats
export const getDashboardStats = async (req, res) => {
  try {
    const { data: employees, error } = await supabaseAdmin
      .from('employees')
      .select('employment_status, employment_classification, hire_date, exit_date, separation_reason')
      .eq('is_archived', false);
    if (error) throw error;

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    const active = employees.filter(e => e.employment_status === 'Active');
    const inactive = employees.filter(e => e.employment_status === 'Inactive');

    const totalEmployees = active.length;
    const regularCount = active.filter(e => e.employment_classification === 'Regular').length;
    const probationaryCount = active.filter(e => e.employment_classification === 'Probationary').length;

    const hiresYTD = employees.filter(e => e.hire_date && e.hire_date >= yearStart).length;
    const separationsYTD = inactive.filter(e => e.exit_date && e.exit_date >= yearStart).length;

    const attritionRate = totalEmployees > 0
      ? parseFloat(((separationsYTD / totalEmployees) * 100).toFixed(1))
      : 0;

    const reasonCounts = {};
    inactive.forEach(e => {
      const r = e.separation_reason || 'Unknown';
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });
    const totalSeparations = inactive.length;
    let topExitReason = 'N/A';
    let topExitCount = 0;
    for (const [reason, count] of Object.entries(reasonCounts)) {
      if (count > topExitCount) {
        topExitReason = reason;
        topExitCount = count;
      }
    }

    const { data: candidates, error: candError } = await supabaseAdmin
      .from('recruitment_candidates')
      .select('status, source_sheet')
      .eq('is_archived', false);
    if (candError) throw candError;

    // Total interns currently on file. Interns have no employment_status
    // field (unlike employees) -- the Interns page itself just shows a
    // flat count of every row, so this matches that directly with no
    // active/inactive distinction to make.
    const { count: internCount, error: internError } = await supabaseAdmin
      .from('interns')
      .select('id', { count: 'exact', head: true })
      .eq('is_archived', false);
    if (internError) throw internError;

    // Counts every candidate regardless of source_sheet, so this always
    // matches the total shown on the Recruitment page itself (which also
    // shows every candidate, from both the master "RECRUITMENT UPDATE"
    // sheet and the per-recruiter "ACCOUNT PER RECRUITER" sheet). This
    // used to filter down to "RECRUITMENT UPDATE" only, to match the
    // original Excel dashboard's definition -- but that made this number
    // silently smaller than the Recruitment page's own total with no
    // indication why, which read as the two screens not tallying.
    const ongoingRequisitions = candidates.filter(c => c.status === 'Ongoing').length;
    const openRequisitions = candidates.filter(c => c.status === 'Open' || c.status === 'Ongoing').length;

    res.json({
      totalEmployees,
      regularCount,
      probationaryCount,
      hiresYTD,
      separationsYTD,
      attritionRate,
      openRequisitions,
      ongoingRequisitions,
      topExitReason,
      topExitCount,
      totalSeparations,
      internCount: internCount || 0
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: err.message });
  }
};

// Existing: getDepartmentDistribution
export const getDepartmentDistribution = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('department')
            .eq('is_archived', false)
            .not('department', 'is', null);

        if (error) throw error;

        const grouped = {};
        data.forEach(emp => {
            const dept = emp.department || 'Unassigned';
            grouped[dept] = (grouped[dept] || 0) + 1;
        });

        const result = Object.entries(grouped).map(([department, count]) => ({
            department,
            count
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching department distribution:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getEmploymentStatusDistribution
export const getEmploymentStatusDistribution = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('employment_status')
            .eq('is_archived', false)
            .not('employment_status', 'is', null);

        if (error) throw error;

        const grouped = {};
        data.forEach(emp => {
            const status = emp.employment_status || 'Unknown';
            grouped[status] = (grouped[status] || 0) + 1;
        });

        const result = Object.entries(grouped).map(([status, count]) => ({
            status,
            count
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching employment status:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getCandidatePipeline
export const getCandidatePipeline = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .select('status')
            .eq('is_archived', false)
            .not('status', 'is', null);

        if (error) throw error;

        const grouped = {};
        data.forEach(candidate => {
            const status = candidate.status || 'Unknown';
            grouped[status] = (grouped[status] || 0) + 1;
        });

        const result = Object.entries(grouped).map(([status, count]) => ({
            status,
            count
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching candidate pipeline:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getEmailProviderDistribution
export const getEmailProviderDistribution = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_directory')
            .select('mail_provider')
            .not('mail_provider', 'is', null);

        if (error) throw error;

        const grouped = {};
        data.forEach(entry => {
            const provider = entry.mail_provider || 'Unknown';
            grouped[provider] = (grouped[provider] || 0) + 1;
        });

        const result = Object.entries(grouped).map(([mail_provider, count]) => ({
            mail_provider,
            count
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching email provider distribution:', err);
        res.status(500).json({ error: err.message });
    }
};

// UPDATED: getWorkAnniversaries
// Old version used a wrong definition ("hired in the current calendar month").
// This version matches Excel's own ANNIV. FLAG helper column logic: for each
// active employee, compute their NEXT hire-date anniversary relative to today
// (this year's month/day, or next year's if it has already passed this year),
// and flag anyone whose next anniversary falls within the next 30 days.
// This must be computed live (not imported as a static value) since "next
// anniversary" changes meaning every day.
// Formats a Date using its LOCAL year/month/day -- never use toISOString()
// here, since that converts to UTC first and silently rolls the date back
// by one day in any timezone ahead of UTC (e.g. Philippines, UTC+8).
function formatLocalDate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const getWorkAnniversaries = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('id, emp_id, first_name, last_name, department, position, hire_date')
            .eq('employment_status', 'Active')
            .eq('is_archived', false)
            .not('hire_date', 'is', null);

        if (error) throw error;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = data
            .map(emp => {
                const hireDate = new Date(emp.hire_date);
                const thisYear = today.getFullYear();

                let nextAnniversary = new Date(thisYear, hireDate.getMonth(), hireDate.getDate());
                if (nextAnniversary < today) {
                    nextAnniversary = new Date(thisYear + 1, hireDate.getMonth(), hireDate.getDate());
                }

                const yearsOfService = nextAnniversary.getFullYear() - hireDate.getFullYear();
                const daysRemaining = Math.round((nextAnniversary - today) / (1000 * 60 * 60 * 24));

                return {
                    ...emp,
                    next_anniversary: formatLocalDate(nextAnniversary),
                    years_of_service: yearsOfService,
                    days_remaining: daysRemaining
                };
            })
            .filter(emp => emp.days_remaining >= 0 && emp.days_remaining <= 30)
            .sort((a, b) => a.days_remaining - b.days_remaining);

        res.json(upcoming);
    } catch (err) {
        console.error('Error fetching anniversaries:', err);
        res.status(500).json({ error: err.message });
    }
};

// NEW: getUpForRegularization
// Active employees whose regularization_date (imported from Excel's own
// "REG. DATE (helper)" column, which is more reliable than the raw entered
// date) falls within the next 30 days.
export const getUpForRegularization = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('id, emp_id, first_name, last_name, department, position, hire_date, regularization_date')
            .eq('employment_status', 'Active')
            .eq('is_archived', false)
            .not('regularization_date', 'is', null);

        if (error) throw error;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueSoon = data
            .map(emp => {
                const regDate = new Date(emp.regularization_date);
                const daysRemaining = Math.round((regDate - today) / (1000 * 60 * 60 * 24));
                return { ...emp, days_remaining: daysRemaining };
            })
            .filter(emp => emp.days_remaining >= 0 && emp.days_remaining <= 30)
            .sort((a, b) => a.days_remaining - b.days_remaining);

        res.json(dueSoon);
    } catch (err) {
        console.error('Error fetching up-for-regularization:', err);
        res.status(500).json({ error: err.message });
    }
};

// NEW: getUpcomingActions
// Combined endpoint the frontend's "Actionable HR Trackers" section actually
// calls: /api/dashboard/upcoming-actions. Returns both trackers together in
// the exact shape and field names Dashboard.jsx expects (name, date_hired,
// upcoming_anniversary, etc.) -- getUpForRegularization and getWorkAnniversaries
// above are kept as standalone endpoints too, but this is the one that's wired up.
export const getUpcomingActions = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ---- Up for Regularization ----
        const { data: regData, error: regError } = await supabaseAdmin
            .from('employees')
            .select('id, emp_id, first_name, last_name, department, hire_date, regularization_date')
            .eq('employment_status', 'Active')
            .eq('is_archived', false)
            .not('regularization_date', 'is', null);
        if (regError) throw regError;

        const upForRegularization = regData
            .map(emp => {
                const regDate = new Date(emp.regularization_date);
                const daysRemaining = Math.round((regDate - today) / (1000 * 60 * 60 * 24));
                return {
                    name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                    department: emp.department,
                    date_hired: emp.hire_date,
                    regularization_date: emp.regularization_date,
                    days_remaining: daysRemaining
                };
            })
            .filter(emp => emp.days_remaining >= 0 && emp.days_remaining <= 30)
            .sort((a, b) => a.days_remaining - b.days_remaining);

        // ---- Upcoming Work Anniversaries ----
        const { data: annData, error: annError } = await supabaseAdmin
            .from('employees')
            .select('id, emp_id, first_name, last_name, department, hire_date')
            .eq('employment_status', 'Active')
            .eq('is_archived', false)
            .not('hire_date', 'is', null);
        if (annError) throw annError;

        const upcomingAnniversaries = annData
            .map(emp => {
                const hireDate = new Date(emp.hire_date);
                const thisYear = today.getFullYear();

                let nextAnniversary = new Date(thisYear, hireDate.getMonth(), hireDate.getDate());
                if (nextAnniversary < today) {
                    nextAnniversary = new Date(thisYear + 1, hireDate.getMonth(), hireDate.getDate());
                }

                const yearsOfService = nextAnniversary.getFullYear() - hireDate.getFullYear();
                const daysRemaining = Math.round((nextAnniversary - today) / (1000 * 60 * 60 * 24));

                return {
                    name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                    department: emp.department,
                    date_hired: emp.hire_date,
                    upcoming_anniversary: formatLocalDate(nextAnniversary),
                    years_of_service: yearsOfService,
                    days_remaining: daysRemaining
                };
            })
            .filter(emp => emp.days_remaining >= 0 && emp.days_remaining <= 30)
            .sort((a, b) => a.days_remaining - b.days_remaining);

        res.json({ upForRegularization, upcomingAnniversaries });
    } catch (err) {
        console.error('Error fetching upcoming-actions:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getHiringTrends
export const getHiringTrends = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('hire_date')
            .eq('is_archived', false)
            .not('hire_date', 'is', null);

        if (error) throw error;

        const monthlyData = {};
        data.forEach(emp => {
            const date = new Date(emp.hire_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        });

        const result = Object.entries(monthlyData)
            .sort()
            .slice(-12)
            .map(([month, count]) => ({
                month,
                count
            }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching hiring trends:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getAttritionRate
export const getAttritionRate = async (req, res) => {
    try {
        const { count: totalEmployees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id', { count: 'exact', head: true })
            .eq('is_archived', false);

        if (empError) throw empError;

        const { count: inactiveCount, error: inactiveError } = await supabaseAdmin
            .from('employees')
            .select('id', { count: 'exact', head: true })
            .eq('employment_status', 'Inactive')
            .eq('is_archived', false);

        if (inactiveError) throw inactiveError;

        const total = totalEmployees || 0;
        const inactive = inactiveCount || 0;
        const attritionRate = total > 0 ? ((inactive / total) * 100).toFixed(2) : 0;

        res.json({
            attritionRate: parseFloat(attritionRate),
            totalEmployees: total,
            inactiveEmployees: inactive
        });
    } catch (err) {
        console.error('Error calculating attrition rate:', err);
        res.status(500).json({ error: err.message });
    }
};

// Existing: getRecruitmentMetrics
export const getRecruitmentMetrics = async (req, res) => {
    try {
        const statuses = ['New', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected'];
        const metrics = {};

        for (const status of statuses) {
            const { count, error } = await supabaseAdmin
                .from('recruitment_candidates')
                .select('id', { count: 'exact', head: true })
                .eq('status', status)
                .eq('is_archived', false);

            if (!error) {
                metrics[status] = count || 0;
            }
        }

        res.json(metrics);
    } catch (err) {
        console.error('Error fetching recruitment metrics:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2. getGenderDistribution
export const getGenderDistribution = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('gender')
      .eq('employment_status', 'Active')
      .eq('is_archived', false)
      .not('gender', 'is', null);
    if (error) throw error;

    const grouped = {};
    data.forEach(e => {
      grouped[e.gender] = (grouped[e.gender] || 0) + 1;
    });
    const result = Object.entries(grouped).map(([gender, count]) => ({ gender, count }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching gender-distribution:', err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Six new functions added at the bottom:

export const getActiveByDept = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('department')
      .eq('employment_status', 'Active')
      .eq('is_archived', false)
      .not('department', 'is', null);
    if (error) throw error;

    const grouped = {};
    data.forEach(e => {
      grouped[e.department] = (grouped[e.department] || 0) + 1;
    });
    const result = Object.entries(grouped)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (err) {
    console.error('Error fetching active-by-dept:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getActiveStatus = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('employment_classification')
      .eq('employment_status', 'Active')
      .eq('is_archived', false)
      .not('employment_classification', 'is', null);
    if (error) throw error;

    const grouped = {};
    data.forEach(e => {
      grouped[e.employment_classification] = (grouped[e.employment_classification] || 0) + 1;
    });
    const result = Object.entries(grouped).map(([status, count]) => ({ status, count }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching active-status:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getMonthlyTrend = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('hire_date, exit_date')
      .eq('is_archived', false);
    if (error) throw error;

    const currentYear = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Always show the full Jan-Dec year, not just up through the current
    // month -- a month that hasn't happened yet simply has 0 hires/0
    // separations (there's nothing to filter into it), so this is safe
    // and gives a consistent full-year view all year round rather than
    // the chart's x-axis silently growing one bar at a time as the year
    // progresses.
    const result = [];
    for (let m = 0; m <= 11; m++) {
      const hires = data.filter(e => {
        if (!e.hire_date) return false;
        const d = new Date(e.hire_date);
        return d.getFullYear() === currentYear && d.getMonth() === m;
      }).length;
      const separations = data.filter(e => {
        if (!e.exit_date) return false;
        const d = new Date(e.exit_date);
        return d.getFullYear() === currentYear && d.getMonth() === m;
      }).length;
      result.push({ month: monthNames[m], hires, separations });
    }
    res.json(result);
  } catch (err) {
    console.error('Error fetching monthly-trend:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getSeparationReasons = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('separation_reason, exit_date')
      .eq('employment_status', 'Inactive')
      .eq('is_archived', false);
    if (error) throw error;

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const ytd = data.filter(e => e.exit_date && e.exit_date >= yearStart);

    const grouped = {};
    ytd.forEach(e => {
      const r = e.separation_reason || 'Unknown';
      grouped[r] = (grouped[r] || 0) + 1;
    });
    const result = Object.entries(grouped)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (err) {
    console.error('Error fetching separation-reasons:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getSeparationsByDept = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('department')
      .eq('employment_status', 'Inactive')
      .eq('is_archived', false)
      .not('department', 'is', null);
    if (error) throw error;

    const grouped = {};
    data.forEach(e => {
      grouped[e.department] = (grouped[e.department] || 0) + 1;
    });
    const result = Object.entries(grouped)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (err) {
    console.error('Error fetching separations-by-dept:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getRecruitmentPipeline = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('recruitment_candidates')
      .select('status, source_sheet')
      .eq('is_archived', false)
      .not('status', 'is', null);
    if (error) throw error;

    // Counts every candidate regardless of source_sheet -- see the note
    // in getDashboardStats above for why this no longer filters down to
    // the master "RECRUITMENT UPDATE" sheet only.
    const grouped = {};
    data.forEach(c => {
      const s = c.status || 'Unknown';
      grouped[s] = (grouped[s] || 0) + 1;
    });
    const result = Object.entries(grouped).map(([status, count]) => ({ status, count }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching recruitment-pipeline:', err);
    res.status(500).json({ error: err.message });
  }
};
