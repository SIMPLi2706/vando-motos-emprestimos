// src/js/state.js
// Gerenciamento de Estado, Persistência Local (LocalStorage) e Nuvem (Supabase / PostgreSQL)

import { generateId, formatDateForInput, addDays, addMonths, formatDate, formatBRL } from './utils.js';
import { calculateAmortizationSchedule } from './finance.js';
import { isSupabaseConfigured, pullAllFromSupabase, pushAllToSupabase, setupRealtimeSync, deleteClientFromSupabase, deleteLoanFromSupabase, wipeAllFromSupabase } from './supabaseClient.js';

const STORAGE_KEY = 'vandomotos_data_v1';

// Estrutura inicial padrão - Vando Motos Locadora LTDA
const DEFAULT_SETTINGS = {
  businessName: 'Vando motos locadora LTDA',
  creditorCpfCnpj: '28.623.431-0001-23',
  creditorCity: 'PORTO VELHO RONDONIA',
  pixKey: '28.623.431-0001-23',
  pixType: 'CPF/CNPJ',
  pixHolder: 'Vando motos locadora LTDA',
  defaultPenaltyRate: 2.0, // 2% multa
  defaultDailyRate: 0.1,   // 0.1% mora ao dia
  whatsappTemplate: 'Olá, {cliente}! Lembramos que sua parcela nº {parcela_num} no valor de {valor_parcela} venceu/vence em {data_vencimento}.\n\nPara facilitar o pagamento via PIX da Vando Motos Locadora:\nChave PIX (CNPJ): {chave_pix}\nFavorecido: {titular_pix}\n\nApós o pagamento, envie o comprovante por aqui. Obrigado!',
  geminiApiKey: ''
};

class StateManager {
  constructor() {
    this.data = {
      clients: [],
      loans: [],
      installments: [],
      settings: { ...DEFAULT_SETTINGS }
    };
    this.listeners = [];
    this.isSyncing = false;
    this.load();
    this.initSupabaseSync();
  }

  initSupabaseSync() {
    if (isSupabaseConfigured()) {
      this.syncFromSupabase().catch(err => {
        console.warn('Sincronização inicial com Supabase:', err.message || err);
      });

      setupRealtimeSync(() => {
        console.log('Atualização em tempo real recebida do Supabase, sincronizando...');
        this.syncFromSupabase().catch(console.error);
      });
    }
  }

