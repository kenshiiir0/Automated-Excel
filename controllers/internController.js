import { supabaseAdmin } from '../lib/supabase.js';
import { logCreate, logUpdate, logArchive, logRestore } from '../lib/auditLog.js';

function internLabel(i) {
    if (!i) return null;
    return [i.last_name, i.first_name].filter(Boolean).join(', ') || i.complete_name || null;
}

const getAllInterns = async (req, res) => {
    try {
        const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

        let query = supabaseAdmin
            .from('interns')
            .select('*')
            .order('seq_no', { ascending: true });

        query = includeArchived ? query.eq('is_archived', true) : query.eq('is_archived', false);

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
        const created = data[0];
        await logCreate({ entityType: 'intern', entityId: created.id, entityLabel: internLabel(created), req });
        res.status(201).json(created);
    } catch (err) {
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const updateIntern = async (req, res) => {
    try {
        const { data: before, error: findErr } = await supabaseAdmin
            .from('interns')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!before) return res.status(404).json({ error: 'Intern record not found.' });

        const { data, error } = await supabaseAdmin
            .from('interns')
            .update(req.body)
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        const updated = data[0];
        await logUpdate({ entityType: 'intern', entityId: updated.id, entityLabel: internLabel(updated), before, after: req.body, req });
        res.json(updated);
    } catch (err) {
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// "Delete" in the UI archives the intern record instead of removing the
// row -- nothing in this system is ever hard-deleted.
const deleteIntern = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('interns')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Intern record not found.' });
        if (existing.is_archived) return res.status(400).json({ error: 'This intern record is already archived.' });

        const { error } = await supabaseAdmin
            .from('interns')
            .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: req.user?.id || null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logArchive({ entityType: 'intern', entityId: Number(req.params.id), entityLabel: internLabel(existing), req });
        res.json({ message: 'Intern record archived' });
    } catch (err) {
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const restoreIntern = async (req, res) => {
    try {
        const { data: existing, error: findErr } = await supabaseAdmin
            .from('interns')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) return res.status(404).json({ error: 'Intern record not found.' });
        if (!existing.is_archived) return res.status(400).json({ error: 'This intern record is not archived.' });

        const { error } = await supabaseAdmin
            .from('interns')
            .update({ is_archived: false, archived_at: null, archived_by: null })
            .eq('id', req.params.id);

        if (error) throw error;
        await logRestore({ entityType: 'intern', entityId: Number(req.params.id), entityLabel: internLabel(existing), req });
        res.json({ message: 'Intern record restored' });
    } catch (err) {
        console.error('controllers/internController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

export { getAllInterns, getInternById, createIntern, updateIntern, deleteIntern, restoreIntern };
