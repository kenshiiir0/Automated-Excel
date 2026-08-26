import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// GET all leave records
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leave_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET leaves by employee
router.get('/emp/:emp_id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leave_records')
            .select('*')
            .eq('emp_id', req.params.emp_id);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new leave record
router.post('/', async (req, res) => {
    try {
        const { emp_id, leave_type, start_date, end_date, days_count, status } = req.body;

        const { data, error } = await supabase
            .from('leave_records')
            .insert([{ emp_id, leave_type, start_date, end_date, days_count, status }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update leave
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leave_records')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;