  async syncFromSupabase() {
    if (!isSupabaseConfigured() || this.isSyncing) return;
    this.isSyncing = true;
    try {
      const remote = await pullAllFromSupabase();

      const isRemoteEmpty = (!remote.clients || remote.clients.length === 0) &&
                            (!remote.loans || remote.loans.length === 0);
      const isWiped = localStorage.getItem('vandomotos_wiped') === 'true';

      const demoNames = ['BRUNO VASQUEZ CASTRO', 'Carlos Silva Santos', 'Mariana Souza Oliveira', 'Roberto Ferreira Dias'];
      const hasOnlyDemoData = this.data.clients && this.data.clients.length > 0 &&
                              this.data.clients.every(c => demoNames.includes(c.name));

      // Se a nuvem estiver vazia e os dados locais forem apenas os dados de exemplo automáticos ou se o sistema foi zerado:
      if (isRemoteEmpty && (isWiped || hasOnlyDemoData)) {
        this.data.clients = [];
        this.data.loans = [];
        this.data.installments = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.notify();
        return;
      }

      // Se a nuvem estiver vazia, mas tivermos dados locais REAIS criados pelo usuário, envia para a nuvem
      const hasRealLocalData = this.data.clients && this.data.clients.length > 0 && !hasOnlyDemoData;
      if (isRemoteEmpty && hasRealLocalData) {
        console.log('Nuvem Supabase está limpa. Enviando dados locais para a nuvem...');
        await pushAllToSupabase(this.data);
        return;
      }

      // Supabase é a autoridade: sincroniza exatamente o que está na nuvem
      this.data.clients = remote.clients || [];
      this.data.loans = remote.loans || [];
      this.data.installments = remote.installments || [];
      if (remote.settings) {
        this.data.settings = { ...this.data.settings, ...remote.settings };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();
    } catch (err) {
      console.warn('Erro ao sincronizar com Supabase:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncToSupabase() {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurado.');
    return await pushAllToSupabase(this.data);
  }

  load() {
    try {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        stored = localStorage.getItem('credisys_data_v3');
      }

      const isWiped = localStorage.getItem('vandomotos_wiped') === 'true';

      if (stored) {
        this.data = JSON.parse(stored);
        this.data.settings = { ...DEFAULT_SETTINGS, ...(this.data.settings || {}) };
        if (!this.data.settings.businessName || this.data.settings.businessName.includes('CrediSys') || !this.data.settings.creditorCpfCnpj || this.data.settings.creditorCpfCnpj !== '28.623.431-0001-23') {
          this.data.settings.businessName = 'Vando motos locadora LTDA';
          this.data.settings.creditorCpfCnpj = '28.623.431-0001-23';
          this.data.settings.pixKey = '28.623.431-0001-23';
          this.data.settings.pixHolder = 'Vando motos locadora LTDA';
          this.data.settings.creditorCity = 'PORTO VELHO RONDONIA';
        }

        // Garante que arrays existam e respeita exclusões do usuário
        this.data.clients = this.data.clients || [];
        this.data.loans = this.data.loans || [];
        this.data.installments = this.data.installments || [];

        if (isWiped) {
          this.data.clients = [];
          this.data.loans = [];
          this.data.installments = [];
        }
        this.save();
      } else {
        // NUNCA carrega dados fictícios automaticamente. O sistema inicia sempre limpo.
        this.data = {
          clients: [],
          loans: [],
          installments: [],
          settings: { ...DEFAULT_SETTINGS }
        };
        this.save();
      }
    } catch (err) {
      console.error('Erro ao carregar dados do LocalStorage:', err);
      this.data = {
        clients: [],
        loans: [],
        installments: [],
        settings: { ...DEFAULT_SETTINGS }
      };
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();

      // Sincroniza em segundo plano se a nuvem estiver configurada
      if (isSupabaseConfigured() && !this.isSyncing) {
        pushAllToSupabase(this.data).catch(err => {
          console.warn('Erro ao enviar alteração para o Supabase:', err.message || err);
        });
      }
    } catch (err) {
      console.error('Erro ao salvar dados no LocalStorage:', err);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.data);
    }
  }

  // --- CLIENTES ---
  getClients() {
    return this.data.clients || [];
  }

  getClientById(id) {
    return this.data.clients.find(c => c.id === id);
  }

  saveClient(client) {
    if (!client.id) {
      client.id = generateId('cli');
      client.createdAt = new Date().toISOString();
      this.data.clients.unshift(client);
    } else {
      const idx = this.data.clients.findIndex(c => c.id === client.id);
      if (idx !== -1) {
        this.data.clients[idx] = { ...this.data.clients[idx], ...client };
      }
    }
    this.save();
    return client;
  }

  async deleteClient(id, cascade = true) {
    const hasActiveLoans = this.data.loans.some(l => l.clientId === id && l.status === 'active');
    if (hasActiveLoans && !cascade) {
      throw new Error('Não é possível excluir um cliente com empréstimos ativos.');
    }

    if (cascade) {
      const loanIds = this.data.loans.filter(l => l.clientId === id).map(l => l.id);
      this.data.loans = this.data.loans.filter(l => l.clientId !== id);
      this.data.installments = this.data.installments.filter(i => i.clientId !== id && !loanIds.includes(i.loanId));
    }

    this.data.clients = this.data.clients.filter(c => c.id !== id);
    this.save();

    if (isSupabaseConfigured()) {
      await deleteClientFromSupabase(id).catch(err => {
        console.warn('Erro ao excluir cliente no Supabase:', err);
      });
    }
  }

  // --- EMPRÉSTIMOS ---
  getLoans() {
    return this.data.loans || [];
  }

  getLoanById(id) {
    return this.data.loans.find(l => l.id === id);
  }

