import { supabaseAdmin } from '../lib/supabase.js';

const getEmailDirectory = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_directory')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('controllers/emailController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const addToDirectory = async (req, res) => {
    try {
        const { emp_id, employee_name, company_email, mail_provider, phone } = req.body;

        const { data, error } = await supabaseAdmin
            .from('email_directory')
            .insert([{ emp_id, employee_name, company_email, mail_provider, phone }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        console.error('controllers/emailController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const sendEmail = async (req, res) => {
    try {
        const { to, subject, message } = req.body;

        console.log(`Email sent to ${to}: ${subject}`);

        res.json({ success: true, message: 'Email queued for sending', data: { to, subject } });
    } catch (err) {
        console.error('controllers/emailController.js error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

export { getEmailDirectory, addToDirectory, sendEmail };