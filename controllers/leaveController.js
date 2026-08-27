import { supabaseAdmin } from '../lib/supabase.js';

const getAllLeaves = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
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
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateLeave = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leave_records')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { getAllLeaves, getLeavesByEmployee, createLeave, updateLeave };