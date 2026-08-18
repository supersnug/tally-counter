/*
 * This file is part of Tally.
 *
 * Copyright (C) 2026 Tally contributors
 *
 * Tally is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * Tally is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Tally. If not, see <https://www.gnu.org/licenses/>.
 */
import { createClient } from '@supabase/supabase-js'
import { authorizeDeletion } from './authorization.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })
  const body: { confirmation?: unknown; purpose?: unknown; session_id?: unknown; session_generation?: unknown; command_id?: unknown } = await request.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') return Response.json({ error: 'Confirmation required' }, { status: 400, headers: corsHeaders })
  if (body.purpose !== 'account_deletion') return Response.json({ error: 'Purpose-bound authentication required' }, { status: 400, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Invalid or expired session' }, { status: 401, headers: corsHeaders })
  const token = authorization.replace(/^Bearer\s+/i, '').split('.')[1]
  let issuedAt = 0
  let tokenSessionId = ''
  try { const claims = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/'))); issuedAt = Number(claims.iat || 0); tokenSessionId = String(claims.session_id || claims.sid || '') } catch { return Response.json({ error: 'Fresh authentication required' }, { status: 401, headers: corsHeaders }) }
  const authorizationResult = authorizeDeletion({ purpose: body.purpose, sessionId: body.session_id, sessionGeneration: body.session_generation, commandId: body.command_id, issuedAt, expectedSessionId: tokenSessionId })
  if (!authorizationResult.ok) return Response.json({ error: authorizationResult.reason === 'purpose' ? 'Purpose-bound authentication required' : authorizationResult.reason === 'session' || authorizationResult.reason === 'binding' ? 'Session binding mismatch' : 'Fresh authentication required' }, { status: 401, headers: corsHeaders })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: guardError } = await adminClient.rpc('assert_account_deletion_allowed', { target_user: user.id })
  if (guardError) {
    if (guardError.code === '23514') return Response.json({ error: guardError.message }, { status: 409, headers: corsHeaders })
    console.error('Account deletion guard failed', guardError)
    return Response.json({ error: 'Unable to verify account deletion eligibility' }, { status: 500, headers: corsHeaders })
  }
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Account deletion failed', deleteError)
    return Response.json({ error: 'Unable to delete account' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ deleted: true }, { headers: corsHeaders })
})
