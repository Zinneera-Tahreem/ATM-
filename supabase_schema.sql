-- ===================================================
-- NEXUS SMART ATM - SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/hzftbwbhxoggqanrswfk/sql)
-- ===================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ATM Account Balance & Totals Table
CREATE TABLE IF NOT EXISTS public.atm_account (
    id TEXT PRIMARY KEY DEFAULT 'primary_account',
    account_number TEXT NOT NULL DEFAULT '5412-8890-3140-9284',
    account_holder TEXT NOT NULL DEFAULT 'ALEX R. MORGAN',
    balance NUMERIC(12, 2) NOT NULL DEFAULT 24850.50,
    total_credit NUMERIC(12, 2) NOT NULL DEFAULT 12400.00,
    total_debit NUMERIC(12, 2) NOT NULL DEFAULT 4650.00,
    daily_limit_remaining NUMERIC(12, 2) NOT NULL DEFAULT 2500.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ATM Transactions Ledger Table
CREATE TABLE IF NOT EXISTS public.atm_transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Insert Default Account Record (if not already exists)
INSERT INTO public.atm_account (id, balance, total_credit, total_debit, daily_limit_remaining)
VALUES ('primary_account', 24850.50, 12400.00, 4650.00, 2500.00)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Initial Sample Transactions
INSERT INTO public.atm_transactions (id, type, title, category, amount, balance_after, status, created_at)
VALUES 
    ('TX-98421', 'credit', 'Direct Payroll Deposit', 'Salary', 4250.00, 24850.50, 'Completed', now() - interval '2 hours'),
    ('TX-98420', 'debit', 'ATM Cash Withdrawal', 'ATM Cash Out', 300.00, 20600.50, 'Completed', now() - interval '5 hours'),
    ('TX-98419', 'credit', 'Wire Transfer Inward', 'Client Payout', 1850.00, 20900.50, 'Completed', now() - interval '1 day'),
    ('TX-98418', 'debit', 'POS Terminal Swipe', 'Retail Store', 145.50, 19050.50, 'Completed', now() - interval '2 days'),
    ('TX-98417', 'credit', 'Instant Cash Deposit', 'ATM Cash In', 6300.00, 19196.00, 'Completed', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.atm_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atm_transactions ENABLE ROW LEVEL SECURITY;

-- 7. Create Public Access Policies (Allow read/write from ATM frontend)
DROP POLICY IF EXISTS "Public can view atm_account" ON public.atm_account;
CREATE POLICY "Public can view atm_account" ON public.atm_account FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update atm_account" ON public.atm_account;
CREATE POLICY "Public can update atm_account" ON public.atm_account FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can insert atm_account" ON public.atm_account;
CREATE POLICY "Public can insert atm_account" ON public.atm_account FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view atm_transactions" ON public.atm_transactions;
CREATE POLICY "Public can view atm_transactions" ON public.atm_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert atm_transactions" ON public.atm_transactions;
CREATE POLICY "Public can insert atm_transactions" ON public.atm_transactions FOR INSERT WITH CHECK (true);

-- 8. Enable Realtime Notifications on these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.atm_account;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atm_transactions;
