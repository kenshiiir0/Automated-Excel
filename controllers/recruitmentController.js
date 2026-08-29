import { supabaseAdmin } from '../lib/supabase.js';
import { logCreate, logUpdate, logArchive, logRestore } from '../lib/auditLog.js';

function candidateLabel(c) {
    if (!c) return null;
    return c.candidate_name || null;
}

const getAllCandidates = async (req, res) => {
    try {
        const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

        let query = supabaseAdmin
            .from('recruitment_candidates')
            .select('*')
            .order('created_at', { ascending: false });

        query = includeArchived ? query.eq('is_archived', true) : query.eq('is_archived', false);

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/recruitmentController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const createCandidate = async (req, res) => {
    try {
        const { candidate_name, position, department, status, email, phone, previous_company, resume_url } = req.body;

        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .insert([{ candidate_name, position, department, status, email, phone, previous_company, resume_url }])
            .select();

        if (error) throw error;
        const created = data[0];
        await logCreate({ entityType: 'candidate', entityId: created.id, entityLabel: candidateLabel(created), req });
        res.status(201).json(created);
    } catch (err) {
        console.error('controllers/recruitmentController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const updateCandidate = async (req, res) => {
    try {
        const { data: before, error: findErr } = await supabaseAdmin
            .from('recruitment_candidates')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!before) return res.status(404).json({ error: 'Candidate not found.' });

        const { data, error } = await supabaseAdmin
            .from('recruitment_candidates')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        const updated = data[0];
        await logUpdate({ entityType: 'candidate', entityId: updated.id, entityLabel: candidateLabel(updated), before, after: req.body, req });
        res.json(updated);
    } catch (err) {
        console.error('controllers/recruitmentController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// "Delete" in the UI archives the candidate record instead of removing
// the row -- nothing in this system is ever hard-deleted.
const deleteCandidate = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('recruitment_candidates')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Candidate not found.' });
        if (existing.is_archived) return res.status(400).json({ error: 'This candidate is already archived.' });

        const { error } = await supabaseAdmin
            .from('recruitment_candidates')
            .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: req.user?.id || null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logArchive({ entityType: 'candidate', entityId: Number(req.params.id), entityLabel: candidateLabel(existing), req });
        res.json({ message: 'Candidate archived' });
    } catch (err) {
        console.error('controllers/recruitmentController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const restoreCandidate = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('recruitment_candidates')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Candidate not found.' });
        if (!existing.is_archived) return res.status(400).json({ error: 'This candidate is not archived.' });

        const { error } = await supabaseAdmin
            .from('recruitment_candidates')
            .update({ is_archived: false, archived_at: null, archived_by: null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logRestore({ entityType: 'candidate', entityId: Number(req.params.id), entityLabel: candidateLabel(existing), req });
        res.json({ message: 'Candidate restored' });
    } catch (err) {
        console.error('controllers/recruitmentController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

export { getAllCandidates, createCandidate, updateCandidate, deleteCandidate, restoreCandidate };
