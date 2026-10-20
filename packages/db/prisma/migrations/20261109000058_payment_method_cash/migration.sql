-- Counter (POS) cash sales are their own method so they are not mixed with cash-on-delivery.
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'CASH';
