import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// GET dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        // Total employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id', { count: 'exact' });

        // Total active candidates
        const { data: candidates, error: candError } = await supabase
            .from('recruitment_candidates')
            .select('id', { count: 'exact' })
            .eq('status', 'Active');

        // On leave today
        const today = new Date().toISOString().split('T')[0];
        const { data: onLeave, error: leaveError } = await supabase
            .from('leave_records')
            .select('id', { count: 'exact' })
            .eq('status', 'Approved')
            .gte('start_date', today)
            .lte('end_date', today);

        if (empError || candError || leaveError) throw empError || candError || leaveError;

        res.json({
            totalEmployees: employees?.length || 0,
            activeCandidates: candidates?.length || 0,
            onLeaveToday: onLeave?.length || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;