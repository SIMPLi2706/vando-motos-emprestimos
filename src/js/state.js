// src/js/state.js
// Gerenciamento de Estado, Persistência Local (LocalStorage) e Nuvem (Supabase / PostgreSQL)

import { generateId, formatDateForInput, addDays, addMonths } from './utils.js';
import { calculateAmortizationSchedule } from './finance.js';
import { isSupabaseConfigured, pullAllFromSupabase, pushAllToSupabase, setupRealtimeSync } from './supabaseClient.js';

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
  whatsappTemplate: 'Olá, {cliente}! Lembramos que sua parcela nº {parcela_num} no valor de {valor_parcela} venceu/vence em {data_vencimento}.\n\nPara facilitar o pagamento via PIX da Vando Motos Locadora:\nChave PIX (CNPJ): {chave_pix}\nFavorecido: {titular_pix}\n\nApós o pagamento, envie o comprovante por aqui. Obrigado!'
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
      let changed = false;

      if (remote.clients && remote.clients.length > 0) {
        this.data.clients = remote.clients;
        changed = true;
      }
      if (remote.loans && remote.loans.length > 0) {
        this.data.loans = remote.loans;
        changed = true;
      }
      if (remote.installments && remote.installments.length > 0) {
        this.data.installments = remote.installments;
        changed = true;
      }
      if (remote.settings) {
        this.data.settings = { ...this.data.settings, ...remote.settings };
        changed = true;
      }

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.notify();
      }
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
        this.save();
      } else {
        this.loadSeedData();
      }
    } catch (err) {
      console.error('Erro ao carregar dados do LocalStorage:', err);
      this.loadSeedData();
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

  deleteClient(id) {
    // Verifica se possui empréstimos ativos
    const hasActiveLoans = this.data.loans.some(l => l.clientId === id && l.status === 'active');
    if (hasActiveLoans) {
      throw new Error('Não é possível excluir um cliente com empréstimos ativos.');
    }
    this.data.clients = this.data.clients.filter(c => c.id !== id);
    this.save();
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

  deleteLoan(id) {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    this.data.installments = this.data.installments.filter(i => i.loanId !== id);
    this.save();
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

  // --- SEED DE DEMONSTRAÇÃO REALISTA ---
  loadSeedData() {
    const today = new Date();
    const todayStr = formatDateForInput(today);

    const cBrunoId = generateId('cli');
    const c1Id = generateId('cli');
    const c2Id = generateId('cli');
    const c3Id = generateId('cli');

    this.data.clients = [
      {
        id: cBrunoId,
        name: 'BRUNO VASQUEZ CASTRO',
        cpf: '025.653.052-14',
        phone: '(69) 99234-5678',
        address: 'RUA DAS CRIANÇAS N:4516 B:FLRESTA',
        creditLimit: 20000,
        notes: 'Contrato de 24 parcelas de R$ 600,00 - Negociação Porto Velho',
        createdAt: '2026-09-18T10:00:00.000Z'
      },
      {
        id: c1Id,
        name: 'Carlos Silva Santos',
        cpf: '123.456.789-00',
        phone: '(11) 98765-4321',
        address: 'Rua das Flores, 140 - São Paulo, SP',
        creditLimit: 15000,
        notes: 'Comerciante local, pontual no pagamento.',
        createdAt: new Date().toISOString()
      },
      {
        id: c2Id,
        name: 'Mariana Souza Oliveira',
        cpf: '234.567.890-11',
        phone: '(21) 99876-5432',
        address: 'Av. Atlântica, 420 - Rio de Janeiro, RJ',
        creditLimit: 8000,
        notes: 'Autônoma, vendas online.',
        createdAt: new Date().toISOString()
      },
      {
        id: c3Id,
        name: 'Roberto Ferreira Dias',
        cpf: '345.678.901-22',
        phone: '(31) 97654-3210',
        address: 'Rua Bahia, 55 - Belo Horizonte, MG',
        creditLimit: 20000,
        notes: 'Oficina mecânica, cliente antigo.',
        createdAt: new Date().toISOString()
      }
    ];

    this.data.loans = [];
    this.data.installments = [];
    this.data.settings = { ...DEFAULT_SETTINGS };

    // EMPRÉSTIMO PRINCIPAL: BRUNO VASQUEZ CASTRO - 24 parcelas de R$ 600,00
    const loanBrunoId = generateId('loan');
    this.data.loans.push({
      id: loanBrunoId,
      clientId: cBrunoId,
      principal: 14400,
      interestRate: 0,
      interestType: 'simple',
      periodicity: 'monthly',
      installmentsCount: 24,
      startDate: '2026-09-18',
      penaltyRate: 2,
      dailyInterestRate: 0.1,
      totalPayable: 14400.00,
      totalInterest: 0.00,
      status: 'active',
      notes: 'Negociação formal de 24 parcelas promissórias de R$ 600,00',
      createdAt: '2026-09-18T10:00:00.000Z'
    });

    // Gera as 24 parcelas exatas das imagens
    const brunoDates = [
      '2026-12-18', '2027-01-18', '2027-02-18', '2027-03-18', '2027-04-18', '2027-05-18',
      '2027-06-18', '2027-07-18', '2027-08-18', '2027-09-18', '2027-10-18', '2027-11-18',
      '2027-12-18', '2028-01-18', '2028-02-18', '2028-03-18', '2028-04-18', '2028-05-18',
      '2028-06-18', '2028-07-18', '2028-08-18', '2028-09-18', '2028-10-18', '2028-11-18'
    ];

    brunoDates.forEach((dueDateStr, idx) => {
      this.data.installments.push({
        id: generateId('inst'),
        loanId: loanBrunoId,
        clientId: cBrunoId,
        number: idx + 1,
        dueDate: dueDateStr,
        installmentAmount: 600.00,
        amortizationAmount: 600.00,
        interestAmount: 0.00,
        paidAmount: 0,
        paidDate: null,
        status: 'pending',
        paymentHistory: []
      });
    });

    // Empréstimo 2 (Secundário para variedade no dashboard)
    const loan1Id = generateId('loan');
    const l1Start = addMonths(today, -2).toISOString().split('T')[0];
    this.data.loans.push({
      id: loan1Id,
      clientId: c1Id,
      principal: 5000,
      interestRate: 10,
      interestType: 'price',
      periodicity: 'monthly',
      installmentsCount: 5,
      startDate: l1Start,
      penaltyRate: 2,
      dailyInterestRate: 0.1,
      totalPayable: 6594.94,
      totalInterest: 1594.94,
      status: 'active',
      notes: 'Investimento para estoque da loja',
      createdAt: new Date().toISOString()
    });

    const l1Dates = [
      addMonths(today, -2).toISOString().split('T')[0],
      addMonths(today, -1).toISOString().split('T')[0],
      todayStr,
      addMonths(today, 1).toISOString().split('T')[0],
      addMonths(today, 2).toISOString().split('T')[0]
    ];

    l1Dates.forEach((d, idx) => {
      const isPaid = idx < 2;
      this.data.installments.push({
        id: generateId('inst'),
        loanId: loan1Id,
        clientId: c1Id,
        number: idx + 1,
        dueDate: d,
        installmentAmount: 1318.99,
        amortizationAmount: 850.00,
        interestAmount: 468.99,
        paidAmount: isPaid ? 1318.99 : 0,
        paidDate: isPaid ? d : null,
        status: isPaid ? 'paid' : 'pending',
        paymentHistory: isPaid ? [{
          id: generateId('rec'),
          date: d,
          amount: 1318.99,
          method: 'PIX',
          notes: 'Pagamento pontual via PIX'
        }] : []
      });
    });

    // Empréstimo 2: Mariana Souza - R$ 3.000 em 3x Juros Simples
    // 1 paga, 1 atrasada há 4 dias
    const loan2Id = generateId('loan');
    this.data.loans.push({
      id: loan2Id,
      clientId: c2Id,
      principal: 3000,
      interestRate: 12,
      interestType: 'simple',
      periodicity: 'monthly',
      installmentsCount: 3,
      startDate: addMonths(today, -1).toISOString().split('T')[0],
      penaltyRate: 2,
      dailyInterestRate: 0.1,
      totalPayable: 4080.00,
      totalInterest: 1080.00,
      status: 'active',
      notes: 'Capital de giro emergencial',
      createdAt: new Date().toISOString()
    });

    const l2Dates = [
      addMonths(today, -1).toISOString().split('T')[0],
      addDays(today, -4).toISOString().split('T')[0], // Atrasada há 4 dias!
      addMonths(today, 1).toISOString().split('T')[0]
    ];

    l2Dates.forEach((d, idx) => {
      const isPaid = idx === 0;
      this.data.installments.push({
        id: generateId('inst'),
        loanId: loan2Id,
        clientId: c2Id,
        number: idx + 1,
        dueDate: d,
        installmentAmount: 1360.00,
        amortizationAmount: 1000.00,
        interestAmount: 360.00,
        paidAmount: isPaid ? 1360.00 : 0,
        paidDate: isPaid ? d : null,
        status: isPaid ? 'paid' : 'pending',
        paymentHistory: isPaid ? [{
          id: generateId('rec'),
          date: d,
          amount: 1360.00,
          method: 'Transferência',
          notes: 'Baixa efetuada'
        }] : []
      });
    });

    // Empréstimo 3: Roberto Ferreira - R$ 12.000 em 6x Tabela SAC
    // 1 atrasada há 12 dias!
    const loan3Id = generateId('loan');
    this.data.loans.push({
      id: loan3Id,
      clientId: c3Id,
      principal: 12000,
      interestRate: 8,
      interestType: 'sac',
      periodicity: 'monthly',
      installmentsCount: 6,
      startDate: addDays(today, -42).toISOString().split('T')[0],
      penaltyRate: 2,
      dailyInterestRate: 0.1,
      totalPayable: 15360.00,
      totalInterest: 3360.00,
      status: 'active',
      notes: 'Compra de elevador automotivo',
      createdAt: new Date().toISOString()
    });

    const l3Dates = [
      addDays(today, -12).toISOString().split('T')[0], // Atrasada há 12 dias
      addDays(today, 18).toISOString().split('T')[0],
      addDays(today, 48).toISOString().split('T')[0],
      addDays(today, 78).toISOString().split('T')[0],
      addDays(today, 108).toISOString().split('T')[0],
      addDays(today, 138).toISOString().split('T')[0]
    ];

    l3Dates.forEach((d, idx) => {
      this.data.installments.push({
        id: generateId('inst'),
        loanId: loan3Id,
        clientId: c3Id,
        number: idx + 1,
        dueDate: d,
        installmentAmount: 2960.00 - (idx * 160),
        amortizationAmount: 2000.00,
        interestAmount: 960.00 - (idx * 160),
        paidAmount: 0,
        paidDate: null,
        status: 'pending',
        paymentHistory: []
      });
    });

    this.save();
  }
}

export const state = new StateManager();
