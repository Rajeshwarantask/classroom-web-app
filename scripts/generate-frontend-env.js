const fs = require('fs')
const path = require('path')

const frontendDir = path.resolve(__dirname, '..', 'frontend')
const candidates = {
  REACT_APP_SUPABASE_URL: ['REACT_APP_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  REACT_APP_SUPABASE_ANON_KEY: ['REACT_APP_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'],
  REACT_APP_SUPABASE_REDIRECT_URL: ['REACT_APP_SUPABASE_REDIRECT_URL', 'NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL'],
}

const lines = []
for (const [target, names] of Object.entries(candidates)) {
  const source = names.find((name) => process.env[name])
  if (source) lines.push(`${target}=${process.env[source]}`)
}

if (!process.env.REACT_APP_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  throw new Error('Missing Supabase URL for the frontend build. Set REACT_APP_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in Vercel.')
}
if (!process.env.REACT_APP_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_PUBLISHABLE_KEY && !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase public key for the frontend build. Set REACT_APP_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.')
}

fs.writeFileSync(path.join(frontendDir, '.env.production.local'), `${lines.join('\n')}\n`, { mode: 0o600 })
console.log('Frontend build environment prepared from public Supabase configuration.')
if (require.main === module) {
  console.log('Frontend build environment prepared from public Supabase configuration.')
}