  createLoan(loanData) {
    const loanId = generateId('loan');
    const scheduleResult = calculateAmortizationSchedule({
      principal: loanData.principal,
      interestRate: loanData.interestRate,
      interestType: loanData.interestType,
      periodicity: loanData.periodicity,
      installmentsCount: loanData.installmentsCount,
      startDate: loanData.startDate,
      firstPaymentDays: loanData.firstPaymentDays
    });

    const newLoan = {
      id: loanId,
      clientId: loanData.clientId,
      principal: Number(loanData.principal),
      interestRate: Number(loanData.interestRate),
      interestType: loanData.interestType,
      periodicity: loanData.periodicity,
      installmentsCount: Number(loanData.installmentsCount),
      startDate: loanData.startDate,
      penaltyRate: Number(loanData.penaltyRate || this.data.settings.defaultPenaltyRate),
      dailyInterestRate: Number(loanData.dailyInterestRate || this.data.settings.defaultDailyRate),
      totalPayable: scheduleResult.totalPayable,
      totalInterest: scheduleResult.totalInterest,
      status: 'active',
      notes: loanData.notes || '',
      createdAt: new Date().toISOString()
    };

    // Cria as parcelas
    const newInstallments = scheduleResult.schedule.map(item => ({
      id: generateId('inst'),
      loanId: loanId,
      clientId: loanData.clientId,
      number: item.number,
      dueDate: item.dueDate,
      installmentAmount: item.installmentAmount,
      amortizationAmount: item.amortizationAmount,
      interestAmount: item.interestAmount,
      paidAmount: 0,
      paidDate: null,
      status: 'pending', // 'pending', 'paid', 'partial'
      paymentHistory: []
    }));

    this.data.loans.unshift(newLoan);
    this.data.installments.push(...newInstallments);
    this.save();
    return newLoan;
  }

  async deleteLoan(id) {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    this.data.installments = this.data.installments.filter(i => i.loanId !== id);
    this.save();

    if (isSupabaseConfigured()) {
      await deleteLoanFromSupabase(id).catch(err => {
        console.warn('Erro ao excluir empréstimo no Supabase:', err);
      });
    }
  }

  async wipeAllData() {
    this.data.clients = [];
    this.data.loans = [];
    this.data.installments = [];
    localStorage.setItem('vandomotos_wiped', 'true');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.notify();

    if (isSupabaseConfigured()) {
      await wipeAllFromSupabase().catch(err => {
        console.warn('Erro ao zerar dados no Supabase:', err);
      });
    }
  }

  // --- PARCELAS E PAGAMENTOS ---
  getInstallments(filter = {}) {
    let list = this.data.installments || [];
    if (filter.loanId) {
      list = list.filter(i => i.loanId === filter.loanId);
    }
    if (filter.clientId) {
      list = list.filter(i => i.clientId === filter.clientId);
    }
    return list;
  }

  getInstallmentById(id) {
    return this.data.installments.find(i => i.id === id);
  }

  /**
   * Realiza o pagamento (total ou parcial) de uma parcela
   */
  payInstallment(installmentId, paymentInfo) {
    const inst = this.getInstallmentById(installmentId);
    if (!inst) throw new Error('Parcela não encontrada.');

    const amountPaid = Number(paymentInfo.amountPaid);
    const paymentDate = paymentInfo.paymentDate || formatDateForInput();
    const paymentMethod = paymentInfo.paymentMethod || 'PIX';
    const notes = paymentInfo.notes || '';
    const discount = Number(paymentInfo.discount || 0);
    const lateChargesPaid = Number(paymentInfo.lateChargesPaid || 0);

    const currentPaid = Number(inst.paidAmount || 0);
    const newTotalPaid = currentPaid + amountPaid;

    const receipt = {
      id: generateId('rec'),
      date: paymentDate,
      amount: amountPaid,
      discount,
      lateChargesPaid,
      method: paymentMethod,
      notes
    };

    inst.paidAmount = newTotalPaid;
    inst.paymentHistory = inst.paymentHistory || [];
    inst.paymentHistory.push(receipt);

    // Se o valor pago cobriu o total da parcela (considerando descontos)
    if (newTotalPaid + discount >= inst.installmentAmount) {
      inst.status = 'paid';
      inst.paidDate = paymentDate;
    } else {
      inst.status = 'partial';
    }

    // Verifica se todas as parcelas do empréstimo foram pagas
    const loanInstallments = this.data.installments.filter(i => i.loanId === inst.loanId);
    const allPaid = loanInstallments.every(i => i.status === 'paid');
    const loan = this.getLoanById(inst.loanId);
    if (loan && allPaid) {
      loan.status = 'paid';
    }

    this.save();
    return { installment: inst, receipt };
  }

