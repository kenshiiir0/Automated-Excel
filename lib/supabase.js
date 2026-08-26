const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Loading Supabase - URL:', supabaseUrl ? 'loaded' : 'MISSING');
console.log('Loading Supabase - AnonKey:', supabaseAnonKey ? 'loaded' : 'MISSING');
console.log('Loading Supabase - ServiceRoleKey:', supabaseServiceRoleKey ? 'loaded' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Supabase credentials missing: URL=${!!supabaseUrl}, AnonKey=${!!supabaseAnonKey}`);
}

module.exports = {
    supabase: createClient(supabaseUrl, supabaseAnonKey),
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceRoleKey)
};