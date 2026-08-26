import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// GET all candidates
router.get('/candidates', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recruitment_candidates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new candidate
router.post('/candidates', async (req, res) => {
    try {
        const { candidate_name, position, department, status, email, phone, previous_company, resume_url } = req.body;

        const { data, error } = await supabase
            .from('recruitment_candidates')
            .insert([{ candidate_name, position, department, status, email, phone, previous_company, resume_url }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update candidate
router.put('/candidates/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recruitment_candidates')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE candidate
router.delete('/candidates/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('recruitment_candidates')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Candidate deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;