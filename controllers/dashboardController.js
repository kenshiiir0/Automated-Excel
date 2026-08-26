const { supabaseAdmin } = require('../lib/supabase.js');

const getDashboardStats = async (req, res) => {
    try {
        const employeeCount = await supabaseAdmin.from('employees').select('*', { count: 'exact', head: true });
        const activeCandidates = await supabaseAdmin.from('recruitment_candidates').select('*', { count: 'exact', head: true }).eq('status', 'Active');
        const onLeaveToday = await supabaseAdmin.from('leave_records').select('*', { count: 'exact', head: true }).eq('status', 'Approved');

        res.json({
            totalEmployees: employeeCount.count || 0,
            activeCandidates: activeCandidates.count || 0,
            onLeaveToday: onLeaveToday.count || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getDashboardStats };