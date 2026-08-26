import { supabaseAdmin } from '../lib/supabase.js';

export const getAllCandidates = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const createCandidate = async (req, res) => {
    try {
        const { candidate_name, position, department, status, email, phone, previous_company, resume_url } = req.body;

        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .insert([{ candidate_name, position, department, status, email, phone, previous_company, resume_url }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateCandidate = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteCandidate = async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('recruitment_candidates')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Candidate deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};