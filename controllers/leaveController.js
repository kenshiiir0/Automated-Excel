import { supabaseAdmin } from '../lib/supabase.js';
import { logCreate, logUpdate } from '../lib/auditLog.js';

const getAllLeaves = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/leaveController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const getLeavesByEmployee = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .select('*')
            .eq('emp_id', req.params.emp_id);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/leaveController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const createLeave = async (req, res) => {
    try {
        const { emp_id, leave_type, start_date, end_date, days_count, status } = req.body;

        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .insert([{ emp_id, leave_type, start_date, end_date, days_count, status }])
            .select();

        if (error) throw error;

        // Audit trail: a leave record being filed/created previously left
        // no trace in History at all.
        await logCreate({
            entityType: 'leave_request',
            entityId: data[0].id,
            entityLabel: `${emp_id} -- ${leave_type || 'Leave'}`,
            req,
        });

        res.status(201).json(data[0]);
    } catch (err) {
        console.error('controllers/leaveController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

const updateLeave = async (req, res) => {
    try {
        // Fetch the pre-update row so logUpdate can diff old vs new values
        // (mirrors the same before/after pattern already used in
        // employeeController.js/internController.js/etc.) -- without this,
        // there's nothing to compare against and no way to log what
        // actually changed on a leave status update (e.g. pending -> approved).
        const { data: before, error: beforeError } = await supabaseAdmin
            .from('leave_records')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (beforeError) throw beforeError;

        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;

        // Audit trail: approving/denying/editing a leave record previously
        // left no trace in History at all.
        await logUpdate({
            entityType: 'leave_request',
            entityId: req.params.id,
            entityLabel: before ? `${before.emp_id} -- ${before.leave_type || 'Leave'}` : String(req.params.id),
            before,
            after: req.body,
            req,
        });

        res.json(data[0]);
    } catch (err) {
        console.error('controllers/leaveController.js error:', err);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
};

export { getAllLeaves, getLeavesByEmployee, createLeave, updateLeave };