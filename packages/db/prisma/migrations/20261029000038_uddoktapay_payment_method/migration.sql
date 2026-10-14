-- The UddoktaPay gateway was added to the code and the schema without the matching database change, so any order paid that way
-- failed with "invalid input value for enum PaymentMethodType". Adding a value is safe for the code that is already running.
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'GATEWAY_UDDOKTAPAY';
