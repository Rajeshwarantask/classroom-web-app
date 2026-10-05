const firstDefined = (...names) => names.map((name) => process.env[name]).find(Boolean) || ''

export const env = {
  supabaseUrl: firstDefined('REACT_APP_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseKey: firstDefined('REACT_APP_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  authRedirectUrl: firstDefined('REACT_APP_SUPABASE_REDIRECT_URL', 'NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL'),
}

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseKey)

if (!isConfigured && process.env.NODE_ENV === 'production') {
  throw new Error('Supabase configuration is missing. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY during the frontend build.')
}

export default env

// CRA only exposes variables prefixed with REACT_APP_; the NEXT_PUBLIC fallbacks
// keep this project compatible with the existing Vercel/Supabase environment.

