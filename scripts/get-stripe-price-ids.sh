#!/bin/bash
# Quick script to get Stripe Price IDs using Stripe CLI

echo "🔍 Fetching Price IDs from Stripe Products..."
echo ""

echo "Starter (prod_TpcwqnpnlA9keA):"
stripe prices list --product prod_TpcwqnpnlA9keA --active --limit 1 --format json | jq -r '.data[0] | "  Price ID: \(.id)\n  Amount: $\(.unit_amount / 100)/\(.recurring.interval)"'

echo ""
echo "Pro (prod_TpcyAbLnS5VDz7):"
stripe prices list --product prod_TpcyAbLnS5VDz7 --active --limit 1 --format json | jq -r '.data[0] | "  Price ID: \(.id)\n  Amount: $\(.unit_amount / 100)/\(.recurring.interval)"'

echo ""
echo "Business (prod_TpczVi0pxfQhfH):"
stripe prices list --product prod_TpczVi0pxfQhfH --active --limit 1 --format json | jq -r '.data[0] | "  Price ID: \(.id)\n  Amount: $\(.unit_amount / 100)/\(.recurring.interval)"'

echo ""
echo "📋 Add these to Railway env vars:"
echo ""
stripe prices list --product prod_TpcwqnpnlA9keA --active --limit 1 --format json | jq -r '.data[0] | "STRIPE_PRICE_STARTER=\(.id)"'
stripe prices list --product prod_TpcyAbLnS5VDz7 --active --limit 1 --format json | jq -r '.data[0] | "STRIPE_PRICE_PRO=\(.id)"'
stripe prices list --product prod_TpczVi0pxfQhfH --active --limit 1 --format json | jq -r '.data[0] | "STRIPE_PRICE_BUSINESS=\(.id)"'
