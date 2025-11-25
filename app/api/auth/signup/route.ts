import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/signup
 * Creates a user account and automatically creates an organization
 * Uses Supabase service role to create user + org atomically
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, organization_name, trade_type } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for MVP
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 500 }
      )
    }

    // Create organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organization_name || `${full_name || email}'s Organization`,
        trade_type: trade_type || 'other',
        subscription_tier: 'starter',
        subscription_status: 'trialing',
      })
      .select()
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      // Clean up auth user if org creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    // Create user profile linked to organization
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        full_name: full_name || null,
        organization_id: orgData.id,
        role: 'owner',
      })

    if (userError) {
      console.error('User profile creation error:', userError)
      // Clean up org and auth user
      await supabase.from('organizations').delete().eq('id', orgData.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      organization: {
        id: orgData.id,
        name: orgData.name,
      },
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

