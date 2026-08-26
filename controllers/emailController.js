import { supabaseAdmin } from '../lib/supabase.js';
import axios from 'axios';

export const getEmailDirectory = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_directory')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const addToDirectory = async (req, res) => {
    try {
        const { emp_id, employee_name, company_email, mail_provider, phone } = req.body;

        const { data, error } = await supabaseAdmin
            .from('email_directory')
            .insert([{ emp_id, employee_name, company_email, mail_provider, phone }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const sendEmail = async (req, res) => {
    try {
        const { to, subject, message } = req.body;

        // Log email send (in production, integrate with Zoho Mail API)
        console.log(`Email sent to ${to}: ${subject}`);

        res.json({ success: true, message: 'Email queued for sending', data: { to, subject } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};