  /**
   * Estornar pagamento de parcela
   */
  revertPayment(installmentId) {
    const inst = this.getInstallmentById(installmentId);
    if (!inst) return;
    inst.paidAmount = 0;
    inst.paidDate = null;
    inst.status = 'pending';
    inst.paymentHistory = [];

    const loan = this.getLoanById(inst.loanId);
    if (loan && loan.status === 'paid') {
      loan.status = 'active';
    }

    this.save();
  }

  /**
   * Rolagem de Dívida / Renovação Rápida
   * O devedor quita apenas os juros do período (e encargos de atraso, se houver).
   * O valor principal permanece em aberto e a data de vencimento da parcela é prorrogada.
   */
  rollOverInstallment(installmentId, {
    amountPaid,
    paymentMethod = 'PIX',
    paymentDate = formatDateForInput(),
    newDueDate,
    notes = ''
  }) {
    const inst = this.getInstallmentById(installmentId);
    if (!inst) throw new Error('Parcela não encontrada.');

    const loan = this.getLoanById(inst.loanId);
    if (!loan) throw new Error('Empréstimo não encontrado.');

    const amount = Number(amountPaid);
    if (amount <= 0) throw new Error('O valor dos juros pagos deve ser maior que zero.');

    // Se nova data não foi informada, avança 1 ciclo (1 mês ou período correspondente)
    const nextDate = newDueDate || addMonths(inst.dueDate, 1);

    const rolloverReceipt = {
      id: generateId('rec_roll'),
      date: paymentDate,
      amount: amount,
      method: paymentMethod,
      type: 'interest_rollover',
      notes: notes || `Rolagem de dívida. Juros do ciclo quitados. Vencimento prorrogado para ${formatDate(nextDate)}.`
    };

    inst.paymentHistory = inst.paymentHistory || [];
    inst.paymentHistory.push(rolloverReceipt);

    // Contabiliza os juros recebidos nessa rolagem
    inst.rolloverInterestPaid = (Number(inst.rolloverInterestPaid) || 0) + amount;
    inst.rolloverCount = (Number(inst.rolloverCount) || 0) + 1;
    inst.previousDueDate = inst.dueDate;
    inst.dueDate = nextDate;
    inst.status = 'pending'; // Parcela renovada e ativa para o novo vencimento

    if (loan.status === 'overdue') {
      loan.status = 'active';
    }

    this.save();
    return { installment: inst, receipt: rolloverReceipt };
  }

  /**
   * Indicadores de Rentabilidade e Lucro Real sobre Juros
   */
  getInterestProfitStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const in30Days = addDays(now, 30);
    const in30DaysStr = formatDateForInput(in30Days);
    const todayStr = formatDateForInput(now);

    let capitalNaRua = 0;
    let jurosRecebidosMes = 0;
    let principalRecebidoMes = 0;
    let jurosHistoricoTotal = 0;
    let principalHistoricoTotal = 0;
    let jurosProjetados30Dias = 0;

    const allInstallments = this.data.installments || [];

    allInstallments.forEach(inst => {
      const isPaid = inst.status === 'paid';
      const pendingPrincipal = Number(inst.amortizationAmount || (Number(inst.installmentAmount) - Number(inst.interestAmount || 0)));

      if (!isPaid) {
        capitalNaRua += pendingPrincipal;

        // Projeção dos próximos 30 dias
        if (inst.dueDate >= todayStr && inst.dueDate <= in30DaysStr) {
          jurosProjetados30Dias += Number(inst.interestAmount || 0);
        }
      }

      // Histórico de pagamentos
      if (inst.paymentHistory && inst.paymentHistory.length > 0) {
        inst.paymentHistory.forEach(rec => {
          const recAmount = Number(rec.amount || 0);
          const recDate = new Date(rec.date);
          const isThisMonth = recDate.getMonth() === currentMonth && recDate.getFullYear() === currentYear;

          if (rec.type === 'interest_rollover') {
            // 100% juros líquido
            jurosHistoricoTotal += recAmount;
            if (isThisMonth) {
              jurosRecebidosMes += recAmount;
            }
          } else {
            // Pagamento regular de parcela: desdobra proporcionalmente entre juros e principal
            const instTotal = Number(inst.installmentAmount || 1);
            const instInterest = Number(inst.interestAmount || 0);
            const interestRatio = instTotal > 0 ? (instInterest / instTotal) : 0;
            const portionInterest = recAmount * interestRatio;
            const portionPrincipal = recAmount - portionInterest;

            jurosHistoricoTotal += portionInterest;
            principalHistoricoTotal += portionPrincipal;

            if (isThisMonth) {
              jurosRecebidosMes += portionInterest;
              principalRecebidoMes += portionPrincipal;
            }
          }
        });
      }
    });

