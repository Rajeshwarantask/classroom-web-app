import { createClient } from '@supabase/supabase-js';
import env from '../config/env';

const supabaseUrl = env.supabaseUrl || (process.env.NODE_ENV === 'test' ? 'https://test.supabase.co' : '');
const supabaseKey = env.supabaseKey || (process.env.NODE_ENV === 'test' ? 'test-anon-key' : '');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
