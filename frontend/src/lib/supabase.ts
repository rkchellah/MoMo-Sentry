// Browser client. The storageKey is deliberate: it keeps this app's session
// out of any other Supabase app served from the same origin.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storageKey: 'sb-momo-auth-token',
    autoRefreshToken: true,
    persistSession: true,
  },
})
