import { supabaseAdmin } from '../lib/supabase.js';

export const getAllEmployees = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getEmployeeById = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const createEmployee = async (req, res) => {
    try {
        const { emp_id, first_name, last_name, email, phone, department, position, employment_status, hire_date, salary } = req.body;

        const { data, error } = await supabaseAdmin
            .from('employees')
            .insert([{ emp_id, first_name, last_name, email, phone, department, position, employment_status, hire_date, salary }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateEmployee = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('employees')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteEmployee = async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('employees')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};