import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })
  const body: { confirmation?: unknown } = await request.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') return Response.json({ error: 'Confirmation required' }, { status: 400, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Invalid or expired session' }, { status: 401, headers: corsHeaders })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Account deletion failed', deleteError)
    return Response.json({ error: 'Unable to delete account' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ deleted: true }, { headers: corsHeaders })
})
