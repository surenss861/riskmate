/**
 * Script to get Stripe Price IDs from Product IDs
 * 
 * Usage:
 *   npx tsx scripts/get-stripe-price-ids.ts
 * 
 * Or with explicit API key:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/get-stripe-price-ids.ts
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

const PRODUCTS = {
  starter: 'prod_TpcwqnpnlA9keA',
  pro: 'prod_TpcyAbLnS5VDz7',
  business: 'prod_TpczVi0pxfQhfH',
} as const;

async function getPriceIds() {
  console.log('🔍 Fetching Price IDs from Stripe Products...\n');

  const results: Record<string, { productId: string; priceId: string | null; amount: number | null; interval: string | null }> = {};

  for (const [plan, productId] of Object.entries(PRODUCTS)) {
    try {
      // Get product with default price
      const product = await stripe.products.retrieve(productId, {
        expand: ['default_price'],
      });

      // Get all active prices for this product (to find monthly recurring)
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
      });

      // Find monthly recurring price
      const monthlyPrice = prices.data.find(
        (p) => p.recurring?.interval === 'month' && p.active
      );

      const defaultPrice = typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id;

      const priceId = monthlyPrice?.id || defaultPrice || null;
      const amount = monthlyPrice?.unit_amount 
        ? monthlyPrice.unit_amount / 100 
        : (typeof product.default_price === 'object' && product.default_price?.unit_amount)
        ? product.default_price.unit_amount / 100
        : null;
      const interval = monthlyPrice?.recurring?.interval || 
        (typeof product.default_price === 'object' && product.default_price?.recurring?.interval) ||
        null;

      results[plan] = {
        productId,
        priceId,
        amount,
        interval,
      };

      console.log(`✅ ${plan.toUpperCase()}:`);
      console.log(`   Product ID: ${productId}`);
      if (priceId) {
        console.log(`   Price ID: ${priceId}`);
        console.log(`   Amount: $${amount}${interval ? `/${interval}` : ''}`);
      } else {
        console.log(`   ⚠️  No monthly recurring price found!`);
      }
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error fetching ${plan}:`, error.message);
      results[plan] = {
        productId,
        priceId: null,
        amount: null,
        interval: null,
      };
      console.log('');
    }
  }

  console.log('\n📋 Environment Variables for Railway:\n');
  console.log('Add these to Railway → Backend Service → Variables:\n');
  
  if (results.starter.priceId) {
    console.log(`STRIPE_PRICE_STARTER=${results.starter.priceId}`);
  }
  if (results.pro.priceId) {
    console.log(`STRIPE_PRICE_PRO=${results.pro.priceId}`);
  }
  if (results.business.priceId) {
    console.log(`STRIPE_PRICE_BUSINESS=${results.business.priceId}`);
  }

  console.log('\n');

  // Verify expected pricing
  const expectedPrices = {
    starter: 29,
    pro: 59,
    business: 129,
  };

  console.log('💰 Price Verification:\n');
  for (const [plan, expected] of Object.entries(expectedPrices)) {
    const actual = results[plan as keyof typeof results]?.amount;
    if (actual === expected) {
      console.log(`✅ ${plan.toUpperCase()}: $${actual} (matches expected $${expected})`);
    } else if (actual) {
      console.log(`⚠️  ${plan.toUpperCase()}: $${actual} (expected $${expected})`);
    } else {
      console.log(`❌ ${plan.toUpperCase()}: Price not found`);
    }
  }
}

getPriceIds().catch(console.error);
