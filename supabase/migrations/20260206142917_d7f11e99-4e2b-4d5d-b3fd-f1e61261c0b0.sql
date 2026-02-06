-- Migration: Security features for MCP Foundry (Part 2 - PIN hash functions)
-- Using sha256 from extensions schema

CREATE OR REPLACE FUNCTION public.hash_security_pin(pin TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.digest(pin::bytea, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.verify_security_pin(pin TEXT, stored_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.digest(pin::bytea, 'sha256'), 'hex') = stored_hash;
$$;