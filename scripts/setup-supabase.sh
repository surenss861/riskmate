#!/bin/bash

# RiskMate Supabase Setup Script
# This script helps you set up your new Supabase project

echo "🚀 RiskMate Supabase Setup"
echo "=========================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Configuration (optional for now)
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_BUSINESS=
EOF
    echo "📝 Created .env.local template"
    echo "⚠️  Please update .env.local with your Supabase credentials before continuing"
    echo ""
    read -p "Press Enter after you've updated .env.local..."
fi

echo ""
echo "📋 Next steps:"
echo ""
echo "1. Link your Supabase project:"
echo "   supabase link --project-ref YOUR_PROJECT_REF"
echo ""
echo "2. Run migrations:"
echo "   supabase db push"
echo ""
echo "3. Or run migrations manually in Supabase SQL Editor:"
echo "   - Go to your Supabase dashboard → SQL Editor"
echo "   - Run each migration file from supabase/migrations/ in order"
echo ""
echo "4. Verify storage buckets were created (check Storage section)"
echo ""
echo "5. Test the connection by running: npm run dev"
echo ""
echo "📖 For detailed instructions, see SUPABASE_SETUP.md"
echo ""

