import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// dotenv.config() with no path loads ".env" relative to whatever folder the
// command was run FROM (process.cwd()), not relative to this file. That
// caused credentials to load fine when running "node server.js" from the
// project root, but fail as "MISSING" when running a script from inside a
// subfolder like import_data/. Resolving the path explicitly relative to
// this file's own location makes it work no matter which folder the
// terminal is sitting in when a script imports this module.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Loading Supabase - URL:', supabaseUrl ? 'loaded' : 'MISSING');
console.log('Loading Supabase - AnonKey:', supabaseAnonKey ? 'loaded' : 'MISSING');
console.log('Loading Supabase - ServiceRoleKey:', supabaseServiceRoleKey ? 'loaded' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Supabase credentials missing: URL=${!!supabaseUrl}, AnonKey=${!!supabaseAnonKey}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);