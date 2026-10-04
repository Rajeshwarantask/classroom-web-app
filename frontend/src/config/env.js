const required = (name) => {
  const value = process.env[name]
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value || ''
}

export const env = {
  supabaseUrl: required('REACT_APP_SUPABASE_URL') || required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseKey: required('REACT_APP_SUPABASE_ANON_KEY') || required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  authRedirectUrl: process.env.REACT_APP_SUPABASE_REDIRECT_URL || process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
}

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseKey)

export default env

// CRA only exposes variables prefixed with REACT_APP_; the NEXT_PUBLIC fallbacks
// keep this project compatible with the existing Vercel/Supabase environment.

