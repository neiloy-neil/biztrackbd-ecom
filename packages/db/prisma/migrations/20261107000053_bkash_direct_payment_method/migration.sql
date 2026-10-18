-- Add GATEWAY_BKASH to PaymentMethodType for Direct bKash Tokenized Checkout
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'GATEWAY_BKASH';
