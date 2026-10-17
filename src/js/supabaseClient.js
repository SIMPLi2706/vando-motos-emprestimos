// src/js/supabaseClient.js
// Cliente Supabase e Mecanismo de Sincronização em Nuvem (PostgreSQL) - Vando Motos Locadora LTDA

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;
let realtimeChannel = null;

const STORAGE_URL_KEY = 'vandomotos_supabase_url';
const STORAGE_KEY_KEY = 'vandomotos_supabase_key';
const DEFAULT_SUPABASE_URL = 'https://xhpqzvddhmauuelqmmrp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHF6dmRkaG1hdXVlbHFtbXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxOTUxMTYsImV4cCI6MjEwNzc3MTExNn0.yEyBq0iw1zfSfE9HBKrTISudvdr5D-LfRlrGuDDImLM';

/**
 * Retorna as credenciais configuradas de forma segura dentro do projeto
 */
export function getSupabaseConfig() {
  const url = (import.meta.env?.VITE_SUPABASE_URL || localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_SUPABASE_URL).trim();
  const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_SUPABASE_ANON_KEY).trim();
  return { url, key };
}

/**
 * Salva as credenciais do Supabase no navegador
 */
export function saveSupabaseConfig(url, key) {
  const cleanUrl = (url || '').trim();
  const cleanKey = (key || '').trim();

  if (cleanUrl) {
    localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_KEY);
  }

  // Reseta instância anterior
  supabaseInstance = null;
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
}

/**
 * Verifica se o Supabase está configurado
 */
export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return !!(url && key && url.startsWith('http'));
}

/**
 * Retorna ou inicializa o cliente Supabase
 */
export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { url, key } = getSupabaseConfig();
  if (!url || !key || !url.startsWith('http')) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

/**
 * Testa a conexão com o Supabase
 */
export async function testSupabaseConnection() {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Supabase não configurado. Forneça URL e Chave Anon.' };
  }

  try {
    const { data, error } = await client.from('clients').select('id').limit(1);
    if (error) throw error;
    return { success: true, message: 'Conexão estabelecida com sucesso com o banco de dados PostgreSQL!' };
  } catch (err) {
    return { success: false, error: err.message || 'Falha ao conectar. Verifique o esquema SQL e as chaves.' };
  }
}

/**
 * Envia todos os dados locais atuais (clientes, empréstimos, parcelas, configs) para o Supabase
 */
