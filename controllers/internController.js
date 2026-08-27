import { supabaseAdmin } from '../lib/supabase.js';

const getAllInterns = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('interns')
            .select('*')
            .order('seq_no', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getInternById = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('interns')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createIntern = async (req, res) => {
    try {
        const { last_name, first_name, middle_name, middle_initial, complete_name,
                hire_date, birthday, address, contact_no, email, school, department } = req.body;

        const { data, error } = await supabaseAdmin
            .from('interns')
            .insert([{ last_name, first_name, middle_name, middle_initial, complete_name,
                       hire_date, birthday, address, contact_no, email, school, department }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateIntern = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('interns')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteIntern = async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('interns')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Intern record deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { getAllInterns, getInternById, createIntern, updateIntern, deleteIntern };
