import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// GET all employees
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single employee
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new employee
router.post('/', async (req, res) => {
    try {
        const { emp_id, first_name, last_name, email, phone, department, position, employment_status, hire_date, salary } = req.body;

        const { data, error } = await supabase
            .from('employees')
            .insert([{ emp_id, first_name, last_name, email, phone, department, position, employment_status, hire_date, salary }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update employee
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE employee
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;