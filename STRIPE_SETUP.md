# Stripe Setup Instructions

## Environment Variables Needed

Add these to your Vercel project settings:

### Required:
- `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_test_` for test mode or `sk_live_` for production)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (starts with `pk_test_` for test mode or `pk_live_` for production) - if needed for frontend

### Option 1: Use Price IDs (Recommended)
- `STRIPE_PRICE_ID_STARTER` - Price ID for Starter plan (starts with `price_...`)
- `STRIPE_PRICE_ID_PRO` - Price ID for Pro plan (starts with `price_...`)
- `STRIPE_PRICE_ID_BUSINESS` - Price ID for Business plan (starts with `price_...`)

### Option 2: Use Product IDs (Alternative)
If you only have Product IDs, the system will automatically fetch the default price:
- `STRIPE_PRODUCT_ID_STARTER` - Product ID for Starter plan (starts with `prod_...`)
- `STRIPE_PRODUCT_ID_PRO` - Product ID for Pro plan (starts with `prod_...`)
- `STRIPE_PRODUCT_ID_BUSINESS` - Product ID for Business plan (starts with `prod_...`)

## How to Get Price IDs from Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Products
2. Click on your product (e.g., "Starter Plan")
3. In the product details, you'll see "Pricing" section
4. Click on the price you want to use
5. Copy the Price ID (starts with `price_...`)

## Quick Setup with Your Current Product IDs

Since you have Product IDs, you can set these environment variables in Vercel:

```
STRIPE_SECRET_KEY=sk_test_... (your secret key)
STRIPE_PRODUCT_ID_STARTER=prod_TOfxlypTNXZNhB
STRIPE_PRODUCT_ID_PRO=prod_TOfx6fhO40IMoF
STRIPE_PRODUCT_ID_BUSINESS=prod_TOfy8NLmOTOaYl
```

The system will automatically fetch the default price for each product.

**Important:** Never commit secret keys to git. Always add them as environment variables in Vercel.

## Note

- Product IDs start with `prod_...`
- Price IDs start with `price_...`
- The checkout system needs Price IDs, but can automatically get them from Product IDs if you prefer