    // Rentabilidade real mensal (% sobre o capital na rua)
    const baseCapital = capitalNaRua > 0 ? capitalNaRua : (principalRecebidoMes > 0 ? principalRecebidoMes : 1);
    const rentabilidadeRealMensal = capitalNaRua > 0 ? ((jurosRecebidosMes / baseCapital) * 100) : 0;

    return {
      capitalNaRua,
      jurosRecebidosMes,
      principalRecebidoMes,
      totalRecebidoMes: jurosRecebidosMes + principalRecebidoMes,
      rentabilidadeRealMensal,
      jurosProjetados30Dias,
      jurosHistoricoTotal,
      principalHistoricoTotal
    };
  }

  /**
   * Extrato Financeiro Consolidado da Conta Corrente do Cliente
   * Gera o Livro Razão completo de débitos e créditos com cálculo dinâmico de saldo
   */
  getClientFinancialStatement(clientId) {
    const client = this.getClientById(clientId);
    if (!client) throw new Error('Cliente não encontrado.');

    const clientLoans = (this.data.loans || []).filter(l => l.clientId === clientId);
    const clientInsts = (this.data.installments || []).filter(i => i.clientId === clientId);

    let totalPrincipalEmprestado = 0;
    let totalAmortizado = 0;
    let totalJurosPagos = 0;
    let totalEncargosPagos = 0;
    let totalGeralPago = 0;

    clientLoans.forEach(l => {
      totalPrincipalEmprestado += Number(l.principal || 0);
    });

    const ledgerEntries = [];

    // 1. Lançamentos de Liberação de Empréstimos (Débito inicial do cliente)
    clientLoans.forEach(loan => {
      ledgerEntries.push({
        id: `loan_${loan.id}`,
        date: loan.startDate || loan.createdAt?.split('T')[0] || formatDateForInput(),
        title: `Contrato de Crédito #${loan.id.slice(-6)}`,
        type: 'loan_grant',
        description: `Liberação de principal: ${loan.installmentsCount}x de taxa ${loan.interestRate}%`,
        principalAmount: Number(loan.principal || 0),
        interestAmount: Number(loan.totalInterest || 0),
        amount: Number(loan.principal || 0),
        impact: +1
      });
    });

    // 2. Lançamentos de Pagamentos, Rolagens e Quitações
    clientInsts.forEach(inst => {
      if (inst.paymentHistory && inst.paymentHistory.length > 0) {
        inst.paymentHistory.forEach(rec => {
          const recAmount = Number(rec.amount || 0);
          totalGeralPago += recAmount;

          if (rec.type === 'interest_rollover') {
            totalJurosPagos += recAmount;
            ledgerEntries.push({
              id: rec.id,
              date: rec.date?.split('T')[0] || formatDateForInput(),
              title: `Rolagem de Dívida • Parcela #${inst.number}`,
              type: 'rollover',
              description: `Pagamento exclusivo de juros do ciclo (${rec.method || 'PIX'}). Principal prorrogado.`,
              amount: recAmount,
              impact: 0
            });
          } else {
            // Pagamento regular
            const instTotal = Number(inst.installmentAmount || 1);
            const instInterest = Number(inst.interestAmount || 0);
            const interestRatio = instTotal > 0 ? (instInterest / instTotal) : 0;
            const portionInterest = recAmount * interestRatio;
            const portionAmort = recAmount - portionInterest;

            totalJurosPagos += portionInterest;
            totalAmortizado += portionAmort;
            if (rec.lateChargesPaid) totalEncargosPagos += Number(rec.lateChargesPaid);

            ledgerEntries.push({
              id: rec.id,
              date: rec.date?.split('T')[0] || formatDateForInput(),
              title: `Pagamento • Parcela #${inst.number}`,
              type: 'payment',
              description: `${rec.method || 'PIX'} • Amortização: ${formatBRL(portionAmort)} | Juros: ${formatBRL(portionInterest)}${rec.discount ? ` | Desc: ${formatBRL(rec.discount)}` : ''}`,
              amount: recAmount,
              impact: -1
            });
          }
        });
      }
    });

    // Ordena o livro razão cronologicamente
    ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Saldo devedor atual (apenas parcelas não pagas)
    let saldoDevedorCapital = 0;
    let saldoDevedorTotalComJuros = 0;
    let parcelasAtrasadasQtd = 0;
    let parcelasPendentesQtd = 0;
    const todayStr = formatDateForInput();

    clientInsts.forEach(inst => {
      if (inst.status !== 'paid' && inst.status !== 'renegotiated') {
        const remaining = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
        saldoDevedorTotalComJuros += remaining;
        saldoDevedorCapital += Number(inst.amortizationAmount || remaining);
        if (inst.dueDate < todayStr) {
          parcelasAtrasadasQtd++;
        } else {
          parcelasPendentesQtd++;
        }
      }
    });

    // Próximo vencimento
    const upcomingInsts = clientInsts
      .filter(i => i.status !== 'paid' && i.status !== 'renegotiated' && i.dueDate >= todayStr)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const nextDueDate = upcomingInsts[0]?.dueDate || null;

    return {
      client,
      totalPrincipalEmprestado,
      totalAmortizado,
      totalJurosPagos,
      totalEncargosPagos,
      totalGeralPago,
      saldoDevedorCapital,
      saldoDevedorTotalComJuros,
      parcelasAtrasadasQtd,
      parcelasPendentesQtd,
      nextDueDate,
      ledgerEntries
    };
  }

  /**
   * Módulo de Renegociação de Dívidas
   * Agrupa parcelas vencidas/pendentes de um cliente em um novo contrato formal
   */
  renegotiateLoan({
    clientId,
    installmentIds = [],
    newPrincipal,
    interestRate = 0,
    interestType = 'simple',
    periodicity = 'monthly',
    installmentsCount = 1,
    startDate = formatDateForInput(),
    penaltyRate = 2.0,
    dailyInterestRate = 0.1,
    notes = ''
  }) {
    if (!clientId) throw new Error('Cliente obrigatório para renegociação.');
    if (!installmentIds.length) throw new Error('Nenhuma parcela selecionada para renegociação.');

    const client = this.getClientById(clientId);
    if (!client) throw new Error('Cliente não encontrado.');

    // 1. Marca as parcelas antigas selecionadas como renegociadas
    const nowIso = new Date().toISOString();
    const affectedLoanIds = new Set();

    installmentIds.forEach(id => {
      const inst = this.getInstallmentById(id);
      if (inst) {
        inst.status = 'renegotiated';
        inst.notes = (inst.notes ? inst.notes + ' | ' : '') + `Renegociada em ${formatDateForInput()}`;
        affectedLoanIds.add(inst.loanId);
      }
    });

    // Se todas as parcelas restantes do(s) empréstimo(s) original(is) foram encerradas
    affectedLoanIds.forEach(loanId => {
      const originalLoan = this.getLoanById(loanId);
      if (originalLoan) {
        const remaining = this.data.installments.filter(i => i.loanId === loanId && i.status !== 'paid' && i.status !== 'renegotiated');
        if (remaining.length === 0) {
          originalLoan.status = 'renegotiated';
        }
      }
    });

    // 2. Calcula cronograma do novo empréstimo
    const schedule = calculateAmortizationSchedule({
      principal: Number(newPrincipal),
      interestRate: Number(interestRate),
      interestType,
      periodicity,
      installmentsCount: Number(installmentsCount),
      startDate
    });

    // 3. Cria o novo contrato formal
    const newLoan = {
      id: generateId('loan'),
      clientId,
      principal: Number(newPrincipal),
      interestRate: Number(interestRate),
      interestType,
      periodicity,
      installmentsCount: Number(installmentsCount),
      startDate,
      penaltyRate: Number(penaltyRate),
      dailyInterestRate: Number(dailyInterestRate),
      totalPayable: schedule.totalPayable,
      totalInterest: schedule.totalInterest,
      status: 'active',
      isRenegotiation: true,
      originalInstallmentIds: [...installmentIds],
      notes: notes || `Renegociação formal de ${installmentIds.length} parcela(s) - Vando Motos Locadora LTDA`,
      createdAt: nowIso
    };

    const newInstallments = schedule.installments.map(item => ({
      id: generateId('inst'),
      loanId: newLoan.id,
      clientId,
      number: item.number,
      dueDate: item.dueDate,
      installmentAmount: item.installmentAmount,
      amortizationAmount: item.amortizationAmount,
      interestAmount: item.interestAmount,
      paidAmount: 0,
      paidDate: null,
      status: 'pending',
      paymentHistory: []
    }));

    this.data.loans.unshift(newLoan);
    this.data.installments.push(...newInstallments);
    this.save();

    return { loan: newLoan, installments: newInstallments };
  }

  /**
   * Fechamento de Caixa Diário
   * Retorna os recebimentos e totais por modalidade (PIX, Dinheiro, etc.) para uma data
   */
  getCashRegisterReport(targetDate = formatDateForInput()) {
    const list = [];
    let totalCollected = 0;
    let totalPix = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    let totalOther = 0;

    const allInstallments = this.data.installments || [];

    allInstallments.forEach(inst => {
      if (inst.paymentHistory && inst.paymentHistory.length > 0) {
        inst.paymentHistory.forEach(rec => {
          const recDateOnly = String(rec.date).split('T')[0];
          if (recDateOnly === targetDate) {
            const client = this.getClientById(inst.clientId) || { name: 'Cliente', phone: '' };
            const amount = Number(rec.amount || 0);
            totalCollected += amount;

            const methodNorm = (rec.method || 'PIX').toUpperCase();
            if (methodNorm.includes('PIX')) {
              totalPix += amount;
            } else if (methodNorm.includes('DINHEIRO') || methodNorm.includes('ESPÉCIE')) {
              totalCash += amount;
            } else if (methodNorm.includes('TRANSF') || methodNorm.includes('TED') || methodNorm.includes('DOC')) {
              totalTransfer += amount;
            } else {
              totalOther += amount;
            }

            list.push({
              receiptId: rec.id,
              date: rec.date,
              installmentId: inst.id,
              installmentNumber: inst.number,
              loanId: inst.loanId,
              clientId: inst.clientId,
              clientName: client.name,
              clientPhone: client.phone,
              method: rec.method || 'PIX',
              amount,
              discount: rec.discount || 0,
              lateChargesPaid: rec.lateChargesPaid || 0,
              notes: rec.notes || ''
            });
          }
        });
      }
    });

    list.sort((a, b) => (b.date > a.date ? 1 : -1));

    return {
      date: targetDate,
      totalCollected,
      totalPix,
      totalCash,
      totalTransfer,
      totalOther,
      count: list.length,
      entries: list
    };
  }

  // --- CONFIGURAÇÕES ---
  getSettings() {
    return this.data.settings;
  }

  saveSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
  }

  getGeminiApiKey() {
    return this.data.settings?.geminiApiKey || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';
  }

  setGeminiApiKey(key) {
    this.saveSettings({ geminiApiKey: (key || '').trim() });
  }

  // --- EXPORTAR / IMPORTAR BACKUP ---
  exportBackup() {
    return JSON.stringify(this.data, null, 2);
  }

  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.clients || !parsed.loans || !parsed.installments) {
        throw new Error('Formato de arquivo de backup inválido.');
      }
      this.data = parsed;
      this.save();
      return true;
    } catch (err) {
      throw new Error('Falha ao restaurar dados: ' + err.message);
    }
  }

  // --- SEED DESATIVADO PERMANENTEMENTE ---
  loadSeedData() {
    // REGRA DO USUÁRIO: Proibido criar dados fictícios automaticamente.
    console.warn('[REGRA DO SISTEMA]: Geração de dados fictícios foi desativada permanentemente.');
  }
}

export const state = new StateManager();
