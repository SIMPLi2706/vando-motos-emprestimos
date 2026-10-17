-- ============================================================
-- VANDO MOTOS LOCADORA LTDA - ESQUEMA DO BANCO SUPABASE (POSTGRESQL)
-- Execute este script no SQL Editor do seu painel Supabase
-- ============================================================

-- 1. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  credit_limit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE EMPRÉSTIMOS / CONTRATOS
CREATE TABLE IF NOT EXISTS public.loans (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES public.clients(id) ON DELETE CASCADE,
  principal NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  interest_type TEXT DEFAULT 'price',
  periodicity TEXT DEFAULT 'monthly',
  installments_count INT NOT NULL,
  start_date TEXT NOT NULL,
  total_payable NUMERIC NOT NULL,
  total_interest NUMERIC NOT NULL,
  penalty_rate NUMERIC DEFAULT 2.0,
  daily_interest_rate NUMERIC DEFAULT 0.1,
  first_payment_days INT DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE PARCELAS & COBRANÇA
CREATE TABLE IF NOT EXISTS public.installments (
  id TEXT PRIMARY KEY,
  loan_id TEXT REFERENCES public.loans(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  number INT NOT NULL,
  due_date TEXT NOT NULL,
  installment_amount NUMERIC NOT NULL,
  amortization_amount NUMERIC DEFAULT 0,
  interest_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  paid_date TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE CONFIGURAÇÕES GLOBAIS
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita Row Level Security (RLS) e libera acesso com a chave Anon (Pública)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para a chave anon (ideal para sistema fechado por PIN)
CREATE POLICY "Anon Full Access Clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Installments" ON public.installments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Habilita Sincronização em Tempo Real (Realtime) para que alterações no celular apareçam na hora no computador
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