export async function pushAllToSupabase(localData) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não conectado.');

  // 1. Clientes
  if (localData.clients && localData.clients.length > 0) {
    const payloadClients = localData.clients.map(c => ({
      id: c.id,
      name: c.name,
      cpf: c.cpf || null,
      phone: c.phone || null,
      address: c.address || null,
      notes: c.notes || null,
      credit_limit: Number(c.creditLimit || 0),
      created_at: c.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: errCli } = await client.from('clients').upsert(payloadClients, { onConflict: 'id' });
    if (errCli) throw new Error(`Erro ao enviar clientes: ${errCli.message}`);
  }

  // 2. Empréstimos
  if (localData.loans && localData.loans.length > 0) {
    const payloadLoans = localData.loans.map(l => ({
      id: l.id,
      client_id: l.clientId,
      principal: Number(l.principal || 0),
      interest_rate: Number(l.interestRate || 0),
      interest_type: l.interestType || 'price',
      periodicity: l.periodicity || 'monthly',
      installments_count: Number(l.installmentsCount || 1),
      start_date: l.startDate || '',
      total_payable: Number(l.totalPayable || 0),
      total_interest: Number(l.totalInterest || 0),
      penalty_rate: Number(l.penaltyRate || 2.0),
      daily_interest_rate: Number(l.dailyInterestRate || 0.1),
      first_payment_days: Number(l.firstPaymentDays || 0),
      notes: l.notes || '',
      status: l.status || 'active',
      created_at: l.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: errLoans } = await client.from('loans').upsert(payloadLoans, { onConflict: 'id' });
    if (errLoans) throw new Error(`Erro ao enviar empréstimos: ${errLoans.message}`);
  }

  // 3. Parcelas
  if (localData.installments && localData.installments.length > 0) {
    const payloadInsts = localData.installments.map(i => ({
      id: i.id,
      loan_id: i.loanId,
      client_id: i.clientId,
      number: Number(i.number || 1),
      due_date: i.dueDate || '',
      installment_amount: Number(i.installmentAmount || 0),
      amortization_amount: Number(i.amortizationAmount || 0),
      interest_amount: Number(i.interestAmount || 0),
      paid_amount: Number(i.paidAmount || 0),
      paid_date: i.paidDate || null,
      status: i.status || 'pending',
      payment_method: i.paymentMethod || null,
      payment_history: i.paymentHistory || [],
      updated_at: new Date().toISOString()
    }));

    // Envia em blocos para evitar limites de payload
    const CHUNK_SIZE = 100;
    for (let idx = 0; idx < payloadInsts.length; idx += CHUNK_SIZE) {
      const chunk = payloadInsts.slice(idx, idx + CHUNK_SIZE);
      const { error: errInst } = await client.from('installments').upsert(chunk, { onConflict: 'id' });
      if (errInst) throw new Error(`Erro ao enviar parcelas: ${errInst.message}`);
    }
  }

  // 4. Configurações
  if (localData.settings) {
    const { error: errSet } = await client.from('settings').upsert({
      id: 'global',
      data: localData.settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (errSet) throw new Error(`Erro ao enviar configurações: ${errSet.message}`);
  }

  return { success: true, count: { clients: localData.clients?.length || 0, loans: localData.loans?.length || 0, installments: localData.installments?.length || 0 } };
}

/**
 * Puxa todos os dados do Supabase e retorna a estrutura unificada para o StateManager
 */
export async function pullAllFromSupabase() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não conectado.');

  const [resCli, resLoans, resInsts, resSettings] = await Promise.all([
    client.from('clients').select('*').order('created_at', { ascending: false }),
    client.from('loans').select('*').order('created_at', { ascending: false }),
    client.from('installments').select('*').order('number', { ascending: true }),
    client.from('settings').select('*').eq('id', 'global').maybeSingle()
  ]);

  if (resCli.error) throw resCli.error;
  if (resLoans.error) throw resLoans.error;
  if (resInsts.error) throw resInsts.error;

  const clients = (resCli.data || []).map(c => ({
    id: c.id,
    name: c.name,
    cpf: c.cpf || '',
    phone: c.phone || '',
    address: c.address || '',
    notes: c.notes || '',
    creditLimit: Number(c.credit_limit || 0),
    createdAt: c.created_at
  }));

  const loans = (resLoans.data || []).map(l => ({
    id: l.id,
    clientId: l.client_id,
    principal: Number(l.principal || 0),
    interestRate: Number(l.interest_rate || 0),
    interestType: l.interest_type || 'price',
    periodicity: l.periodicity || 'monthly',
    installmentsCount: Number(l.installments_count || 1),
    startDate: l.start_date,
    totalPayable: Number(l.total_payable || 0),
    totalInterest: Number(l.total_interest || 0),
    penaltyRate: Number(l.penalty_rate || 2.0),
    dailyInterestRate: Number(l.daily_interest_rate || 0.1),
    firstPaymentDays: Number(l.first_payment_days || 0),
    notes: l.notes || '',
    status: l.status || 'active',
    createdAt: l.created_at
  }));

  const installments = (resInsts.data || []).map(i => ({
    id: i.id,
    loanId: i.loan_id,
    clientId: i.client_id,
    number: Number(i.number || 1),
    dueDate: i.due_date,
    installmentAmount: Number(i.installment_amount || 0),
    amortizationAmount: Number(i.amortization_amount || 0),
    interestAmount: Number(i.interest_amount || 0),
    paidAmount: Number(i.paid_amount || 0),
    paidDate: i.paid_date || null,
    status: i.status || 'pending',
    paymentMethod: i.payment_method || null,
    paymentHistory: i.payment_history || []
  }));

  let settings = null;
  if (resSettings.data && resSettings.data.data) {
    settings = resSettings.data.data;
  }

  return {
    clients,
    loans,
    installments,
    settings
  };
}

/**
 * Configura escuta em tempo real (Realtime Channel)
 */
export function setupRealtimeSync(onUpdateCallback) {
  const client = getSupabase();
  if (!client) return null;

  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }

  realtimeChannel = client
    .channel('vandomotos-sync-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'installments' }, () => {
      onUpdateCallback('installments');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
      onUpdateCallback('loans');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
      onUpdateCallback('clients');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
      onUpdateCallback('settings');
    })
    .subscribe();

  return realtimeChannel;
}
