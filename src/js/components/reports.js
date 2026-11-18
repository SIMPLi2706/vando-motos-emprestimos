// src/js/components/reports.js
// Relatórios Financeiros com Gráficos em HTML5 Canvas (Sem Dependências Externas)
// Gráfico 1: Barra - Receita mensal (últimos 6 meses)
// Gráfico 2: Donut - Status das parcelas (Pagas vs Pendentes vs Atrasadas)
// Gráfico 3: Linha - Capital na rua ao longo do tempo

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, escapeHtml } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
import { openMonthlyReportModal } from './pdfExport.js';
import { icon } from '../icons.js';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cores do Design System da Vando Motos
const THEME = {
  yellow: '#f5c518',
  yellowLight: '#fde047',
  yellowDark: '#ca8a04',
  yellowGlow: 'rgba(245, 197, 24, 0.35)',
  green: '#10b981',
  greenLight: '#34d399',
  greenGlow: 'rgba(16, 185, 129, 0.25)',
  red: '#f43f5e',
  redLight: '#fb7185',
  redGlow: 'rgba(244, 63, 94, 0.25)',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  bg0: '#020304',
  bg1: '#080a0f',
  bg2: '#0f1117',
  bg3: '#181a22',
  text100: '#ffffff',
  text200: '#e2e8f0',
  text300: '#94a3b8',
  text400: '#64748b',
  borderSoft: 'rgba(255, 255, 255, 0.07)',
  borderMid: 'rgba(245, 197, 24, 0.16)'
};

/**
 * Renderiza a página completa de Relatórios Financeiros Analíticos
 */
export function renderReports() {
  const container = document.createElement('div');
  container.className = 'reports-view animate-fade-in';

  // Carrega dados do state
  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();
  const cashFlows = state.getCashFlows ? state.getCashFlows() : (state.data.cashFlows || []);
  const operators = state.getOperators ? state.getOperators() : [];
  const settings = state.getSettings();
  const todayDate = new Date();
  const todayStr = formatDateForInput(todayDate);
  const proj = state.getReceivablesProjection();

  // Score distribution inicial
  const scoreDist = { A: 0, B: 0, C: 0, D: 0 };
  clients.forEach(c => {
    const s = state.getClientScore(c.id);
    if (scoreDist[s.grade] !== undefined) scoreDist[s.grade]++;
  });
  const totalScored = clients.length || 1;

  // Estado dos Filtros do Relatório
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let activePeriod = 'month'; // 'today', 'yesterday', '7d', '15d', 'month', 'lastMonth', 'year', 'all', 'custom'
  let filterStartDate = formatDateForInput(firstDayOfMonth);
  let filterEndDate = todayStr;
  let filterClientId = 'all';
  let filterStatus = 'all';
  let filterMethod = 'all';
  let filterRecordType = 'all';
  let filterOperator = 'all';
  let filterSearch = '';
  let activeTableTab = 'all'; // 'all', 'payments', 'loans', 'overdue', 'cashflow'
  let currentPage = 1;
  const pageSize = 20;

  // Compila todos os registros em um ledger estruturado
  function compileAllRecords() {
    const records = [];

    // 1. Recebimentos de parcelas (histórico de baixas)
    installments.forEach(inst => {
      const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente', phone: '' };
      const loan = loans.find(l => l.id === inst.loanId) || { installmentsCount: 1, interestRate: 0 };
      const score = state.getClientScore(client.id);

      if (inst.paymentHistory && inst.paymentHistory.length > 0) {
        inst.paymentHistory.forEach((rec, idx) => {
          const paidDate = String(rec.date || '').split('T')[0] || inst.paidDate || inst.dueDate;
          const recAmount = Number(rec.amount || 0);
          const amort = Number(inst.amortizationAmount || 0);
          const interestPortion = Math.max(0, recAmount - amort);
          records.push({
            id: `pay_${inst.id}_${idx}`,
            date: paidDate,
            rawDate: rec.date || inst.paidDate || inst.dueDate,
            type: 'payment',
            typeLabel: 'Recebimento',
            typeColor: 'var(--green)',
            clientId: inst.clientId,
            clientName: client.name,
            clientPhone: client.phone || '',
            clientScore: score.grade,
            contractId: inst.loanId,
            installmentNumber: inst.number,
            totalInstallments: loan.installmentsCount || 1,
            method: rec.method || inst.paidMethod || 'PIX',
            principalAmount: amort,
            interestAmount: interestPortion,
            lateChargesPaid: Number(rec.lateChargesPaid || 0),
            discountAmount: Number(rec.discount || 0),
            totalAmount: recAmount,
            status: 'paid',
            statusLabel: 'Pago',
            notes: rec.notes || inst.notes || '',
            operatorName: rec.operatorName || '',
            installmentId: inst.id,
            loanId: inst.loanId
          });
        });
      } else if (inst.status === 'paid') {
        const paidDate = String(inst.paidDate || '').split('T')[0] || inst.dueDate;
        const paidVal = Number(inst.paidAmount || inst.installmentAmount || 0);
        const amort = Number(inst.amortizationAmount || 0);
        const interestPortion = Math.max(0, paidVal - amort);
        records.push({
          id: `pay_${inst.id}_full`,
          date: paidDate,
          rawDate: inst.paidDate || inst.dueDate,
          type: 'payment',
          typeLabel: 'Recebimento',
          typeColor: 'var(--green)',
          clientId: inst.clientId,
          clientName: client.name,
          clientPhone: client.phone || '',
          clientScore: score.grade,
          contractId: inst.loanId,
          installmentNumber: inst.number,
          totalInstallments: loan.installmentsCount || 1,
          method: inst.paidMethod || 'PIX',
          principalAmount: amort,
          interestAmount: interestPortion,
          lateChargesPaid: 0,
          discountAmount: 0,
          totalAmount: paidVal,
          status: 'paid',
          statusLabel: 'Pago',
          notes: inst.notes || '',
          operatorName: '',
          installmentId: inst.id,
          loanId: inst.loanId
        });
      }

      // Parcela em aberto ou em atraso
      if (inst.status !== 'paid' && inst.status !== 'renegotiated') {
        const dueNorm = String(inst.dueDate || '').split('T')[0];
        const isOverdue = dueNorm < todayStr;
        const pendingVal = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
        const amort = Number(inst.amortizationAmount || pendingVal);
        const interestPortion = Number(inst.interestAmount || 0);

        let finalAmount = pendingVal;
        let daysOverdue = 0;
        if (isOverdue) {
          try {
            const charges = calculateLateCharges(
              inst,
              todayDate,
              loan.penaltyRate || settings.defaultPenaltyRate,
              loan.dailyInterestRate || settings.defaultDailyRate
            );
            finalAmount = charges.totalUpdatedAmount;
            daysOverdue = charges.daysOverdue;
          } catch (e) {
            finalAmount = pendingVal;
          }
        }

        records.push({
          id: `inst_${inst.id}`,
          date: dueNorm,
          rawDate: inst.dueDate,
          type: isOverdue ? 'overdue' : 'pending',
          typeLabel: isOverdue ? `Em Atraso (${daysOverdue}d)` : 'A Vencer',
          typeColor: isOverdue ? 'var(--red)' : 'var(--yellow)',
          clientId: inst.clientId,
          clientName: client.name,
          clientPhone: client.phone || '',
          clientScore: score.grade,
          contractId: inst.loanId,
          installmentNumber: inst.number,
          totalInstallments: loan.installmentsCount || 1,
          method: inst.promisedDate ? 'Promessa Agendada' : 'No Prazo',
          principalAmount: amort,
          interestAmount: interestPortion,
          lateChargesPaid: 0,
          discountAmount: 0,
          totalAmount: finalAmount,
          status: isOverdue ? 'overdue' : (inst.promisedDate ? 'promised' : 'pending'),
          statusLabel: isOverdue ? 'Atrasado' : (inst.promisedDate ? `Promessa ${formatDate(inst.promisedDate)}` : 'Em Aberto'),
          notes: inst.promiseNote || inst.notes || '',
          operatorName: '',
          installmentId: inst.id,
          loanId: inst.loanId
        });
      }
    });

    // 2. Novos Empréstimos Concedidos (Saídas de Capital)
    loans.forEach(loan => {
      const client = clients.find(c => c.id === loan.clientId) || { name: 'Cliente', phone: '' };
      const score = state.getClientScore(client.id);
      const loanDate = String(loan.startDate || loan.createdAt || '').split('T')[0] || todayStr;
      records.push({
        id: `loan_${loan.id}`,
        date: loanDate,
        rawDate: loan.createdAt || loan.startDate,
        type: 'loan',
        typeLabel: 'Novo Empréstimo',
        typeColor: 'var(--yellow)',
        clientId: loan.clientId,
        clientName: client.name,
        clientPhone: client.phone || '',
        clientScore: score.grade,
        contractId: loan.id,
        installmentNumber: '-',
        totalInstallments: loan.installmentsCount || 1,
        method: loan.disbursementMethod || 'Dinheiro',
        principalAmount: Number(loan.principal || 0),
        interestAmount: Number(loan.totalInterest || 0),
        lateChargesPaid: 0,
        discountAmount: 0,
        totalAmount: Number(loan.totalPayable || loan.principal || 0),
        status: loan.status === 'paid' ? 'paid' : 'active',
        statusLabel: loan.status === 'paid' ? 'Quitado' : 'Ativo',
        notes: loan.notes || (loan.guarantee?.description ? `Garantia: ${loan.guarantee.description}` : ''),
        operatorName: loan.operatorName || '',
        loanId: loan.id
      });
    });

    // 3. Movimentações Manuais de Caixa (Despesas, Sangrias, Aportes)
    cashFlows.forEach(cf => {
      const cfDate = String(cf.date || cf.createdAt || '').split('T')[0] || todayStr;
      records.push({
        id: `cf_${cf.id}`,
        date: cfDate,
        rawDate: cf.createdAt || cf.date,
        type: cf.type === 'outflow' ? 'cash_out' : 'cash_in',
        typeLabel: cf.type === 'outflow' ? 'Saída de Caixa' : 'Aporte de Caixa',
        typeColor: cf.type === 'outflow' ? 'var(--red)' : 'var(--green)',
        clientId: '',
        clientName: cf.category || (cf.type === 'outflow' ? 'Despesa' : 'Aporte'),
        clientPhone: '',
        clientScore: '-',
        contractId: '-',
        installmentNumber: '-',
        totalInstallments: '-',
        method: cf.method || 'Dinheiro',
        principalAmount: Number(cf.amount || 0),
        interestAmount: 0,
        lateChargesPaid: 0,
        discountAmount: 0,
        totalAmount: Number(cf.amount || 0),
        status: 'completed',
        statusLabel: cf.type === 'outflow' ? 'Despesa Paga' : 'Entrada em Caixa',
        notes: cf.description || '',
        operatorName: cf.operatorName || '',
        cashFlowId: cf.id
      });
    });

    // Ordena por data decrescente
    records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return records;
  }

  // Aplica todos os filtros
  function filterRecordsList(records) {
    const sTerm = filterSearch.toLowerCase().trim();

    return records.filter(r => {
      // 1. Data início e fim
      if (filterStartDate && r.date < filterStartDate) return false;
      if (filterEndDate && r.date > filterEndDate) return false;

      // 2. Cliente
      if (filterClientId !== 'all' && r.clientId !== filterClientId) return false;

      // 3. Status
      if (filterStatus !== 'all') {
        if (filterStatus === 'paid' && r.status !== 'paid') return false;
        if (filterStatus === 'pending' && r.status !== 'pending') return false;
        if (filterStatus === 'overdue' && r.status !== 'overdue') return false;
        if (filterStatus === 'promised' && r.status !== 'promised') return false;
        if (filterStatus === 'active' && r.status !== 'active') return false;
      }

      // 4. Meio de pagamento
      if (filterMethod !== 'all') {
        const m = String(r.method || '').toUpperCase();
        if (!m.includes(filterMethod.toUpperCase())) return false;
      }

      // 5. Tipo de Registro
      if (filterRecordType !== 'all') {
        if (filterRecordType === 'payments' && r.type !== 'payment') return false;
        if (filterRecordType === 'loans' && r.type !== 'loan') return false;
        if (filterRecordType === 'overdue' && r.type !== 'overdue') return false;
        if (filterRecordType === 'pending' && r.type !== 'pending') return false;
        if (filterRecordType === 'cashflow' && r.type !== 'cash_out' && r.type !== 'cash_in') return false;
      }

      // 6. Sub-aba da tabela
      if (activeTableTab === 'payments' && r.type !== 'payment') return false;
      if (activeTableTab === 'loans' && r.type !== 'loan') return false;
      if (activeTableTab === 'overdue' && r.type !== 'overdue') return false;
      if (activeTableTab === 'cashflow' && r.type !== 'cash_out' && r.type !== 'cash_in') return false;

      // 7. Operador
      if (filterOperator !== 'all') {
        if (r.operatorName && !r.operatorName.toLowerCase().includes(filterOperator.toLowerCase())) return false;
      }

      // 8. Busca textual
      if (sTerm) {
        const fullTxt = `${r.clientName} ${r.clientPhone} ${r.contractId} ${r.notes} ${r.typeLabel} ${r.method} ${formatBRL(r.totalAmount)}`.toLowerCase();
        if (!fullTxt.includes(sTerm)) return false;
      }

      return true;
    });
  }

  // Gera HTML da estrutura principal
  container.innerHTML = `
    <!-- Topo de Ações do Relatório -->
    <div class="reports-header-bar">
      <div>
        <h2 class="reports-page-title" style="display: flex; align-items: center; gap: 8px;">
          ${icon('chart', 20)} Relatórios Financeiros Analíticos
        </h2>
        <p style="font-size: 0.8rem; color: var(--text-400); margin-top: 2px;">
          Visão completa de contratos, recebimentos, juros arrecadados, inadimplência e livro de registros
        </p>
      </div>
      <div class="reports-actions">
        <button class="btn btn-secondary btn-sm" id="btn-export-csv" title="Exportar dados filtrados em formato CSV">
          ${icon('download', 14)} Exportar CSV
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-print-reports" title="Imprimir Relatório Analítico">
          ${icon('print', 14)} Imprimir
        </button>
        <button class="btn btn-primary btn-sm" id="btn-generate-pdf-report" title="Gerar Relatório Oficial Mensal em PDF">
          ${icon('fileText', 14)} Relatório PDF
        </button>
      </div>
    </div>

    <!-- PAINEL MULTICRITÉRIO DE FILTROS AVANÇADOS -->
    <div class="card reports-filter-card" style="margin-bottom: 20px; background: linear-gradient(180deg, rgba(26, 30, 42, 0.85) 0%, rgba(17, 20, 28, 0.95) 100%);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--yellow);">${icon('filter', 16)}</span>
          <strong style="font-size: 0.92rem; color: #fff;">Filtros & Seleção de Período</strong>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="rep-btn-reset-filters" style="font-size: 0.76rem; padding: 4px 10px;">
          ${icon('refresh', 12)} Limpar Filtros
        </button>
      </div>

      <!-- Linha 1: Atalhos Rápidos de Período -->
      <div class="filter-periods-wrap" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;">
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="today">Hoje</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="yesterday">Ontem</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="7d">Últimos 7 dias</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="15d">15 dias</button>
        <button type="button" class="btn btn-primary btn-sm rep-period-chip active" data-period="month">Este Mês</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="lastMonth">Mês Passado</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="year">Ano Atual</button>
        <button type="button" class="btn btn-secondary btn-sm rep-period-chip" data-period="all">Todo o Período</button>
      </div>

      <!-- Linha 2: Grade de Filtros Selecionáveis -->
      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Data Início</label>
          <input type="date" class="form-control" id="rep-filter-start" value="${filterStartDate}">
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Data Fim</label>
          <input type="date" class="form-control" id="rep-filter-end" value="${filterEndDate}">
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Cliente</label>
          <select class="form-control" id="rep-filter-client">
            <option value="all">Todos os Clientes</option>
            ${clients.map(c => `
              <option value="${c.id}">${escapeHtml(c.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Situação / Status</label>
          <select class="form-control" id="rep-filter-status">
            <option value="all">Todas as Situações</option>
            <option value="paid">Pagas / Quitadas</option>
            <option value="pending">A Vencer (No Prazo)</option>
            <option value="overdue">Em Atraso / Vencidas</option>
            <option value="promised">Com Promessa Agendada</option>
            <option value="active">Contratos Ativos</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Meio de Pagamento</label>
          <select class="form-control" id="rep-filter-method">
            <option value="all">Todos os Meios</option>
            <option value="PIX">PIX</option>
            <option value="Dinheiro">Dinheiro / Espécie</option>
            <option value="Transferência">Transferência / TED</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Tipo de Registro</label>
          <select class="form-control" id="rep-filter-type">
            <option value="all">Todos os Registros</option>
            <option value="payments">Recebimentos de Parcelas</option>
            <option value="loans">Novos Empréstimos (Saídas)</option>
            <option value="overdue">Parcelas em Atraso</option>
            <option value="pending">Parcelas a Vencer</option>
            <option value="cashflow">Movimentações de Caixa</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Operador / Cobrador</label>
          <select class="form-control" id="rep-filter-operator">
            <option value="all">Todos os Operadores</option>
            ${operators.map(op => `
              <option value="${escapeHtml(op.name)}">${escapeHtml(op.name)} (${op.role === 'admin' ? 'Admin' : 'Cobrador'})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Busca Rápida</label>
          <input type="text" class="form-control" id="rep-filter-search" placeholder="Nome, contrato, anotação...">
        </div>
      </div>
    </div>

    <!-- GRADE DE KPIS DINÂMICOS DO FILTRO -->
    <div id="rep-kpis-container"></div>

    <!-- PREVISÃO DE RECEBÍVEIS & DISTRIBUIÇÃO DE SCORE -->
    <div class="dashboard-columns-grid" style="margin-bottom: 20px;">
      <div class="card" style="margin-bottom: 0;">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('trendingUp', 17)} Previsão de Recebíveis (Fluxo Futuro)</h3>
            <p class="card-subtitle">Entradas programadas em 7, 15 e 30 dias + retorno de capital</p>
          </div>
        </div>
        <div class="proj-grid">
          <div class="proj-box">
            <span class="proj-label">Próximos 7 dias</span>
            <strong class="proj-val text-yellow">${formatBRL(proj.next7Days)}</strong>
          </div>
          <div class="proj-box">
            <span class="proj-label">Próximos 15 dias</span>
            <strong class="proj-val text-green">${formatBRL(proj.next15Days)}</strong>
          </div>
          <div class="proj-box">
            <span class="proj-label">Próximos 30 dias</span>
            <strong class="proj-val text-green">${formatBRL(proj.next30Days)}</strong>
            <span class="proj-sub">Cap: ${formatBRL(proj.next30Principal)} | Jur: ${formatBRL(proj.next30Interest)}</span>
          </div>
          <div class="proj-box">
            <span class="proj-label">Vencido em Aberto</span>
            <strong class="proj-val text-danger">${formatBRL(proj.overdueTotal)}</strong>
          </div>
        </div>
        <div class="proj-summary-bar">
          <span>Capital Total Liberado: <strong>${formatBRL(proj.totalPrincipalDisbursed)}</strong></span>
          <span>Saldo Global a Receber: <strong class="text-green">${formatBRL(proj.totalOpenBalance)}</strong></span>
        </div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('award', 17)} Distribuição de Score da Carteira</h3>
            <p class="card-subtitle">Classificação automática A/B/C/D (${clients.length} cliente(s))</p>
          </div>
        </div>
        <div class="score-dist-list">
          ${[
            { key: 'A', name: 'Classe A (Ótimo)', color: 'var(--green)' },
            { key: 'B', name: 'Classe B (Regular)', color: 'var(--yellow)' },
            { key: 'C', name: 'Classe C (Atenção)', color: 'var(--amber)' },
            { key: 'D', name: 'Classe D (Alto Risco)', color: 'var(--red)' }
          ].map(tier => {
            const count = scoreDist[tier.key] || 0;
            const pct = Math.round((count / totalScored) * 100);
            return `
              <div class="score-dist-row">
                <div class="score-dist-head">
                  <span style="color: ${tier.color}; font-weight: 700;">${tier.name}</span>
                  <span><strong>${count}</strong> cliente(s) (${pct}%)</span>
                </div>
                <div class="score-dist-bar">
                  <div class="score-dist-fill" style="width: ${pct}%; background: ${tier.color};"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- GRADE PRINCIPAL DE GRÁFICOS EM CANVAS -->
    <div class="reports-charts-grid">
      
      <!-- CARD 1: GRÁFICO DE BARRAS - RECEITA MENSAL (ÚLTIMOS 6 MESES) -->
      <div class="card chart-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('chart', 18)} Receita Mensal Realizada</h3>
            <p class="card-subtitle">Soma das parcelas quitadas mês a mês (últimos 6 meses)</p>
          </div>
          <span class="chart-badge">Últimos 6 meses</span>
        </div>
        <div class="chart-canvas-wrapper" id="bar-chart-container">
          <canvas id="canvas-receita-mensal" class="responsive-canvas"></canvas>
          <div class="canvas-tooltip" id="tooltip-receita-mensal"></div>
        </div>
        <div class="chart-card-footer" id="bar-chart-summary"></div>
      </div>

      <!-- CARD 2: GRÁFICO DE DONUT - STATUS DAS PARCELAS -->
      <div class="card chart-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('pieChart', 18)} Distribuição das Parcelas</h3>
            <p class="card-subtitle">Proporção de parcelas pagas, pendentes e em atraso</p>
          </div>
          <span class="chart-badge" id="donut-total-badge">${installments.length} parcelas</span>
        </div>
        <div class="donut-card-layout" id="donut-chart-container">
          <div class="donut-canvas-box">
            <canvas id="canvas-status-parcelas" class="responsive-canvas"></canvas>
          </div>
          <div class="donut-chart-legend" id="donut-legend-container"></div>
        </div>
      </div>

      <!-- CARD 3: GRÁFICO DE LINHA - CAPITAL NA RUA AO LONGO DO TEMPO -->
      <div class="card chart-card chart-card--full-width">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('trendingUp', 18)} Evolução do Capital na Rua</h3>
            <p class="card-subtitle">Volume de capital financiado ativo no mercado ao longo do tempo</p>
          </div>
          <span class="chart-badge" style="color: var(--yellow);">Saldo em Aberto</span>
        </div>
        <div class="chart-canvas-wrapper" id="line-chart-container">
          <canvas id="canvas-capital-rua" class="responsive-canvas"></canvas>
          <div class="canvas-tooltip" id="tooltip-capital-rua"></div>
        </div>
        <div class="chart-card-footer" id="line-chart-summary"></div>
      </div>

    </div>

    <!-- LIVRO DE REGISTROS & TRANSAÇÕES ANALÍTICAS (TABELA COMPLETA COM FILTROS) -->
    <div class="card" style="margin-top: 20px;">
      <div class="card-header" style="align-items: center;">
        <div>
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            ${icon('fileText', 18)} Livro de Registros & Transações Analíticas
          </h3>
          <p class="card-subtitle" id="rep-records-summary-txt">Carregando registros detalhados...</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="btn-export-csv-table">
            ${icon('download', 13)} Baixar CSV
          </button>
        </div>
      </div>

      <!-- Abas Rápidas de Tipo de Registro -->
      <div class="tabs-bar" id="rep-table-tabs" style="margin-bottom: 12px;">
        <button class="tab-btn active" data-tab="all">Todos (<span id="count-tab-all">0</span>)</button>
        <button class="tab-btn" data-tab="payments">Recebimentos (<span id="count-tab-pay">0</span>)</button>
        <button class="tab-btn" data-tab="loans">Novos Empréstimos (<span id="count-tab-loans">0</span>)</button>
        <button class="tab-btn" data-tab="overdue">Em Atraso (<span id="count-tab-overdue">0</span>)</button>
        <button class="tab-btn" data-tab="cashflow">Caixa / Despesas (<span id="count-tab-cf">0</span>)</button>
      </div>

      <!-- Tabela Analítica -->
      <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
        <table class="table table-mobile-card-view" id="rep-main-table">
          <thead>
            <tr>
              <th>Data / Venc.</th>
              <th>Cliente / Razão</th>
              <th>Tipo de Registro</th>
              <th>Contrato / Ref</th>
              <th>Meio</th>
              <th>Principal</th>
              <th>Juros / Multa</th>
              <th>Valor Total</th>
              <th>Status</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody id="rep-table-tbody">
            <!-- Inserido dinamicamente -->
          </tbody>
        </table>
      </div>

      <!-- Paginação e Rodapé da Tabela -->
      <div id="rep-table-pagination" style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; margin-top: 10px; border-top: 1px solid var(--border-soft); flex-wrap: wrap; gap: 10px;">
        <div style="font-size: 0.8rem; color: var(--text-400);" id="rep-page-info">
          Mostrando página 1
        </div>
        <div style="display: flex; gap: 6px;" id="rep-page-controls">
          <button class="btn btn-secondary btn-sm" id="rep-prev-page" disabled>Anterior</button>
          <button class="btn btn-secondary btn-sm" id="rep-next-page">Próximo</button>
        </div>
      </div>
    </div>
  `;

  // Função para recalcular e atualizar toda a visão filtrada
  let lastFilteredRecords = [];

  function updateView() {
    const allRecords = compileAllRecords();
    const filtered = filterRecordsList(allRecords);
    lastFilteredRecords = filtered;

    // Atualiza contadores das abas da tabela
    const countAll = allRecords.length;
    const countPay = allRecords.filter(r => r.type === 'payment').length;
    const countLoans = allRecords.filter(r => r.type === 'loan').length;
    const countOverdue = allRecords.filter(r => r.type === 'overdue').length;
    const countCf = allRecords.filter(r => r.type === 'cash_out' || r.type === 'cash_in').length;

    const elCountAll = container.querySelector('#count-tab-all');
    const elCountPay = container.querySelector('#count-tab-pay');
    const elCountLoans = container.querySelector('#count-tab-loans');
    const elCountOverdue = container.querySelector('#count-tab-overdue');
    const elCountCf = container.querySelector('#count-tab-cf');

    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountPay) elCountPay.textContent = countPay;
    if (elCountLoans) elCountLoans.textContent = countLoans;
    if (elCountOverdue) elCountOverdue.textContent = countOverdue;
    if (elCountCf) elCountCf.textContent = countCf;

    // Métricas dos registros filtrados
    let sumInflows = 0;
    let sumOutflows = 0;
    let sumInterestProfit = 0;
    let sumDiscounts = 0;
    let sumOpenReceivables = 0;
    let sumOverdue = 0;
    let countOverdueInst = 0;
    let countPaidInst = 0;

    filtered.forEach(r => {
      if (r.type === 'payment') {
        sumInflows += Number(r.totalAmount || 0);
        sumInterestProfit += Number(r.interestAmount || 0) + Number(r.lateChargesPaid || 0);
        sumDiscounts += Number(r.discountAmount || 0);
        countPaidInst++;
      } else if (r.type === 'loan') {
        sumOutflows += Number(r.principalAmount || 0);
      } else if (r.type === 'cash_in') {
        sumInflows += Number(r.totalAmount || 0);
      } else if (r.type === 'cash_out') {
        sumOutflows += Number(r.totalAmount || 0);
      } else if (r.type === 'pending') {
        sumOpenReceivables += Number(r.totalAmount || 0);
      } else if (r.type === 'overdue') {
        sumOverdue += Number(r.totalAmount || 0);
        countOverdueInst++;
      }
    });

    const activeTotalCount = countPaidInst + countOverdueInst;
    const filterInadimplenciaRate = activeTotalCount > 0 ? ((countOverdueInst / activeTotalCount) * 100).toFixed(1) : '0.0';

    // Renderiza os Cards de KPIs Atualizados
    const kpisBox = container.querySelector('#rep-kpis-container');
    if (kpisBox) {
      kpisBox.innerHTML = `
        <div class="kpi-grid" style="margin-bottom: 20px;">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Receita Realizada</span>
              <div class="kpi-icon-wrap kpi-icon-emerald">
                ${icon('checkCircle', 16)}
              </div>
            </div>
            <div class="kpi-value text-green">${formatBRL(sumInflows)}</div>
            <div class="kpi-footer">
              <span>${countPaidInst} parcela(s) / entradas no filtro</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Capital Emprestado</span>
              <div class="kpi-icon-wrap kpi-icon-amber">
                ${icon('dollar', 16)}
              </div>
            </div>
            <div class="kpi-value text-yellow">${formatBRL(sumOutflows)}</div>
            <div class="kpi-footer">
              <span>Saídas e concessões no período</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Lucro / Juros Realizados</span>
              <div class="kpi-icon-wrap kpi-icon-indigo">
                ${icon('trendingUp', 16)}
              </div>
            </div>
            <div class="kpi-value" style="color: #818cf8;">${formatBRL(sumInterestProfit)}</div>
            <div class="kpi-footer">
              <span>Juros e multas recolhidos</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Inadimplência / Atrasos</span>
              <div class="kpi-icon-wrap kpi-icon-rose">
                ${icon('alert', 16)}
              </div>
            </div>
            <div class="kpi-value" style="color: ${countOverdueInst > 0 ? 'var(--red)' : 'var(--green)'};">
              ${formatBRL(sumOverdue)}
            </div>
            <div class="kpi-footer">
              <span>${countOverdueInst} parcela(s) vencidas (${filterInadimplenciaRate}%)</span>
            </div>
          </div>
        </div>
      `;
    }

    // Atualiza resumo textual do livro de registros
    const summaryTxt = container.querySelector('#rep-records-summary-txt');
    if (summaryTxt) {
      summaryTxt.textContent = `Exibindo ${filtered.length} registro(s) filtrado(s) • Entradas: ${formatBRL(sumInflows)} • Saídas: ${formatBRL(sumOutflows)} • Lucro: ${formatBRL(sumInterestProfit)}`;
    }

    // Paginação da tabela
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * pageSize;
    const pageRecords = filtered.slice(startIndex, startIndex + pageSize);

    const tbody = container.querySelector('#rep-table-tbody');
    if (tbody) {
      if (pageRecords.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 40px 16px; color: var(--text-400);">
              <div style="font-size: 1.2rem; margin-bottom: 6px;">${icon('search', 24)}</div>
              Nenhum registro encontrado para a combinação de filtros selecionada.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = pageRecords.map(r => {
          const scoreClass = r.clientScore ? `score-tag-${r.clientScore.toLowerCase()}` : '';
          const scoreHtml = r.clientScore && r.clientScore !== '-' 
            ? `<span class="score-tag ${scoreClass}" style="margin-left: 6px; font-size: 0.68rem; padding: 1px 6px;">Score ${r.clientScore}</span>` 
            : '';

          let badgeColorClass = 'badge-pending';
          if (r.status === 'paid' || r.status === 'completed') badgeColorClass = 'badge-paid';
          else if (r.status === 'overdue') badgeColorClass = 'badge-overdue';
          else if (r.status === 'promised') badgeColorClass = 'badge-today';

          return `
            <tr>
              <td data-label="Data">
                <div style="font-weight: 700; color: #fff;">${formatDate(r.date)}</div>
                <div style="font-size: 0.72rem; color: var(--text-400);">${r.date}</div>
              </td>
              <td data-label="Cliente / Razão">
                <div style="font-weight: 700; color: #fff; display: flex; align-items: center; flex-wrap: wrap;">
                  ${escapeHtml(r.clientName)}
                  ${scoreHtml}
                </div>
                ${r.clientPhone ? `<div style="font-size: 0.75rem; color: var(--text-400);">${escapeHtml(r.clientPhone)}</div>` : ''}
              </td>
              <td data-label="Tipo">
                <span class="badge" style="background: rgba(255,255,255,0.06); color: ${r.typeColor}; border: 1px solid rgba(255,255,255,0.12);">
                  ${r.typeLabel}
                </span>
              </td>
              <td data-label="Contrato / Ref">
                <div style="font-family: monospace; font-size: 0.8rem; color: var(--text-300);">
                  ${r.contractId !== '-' ? `#${r.contractId.substring(0, 8)}` : '-'}
                </div>
                ${r.installmentNumber !== '-' ? `<div style="font-size: 0.72rem; color: var(--text-400);">Parc. ${r.installmentNumber}/${r.totalInstallments}</div>` : ''}
              </td>
              <td data-label="Meio">
                <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-200);">${escapeHtml(r.method || '-')}</span>
              </td>
              <td data-label="Principal">
                <span style="font-size: 0.84rem; color: var(--text-300);">${formatBRL(r.principalAmount)}</span>
              </td>
              <td data-label="Juros / Multa">
                <span style="font-size: 0.84rem; color: ${r.interestAmount > 0 ? 'var(--yellow)' : 'var(--text-400)'};">
                  ${r.interestAmount > 0 ? `+${formatBRL(r.interestAmount)}` : 'R$ 0,00'}
                </span>
              </td>
              <td data-label="Valor Total">
                <strong style="font-size: 0.95rem; color: ${r.type === 'payment' || r.type === 'cash_in' ? 'var(--green)' : '#fff'};">
                  ${formatBRL(r.totalAmount)}
                </strong>
                ${r.discountAmount > 0 ? `<div style="font-size: 0.7rem; color: var(--amber);">Desc: ${formatBRL(r.discountAmount)}</div>` : ''}
              </td>
              <td data-label="Status">
                <span class="badge ${badgeColorClass}">
                  ${r.statusLabel}
                </span>
              </td>
              <td data-label="Ações" style="text-align: right;">
                <div style="display: inline-flex; gap: 4px; justify-content: flex-end;">
                  ${r.installmentId ? `
                    <button class="btn btn-secondary btn-sm rep-action-edit-inst" data-inst-id="${r.installmentId}" title="Editar Parcela e Vencimento" style="padding: 4px 8px; font-size: 0.74rem;">
                      ${icon('edit', 12)}
                    </button>
                    ${r.status === 'paid' ? `
                      <button class="btn btn-secondary btn-sm rep-action-receipt" data-inst-id="${r.installmentId}" title="Ver Recibo" style="padding: 4px 8px; font-size: 0.74rem;">
                        ${icon('receipt', 12)}
                      </button>
                    ` : `
                      <button class="btn btn-whatsapp btn-sm rep-action-wpp" data-phone="${escapeHtml(r.clientPhone)}" data-client="${encodeURIComponent(r.clientName)}" data-amount="${r.totalAmount}" data-number="${r.installmentNumber}" title="Cobrar WhatsApp" style="padding: 4px 8px; font-size: 0.74rem;">
                        ${icon('whatsapp', 12)}
                      </button>
                    `}
                  ` : ''}
                  ${r.loanId ? `
                    <button class="btn btn-secondary btn-sm rep-action-docs" data-loan-id="${r.loanId}" title="Ver Contrato e Promissória" style="padding: 4px 8px; font-size: 0.74rem;">
                      ${icon('fileText', 12)}
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Listeners de ações da tabela
        tbody.querySelectorAll('.rep-action-edit-inst').forEach(btn => {
          btn.addEventListener('click', () => {
            if (window.openInstallmentEditModal) window.openInstallmentEditModal(btn.dataset.instId);
          });
        });
        tbody.querySelectorAll('.rep-action-receipt').forEach(btn => {
          btn.addEventListener('click', () => {
            if (window.openReceiptModal) window.openReceiptModal(btn.dataset.instId);
          });
        });
        tbody.querySelectorAll('.rep-action-docs').forEach(btn => {
          btn.addEventListener('click', () => {
            if (window.openPromissoryModal) window.openPromissoryModal(btn.dataset.loanId);
          });
        });
        tbody.querySelectorAll('.rep-action-wpp').forEach(btn => {
          btn.addEventListener('click', () => {
            const phone = btn.dataset.phone;
            const clientName = decodeURIComponent(btn.dataset.client);
            const amount = Number(btn.dataset.amount || 0);
            const instNum = btn.dataset.number;
            const msg = `Olá, ${clientName}! Lembramos da sua parcela nº ${instNum} no valor de ${formatBRL(amount)}. Entre em contato para alinharmos o recebimento. Obrigado!`;
            const url = `https://api.whatsapp.com/send?phone=55${phone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
          });
        });
      }
    }

    // Atualiza controles de paginação
    const pageInfo = container.querySelector('#rep-page-info');
    if (pageInfo) {
      pageInfo.textContent = `Mostrando ${Math.min(filtered.length, startIndex + 1)}–${Math.min(filtered.length, startIndex + pageSize)} de ${filtered.length} registro(s) • Página ${currentPage} de ${totalPages}`;
    }

    const btnPrev = container.querySelector('#rep-prev-page');
    const btnNext = container.querySelector('#rep-next-page');
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
  }

  // Configura Listeners de Filtro
  function attachFilterEvents() {
    // 1. Chips de Período
    container.querySelectorAll('.rep-period-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.rep-period-chip').forEach(b => {
          b.className = 'btn btn-secondary btn-sm rep-period-chip';
        });
        btn.className = 'btn btn-primary btn-sm rep-period-chip active';
        activePeriod = btn.dataset.period;

        const curr = new Date();
        if (activePeriod === 'today') {
          filterStartDate = todayStr;
          filterEndDate = todayStr;
        } else if (activePeriod === 'yesterday') {
          const y = new Date(curr);
          y.setDate(y.getDate() - 1);
          filterStartDate = formatDateForInput(y);
          filterEndDate = formatDateForInput(y);
        } else if (activePeriod === '7d') {
          const d7 = new Date(curr);
          d7.setDate(d7.getDate() - 7);
          filterStartDate = formatDateForInput(d7);
          filterEndDate = todayStr;
        } else if (activePeriod === '15d') {
          const d15 = new Date(curr);
          d15.setDate(d15.getDate() - 15);
          filterStartDate = formatDateForInput(d15);
          filterEndDate = todayStr;
        } else if (activePeriod === 'month') {
          const f = new Date(curr.getFullYear(), curr.getMonth(), 1);
          filterStartDate = formatDateForInput(f);
          filterEndDate = todayStr;
        } else if (activePeriod === 'lastMonth') {
          const f = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
          const l = new Date(curr.getFullYear(), curr.getMonth(), 0);
          filterStartDate = formatDateForInput(f);
          filterEndDate = formatDateForInput(l);
        } else if (activePeriod === 'year') {
          const f = new Date(curr.getFullYear(), 0, 1);
          filterStartDate = formatDateForInput(f);
          filterEndDate = todayStr;
        } else if (activePeriod === 'all') {
          filterStartDate = '';
          filterEndDate = '';
        }

        container.querySelector('#rep-filter-start').value = filterStartDate;
        container.querySelector('#rep-filter-end').value = filterEndDate;
        currentPage = 1;
        updateView();
      });
    });

    // 2. Inputs de Data
    container.querySelector('#rep-filter-start')?.addEventListener('change', (e) => {
      filterStartDate = e.target.value;
      currentPage = 1;
      updateView();
    });
    container.querySelector('#rep-filter-end')?.addEventListener('change', (e) => {
      filterEndDate = e.target.value;
      currentPage = 1;
      updateView();
    });

    // 3. Selects
    container.querySelector('#rep-filter-client')?.addEventListener('change', (e) => {
      filterClientId = e.target.value;
      currentPage = 1;
      updateView();
    });
    container.querySelector('#rep-filter-status')?.addEventListener('change', (e) => {
      filterStatus = e.target.value;
      currentPage = 1;
      updateView();
    });
    container.querySelector('#rep-filter-method')?.addEventListener('change', (e) => {
      filterMethod = e.target.value;
      currentPage = 1;
      updateView();
    });
    container.querySelector('#rep-filter-type')?.addEventListener('change', (e) => {
      filterRecordType = e.target.value;
      currentPage = 1;
      updateView();
    });
    container.querySelector('#rep-filter-operator')?.addEventListener('change', (e) => {
      filterOperator = e.target.value;
      currentPage = 1;
      updateView();
    });

    // 4. Busca instantânea com debounce leve
    let searchTimeout = null;
    container.querySelector('#rep-filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterSearch = e.target.value;
        currentPage = 1;
        updateView();
      }, 150);
    });

    // 5. Reset Filtros
    container.querySelector('#rep-btn-reset-filters')?.addEventListener('click', () => {
      activePeriod = 'month';
      const f = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      filterStartDate = formatDateForInput(f);
      filterEndDate = todayStr;
      filterClientId = 'all';
      filterStatus = 'all';
      filterMethod = 'all';
      filterRecordType = 'all';
      filterOperator = 'all';
      filterSearch = '';
      activeTableTab = 'all';
      currentPage = 1;

      container.querySelectorAll('.rep-period-chip').forEach(b => {
        b.className = b.dataset.period === 'month' ? 'btn btn-primary btn-sm rep-period-chip active' : 'btn btn-secondary btn-sm rep-period-chip';
      });
      container.querySelector('#rep-filter-start').value = filterStartDate;
      container.querySelector('#rep-filter-end').value = filterEndDate;
      container.querySelector('#rep-filter-client').value = 'all';
      container.querySelector('#rep-filter-status').value = 'all';
      container.querySelector('#rep-filter-method').value = 'all';
      container.querySelector('#rep-filter-type').value = 'all';
      container.querySelector('#rep-filter-operator').value = 'all';
      container.querySelector('#rep-filter-search').value = '';

      container.querySelectorAll('#rep-table-tabs .tab-btn').forEach(b => {
        b.className = b.dataset.tab === 'all' ? 'tab-btn active' : 'tab-btn';
      });

      updateView();
    });

    // 6. Abas da Tabela
    container.querySelectorAll('#rep-table-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#rep-table-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTableTab = btn.dataset.tab;
        currentPage = 1;
        updateView();
      });
    });

    // 7. Paginação
    container.querySelector('#rep-prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updateView();
      }
    });
    container.querySelector('#rep-next-page')?.addEventListener('click', () => {
      currentPage++;
      updateView();
    });

    // 8. Exportação CSV com dados filtrados exatos
    const exportHandler = () => {
      exportFilteredCSV(lastFilteredRecords);
    };
    container.querySelector('#btn-export-csv')?.addEventListener('click', exportHandler);
    container.querySelector('#btn-export-csv-table')?.addEventListener('click', exportHandler);

    // 9. Impressão
    container.querySelector('#btn-print-reports')?.addEventListener('click', () => {
      window.print();
    });

    // 10. Modal PDF Oficial
    container.querySelector('#btn-generate-pdf-report')?.addEventListener('click', () => {
      openMonthlyReportModal();
    });
  }

  // Inicialização
  setTimeout(() => {
    updateView();
    attachFilterEvents();
    initCharts(container);
  }, 50);

  return container;
}

/**
 * Inicializa os 3 gráficos Canvas e configura redimensionamento responsivo
 */
function initCharts(container) {
  const resizeObservers = [];

  // 1. Gráfico de Barras: Receita Mensal
  const barCanvas = container.querySelector('#canvas-receita-mensal');
  const barContainer = container.querySelector('#bar-chart-container');
  const barTooltip = container.querySelector('#tooltip-receita-mensal');
  const barSummary = container.querySelector('#bar-chart-summary');

  if (barCanvas && barContainer) {
    const drawBar = () => {
      renderBarChartReceita(barCanvas, barTooltip, barSummary);
    };
    drawBar();

    const roBar = new ResizeObserver(() => drawBar());
    roBar.observe(barContainer);
    resizeObservers.push(roBar);
  }

  // 2. Gráfico Donut: Status das Parcelas
  const donutCanvas = container.querySelector('#canvas-status-parcelas');
  const donutContainer = container.querySelector('#donut-chart-container');
  const donutLegend = container.querySelector('#donut-legend-container');

  if (donutCanvas && donutContainer) {
    const drawDonut = () => {
      renderDonutChartStatus(donutCanvas, donutLegend);
    };
    drawDonut();

    const roDonut = new ResizeObserver(() => drawDonut());
    roDonut.observe(donutContainer);
    resizeObservers.push(roDonut);
  }

  // 3. Gráfico de Linha: Capital na Rua
  const lineCanvas = container.querySelector('#canvas-capital-rua');
  const lineContainer = container.querySelector('#line-chart-container');
  const lineTooltip = container.querySelector('#tooltip-capital-rua');
  const lineSummary = container.querySelector('#line-chart-summary');

  if (lineCanvas && lineContainer) {
    const drawLine = () => {
      renderLineChartCapital(lineCanvas, lineTooltip, lineSummary);
    };
    drawLine();

    const roLine = new ResizeObserver(() => drawLine());
    roLine.observe(lineContainer);
    resizeObservers.push(roLine);
  }
}

/**
 * Configura DPI do canvas para nitidez em telas Retina / High-DPI
 */
function setupCanvasDPI(canvas, targetHeight = 240, targetWidth = null) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = targetWidth || rect.width || (canvas.parentElement ? canvas.parentElement.clientWidth : 0) || 300;
  const height = targetHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height, dpr };
}

/**
 * ============================================================
 * 1. GRÁFICO DE BARRAS: RECEITA MENSAL (ÚLTIMOS 6 MESES)
 * ============================================================
 */
function renderBarChartReceita(canvas, tooltipEl, summaryEl) {
  const { ctx, width, height } = setupCanvasDPI(canvas, 240);

  // Calcula os últimos 6 meses
  const now = new Date();
  const monthsData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${MESES_ABREV[month]}/${String(year).slice(-2)}`;

    monthsData.push({
      yearMonth,
      label,
      total: 0,
      count: 0
    });
  }

  // Agrega pagamentos realizados por mês
  const installments = state.getInstallments();

  installments.forEach(inst => {
    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        const ym = String(rec.date).slice(0, 7);
        const match = monthsData.find(m => m.yearMonth === ym);
        if (match) {
          match.total += Number(rec.amount || 0);
          match.count++;
        }
      });
    } else if (inst.status === 'paid' && inst.paidDate) {
      const ym = String(inst.paidDate).slice(0, 7);
      const match = monthsData.find(m => m.yearMonth === ym);
      if (match) {
        match.total += Number(inst.paidAmount || inst.installmentAmount || 0);
        match.count++;
      }
    }
  });

  const totalPeriodo = monthsData.reduce((acc, m) => acc + m.total, 0);
  const mediaMensal = totalPeriodo / 6;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Total Realizado no Período:</span>
        <strong style="color: var(--green);">${formatBRL(totalPeriodo)}</strong>
      </div>
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Média Mensal:</span>
        <strong style="color: var(--yellow);">${formatBRL(mediaMensal)}</strong>
      </div>
    `;
  }

  // Margens de desenho
  const paddingLeft = 58;
  const paddingRight = 20;
  const paddingTop = 32;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Valor máximo para escala Y
  const maxVal = Math.max(...monthsData.map(m => m.total), 1000);
  // Arredonda para múltiplo visual limpo
  const niceMax = Math.ceil(maxVal / 500) * 500 * 1.25;

  // Limpa tela
  ctx.clearRect(0, 0, width, height);

  // 1. Linhas de grade horizontais e valores Y
  const gridLines = 4;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';

  for (let i = 0; i <= gridLines; i++) {
    const val = (niceMax / gridLines) * i;
    const y = paddingTop + chartHeight - (chartHeight * (val / niceMax));

    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = THEME.text400;
    const formattedY = val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${Math.round(val)}`;
    ctx.fillText(formattedY, paddingLeft - 8, y);
  }

  // 2. Desenho das Barras
  const slotWidth = chartWidth / monthsData.length;
  const barWidth = Math.min(48, Math.max(20, slotWidth * 0.55));
  const barsCoords = [];

  monthsData.forEach((m, idx) => {
    const x = paddingLeft + (idx * slotWidth) + (slotWidth / 2) - (barWidth / 2);
    const barH = (m.total / niceMax) * chartHeight;
    const y = paddingTop + chartHeight - barH;

    barsCoords.push({
      x,
      y,
      w: barWidth,
      h: barH,
      data: m
    });

    // Fundo da barra (guia sutil)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    drawRoundedRect(ctx, x, paddingTop, barWidth, chartHeight, 6);
    ctx.fill();

    // Barra com gradiente vertical amarelo
    if (m.total > 0) {
      const grad = ctx.createLinearGradient(x, y, x, paddingTop + chartHeight);
      grad.addColorStop(0, THEME.yellowLight);
      grad.addColorStop(0.5, THEME.yellow);
      grad.addColorStop(1, THEME.yellowDark);

      ctx.fillStyle = grad;
      ctx.shadowColor = THEME.yellowGlow;
      ctx.shadowBlur = 8;
      drawRoundedRect(ctx, x, y, barWidth, barH, 5);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Valor no topo da barra (se houver espaço)
      ctx.fillStyle = THEME.text100;
      ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const labelText = m.total >= 1000 ? `R$ ${(m.total / 1000).toFixed(1)}k` : `R$ ${Math.round(m.total)}`;
      ctx.fillText(labelText, x + barWidth / 2, Math.max(12, y - 8));
    } else {
      // Indicador sutil de zero
      ctx.fillStyle = THEME.text400;
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('-', x + barWidth / 2, paddingTop + chartHeight - 8);
    }

    // Label do mês no eixo X
    ctx.fillStyle = idx === monthsData.length - 1 ? THEME.yellow : THEME.text300;
    ctx.font = idx === monthsData.length - 1 ? '700 11px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, x + barWidth / 2, paddingTop + chartHeight + 20);
  });

  // Linha de base do eixo X
  ctx.strokeStyle = THEME.borderMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
  ctx.stroke();

  // Interatividade com Tooltip
  setupCanvasHover(canvas, tooltipEl, (mouseX, mouseY) => {
    const found = barsCoords.find(b => mouseX >= b.x - 4 && mouseX <= b.x + b.w + 4);
    if (found) {
      return {
        x: found.x + found.w / 2,
        y: found.y,
        html: `
          <div class="tooltip-title">${found.data.label}</div>
          <div class="tooltip-row">
            <span>Receita:</span>
            <strong style="color: var(--yellow);">${formatBRL(found.data.total)}</strong>
          </div>
          <div class="tooltip-sub">${found.data.count} pagamento(s) recebido(s)</div>
        `
      };
    }
    return null;
  });
}

/**
 * ============================================================
 * 2. GRÁFICO DONUT / PIE: STATUS DAS PARCELAS
 * ============================================================
 */
function renderDonutChartStatus(canvas, legendEl) {
  const size = 180;
  const { ctx, width, height } = setupCanvasDPI(canvas, size, size);

  const installments = state.getInstallments();
  const todayStr = formatDateForInput(new Date());

  let paidCount = 0;
  let paidAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;

  installments.forEach(i => {
    if (i.status === 'paid') {
      paidCount++;
      paidAmount += Number(i.paidAmount || i.installmentAmount);
    } else if (i.status === 'renegotiated') {
      // Ignorado
    } else if (i.dueDate < todayStr) {
      overdueCount++;
      overdueAmount += Number(i.installmentAmount) - Number(i.paidAmount || 0);
    } else {
      pendingCount++;
      pendingAmount += Number(i.installmentAmount) - Number(i.paidAmount || 0);
    }
  });

  const totalCount = paidCount + overdueCount + pendingCount;
  const totalAmount = paidAmount + overdueAmount + pendingAmount;

  const slices = [
    {
      label: 'Pagas',
      count: paidCount,
      amount: paidAmount,
      color: THEME.green,
      lightColor: THEME.greenLight,
      icon: icon('checkCircle', 13)
    },
    {
      label: 'Atrasadas',
      count: overdueCount,
      amount: overdueAmount,
      color: THEME.red,
      lightColor: THEME.redLight,
      icon: icon('alert', 13)
    },
    {
      label: 'Pendentes',
      count: pendingCount,
      amount: pendingAmount,
      color: THEME.yellow,
      lightColor: THEME.yellowLight,
      icon: icon('clock', 13)
    }
  ];

  // Renderiza Legenda HTML
  if (legendEl) {
    legendEl.innerHTML = `
      <div class="donut-stats-list">
        ${slices.map(s => {
          const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : '0.0';
          return `
            <div class="donut-legend-item">
              <div class="donut-legend-header">
                <div class="donut-legend-title-wrap">
                  <span class="donut-legend-bullet" style="background: ${s.color};"></span>
                  <span class="donut-legend-name">${s.label}</span>
                </div>
                <span class="donut-legend-pct" style="color: ${s.color}; border: 1px solid ${s.color}33;">${pct}%</span>
              </div>
              <div class="donut-legend-detail">
                <span class="donut-legend-count"><strong>${s.count}</strong> parcela${s.count !== 1 ? 's' : ''}</span>
                <span class="donut-legend-amount" style="color: ${s.color};">${formatBRL(s.amount)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(cx, cy) - 14;
  const innerRadius = outerRadius * 0.62;

  if (totalCount === 0) {
    // Vazio
    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerRadius + innerRadius) / 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = THEME.text400;
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma parcela', cx, cy);
    return;
  }

  let startAngle = -Math.PI / 2;
  const sliceGap = 0.035; // Espaçamento entre fatias

  slices.forEach(slice => {
    const sliceAngle = (slice.count / totalCount) * 2 * Math.PI;
    if (sliceAngle <= 0) return;

    const actualStart = startAngle + (sliceGap / 2);
    const actualEnd = startAngle + sliceAngle - (sliceGap / 2);

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, actualStart, actualEnd, false);
    ctx.arc(cx, cy, innerRadius, actualEnd, actualStart, true);
    ctx.closePath();

    ctx.fillStyle = slice.color;
    ctx.shadowColor = slice.color;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    startAngle += sliceAngle;
  });

  // Centro do Donut
  ctx.fillStyle = THEME.bg2;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius - 2, 0, 2 * Math.PI);
  ctx.fill();

  // Texto central
  ctx.fillStyle = THEME.text100;
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(totalCount, cx, cy - 8);

  ctx.fillStyle = THEME.text400;
  ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TOTAL PARCELAS', cx, cy + 14);
}

/**
 * ============================================================
 * 3. GRÁFICO DE LINHA: CAPITAL NA RUA AO LONGO DO TEMPO
 * ============================================================
 */
function renderLineChartCapital(canvas, tooltipEl, summaryEl) {
  const { ctx, width, height } = setupCanvasDPI(canvas, 260);

  const now = new Date();
  const timelinePoints = [];

  // Gera pontos para os últimos 6 meses até o mês atual
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    // Último dia do mês
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const endOfMonthStr = formatDateForInput(endOfMonth);
    const label = `${MESES_ABREV[month]}/${String(year).slice(-2)}`;

    timelinePoints.push({
      date: endOfMonth,
      dateStr: endOfMonthStr,
      label,
      capitalNaRua: 0
    });
  }

  const loans = state.getLoans();
  const installments = state.getInstallments();

  // Para cada mês no histórico, calcula o saldo devedor pendente naquele momento
  timelinePoints.forEach(point => {
    let monthCapital = 0;

    loans.forEach(loan => {
      // Se o empréstimo já havia sido concedido até o final deste mês
      const loanStart = new Date(loan.startDate || loan.createdAt);
      if (loanStart <= point.date) {
        const loanInsts = installments.filter(i => i.loanId === loan.id);

        loanInsts.forEach(inst => {
          // Verifica se a parcela foi paga até o final deste mês
          let wasPaid = false;
          if (inst.status === 'paid' && inst.paidDate) {
            const paidD = new Date(inst.paidDate);
            if (paidD <= point.date) {
              wasPaid = true;
            }
          }

          if (!wasPaid) {
            monthCapital += Number(inst.amortizationAmount || inst.installmentAmount);
          }
        });
      }
    });

    point.capitalNaRua = monthCapital;
  });

  const currentCapital = timelinePoints[timelinePoints.length - 1].capitalNaRua;
  const initialCapital = timelinePoints[0].capitalNaRua;
  const delta = currentCapital - initialCapital;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Capital Atual em Aberto:</span>
        <strong style="color: var(--yellow);">${formatBRL(currentCapital)}</strong>
      </div>
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Variação nos 6 Meses:</span>
        <strong style="color: ${delta >= 0 ? 'var(--green)' : 'var(--text-300)'};">
          ${delta >= 0 ? '+' : ''}${formatBRL(delta)}
        </strong>
      </div>
    `;
  }

  // Margens
  const paddingLeft = 68;
  const paddingRight = 24;
  const paddingTop = 32;
  const paddingBottom = 42;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...timelinePoints.map(p => p.capitalNaRua), 1000);
  const niceMax = Math.ceil(maxVal / 2000) * 2000 * 1.25;

  ctx.clearRect(0, 0, width, height);

  // 1. Linhas de grade e valores no eixo Y
  const gridLines = 4;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';

  for (let i = 0; i <= gridLines; i++) {
    const val = (niceMax / gridLines) * i;
    const y = paddingTop + chartHeight - (chartHeight * (val / niceMax));

    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = THEME.text400;
    const formattedY = val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${Math.round(val)}`;
    ctx.fillText(formattedY, paddingLeft - 8, y);
  }

  // Calcula coordenadas dos pontos (x, y)
  const slotWidth = chartWidth / (timelinePoints.length - 1);
  const coords = timelinePoints.map((p, idx) => {
    const x = paddingLeft + (idx * slotWidth);
    const y = paddingTop + chartHeight - (chartHeight * (p.capitalNaRua / niceMax));
    return { x, y, data: p };
  });

  // 2. Área Preenchida com Gradiente Ambar / Amarelo
  const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  fillGrad.addColorStop(0, 'rgba(245, 197, 24, 0.32)');
  fillGrad.addColorStop(0.7, 'rgba(245, 197, 24, 0.08)');
  fillGrad.addColorStop(1, 'rgba(245, 197, 24, 0.00)');

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, paddingTop + chartHeight);
  ctx.lineTo(coords[0].x, coords[0].y);

  // Curva suave com Bezier
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
  }

  ctx.lineTo(coords[coords.length - 1].x, paddingTop + chartHeight);
  ctx.closePath();
  ctx.fill();

  // 3. Linha de Traçado Principal
  ctx.strokeStyle = THEME.yellow;
  ctx.lineWidth = 3;
  ctx.shadowColor = THEME.yellowGlow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Pontos / Marcadores Circulares e Labels no Eixo X
  coords.forEach((coord, idx) => {
    // Marcador externo
    ctx.fillStyle = THEME.bg1;
    ctx.strokeStyle = THEME.yellow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Centro do ponto
    ctx.fillStyle = idx === coords.length - 1 ? THEME.yellowLight : THEME.yellow;
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Rótulo de mês no eixo X
    ctx.fillStyle = idx === coords.length - 1 ? THEME.yellow : THEME.text300;
    ctx.font = idx === coords.length - 1 ? '700 11px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(coord.data.label, coord.x, paddingTop + chartHeight + 20);
  });

  // Linha de base X
  ctx.strokeStyle = THEME.borderMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
  ctx.stroke();

  // Interatividade com Tooltip
  setupCanvasHover(canvas, tooltipEl, (mouseX, mouseY) => {
    const hitRadius = 24;
    const found = coords.find(c => Math.abs(mouseX - c.x) <= hitRadius);
    if (found) {
      return {
        x: found.x,
        y: found.y,
        html: `
          <div class="tooltip-title">${found.data.label}</div>
          <div class="tooltip-row">
            <span>Capital na Rua:</span>
            <strong style="color: var(--yellow);">${formatBRL(found.data.capitalNaRua)}</strong>
          </div>
          <div class="tooltip-sub">Posição em ${formatDate(found.data.dateStr)}</div>
        `
      };
    }
    return null;
  });
}

/**
 * Utilitário para retângulos com cantos arredondados no Canvas
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Utilitário de Hover e Tooltips nos Canvas
 */
function setupCanvasHover(canvas, tooltipEl, hitTestFn) {
  if (!canvas || !tooltipEl) return;

  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = hitTestFn(mouseX, mouseY);
    if (hit) {
      tooltipEl.innerHTML = hit.html;
      tooltipEl.style.display = 'block';

      // Posiciona tooltip sem vazar do container
      const containerRect = canvas.parentElement.getBoundingClientRect();
      let left = hit.x;
      let top = hit.y - 10;

      if (left > containerRect.width - 150) {
        left = containerRect.width - 150;
      }
      if (left < 70) {
        left = 70;
      }

      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    } else {
      tooltipEl.style.display = 'none';
    }
  };

  const onMouseLeave = () => {
    tooltipEl.style.display = 'none';
  };

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
}

/**
 * Ações de exportação e impressão de relatórios
 */
function attachReportActions(container) {
  // Exportar CSV
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    exportFinancialCSV();
  });

  // Imprimir Relatório
  container.querySelector('#btn-print-reports')?.addEventListener('click', () => {
    window.print();
  });

  // Gerar Relatório Oficial em PDF (abre modal de seleção do mês)
  container.querySelector('#btn-generate-pdf-report')?.addEventListener('click', () => {
    openMonthlyReportModal();
  });
}

/**
 * Gera arquivo CSV com extrato financeiro filtrado completo para download
 */
function exportFilteredCSV(records) {
  if (!records || records.length === 0) {
    exportFinancialCSV();
    return;
  }

  const headers = ['Data', 'Tipo', 'Cliente', 'Telefone', 'Score', 'Contrato / Ref', 'Nº Parcela', 'Meio', 'Principal (R$)', 'Juros/Multas (R$)', 'Desconto (R$)', 'Total (R$)', 'Status', 'Operador', 'Observações'];

  const rows = records.map(r => {
    return [
      `"${r.date}"`,
      `"${r.typeLabel}"`,
      `"${r.clientName}"`,
      `"${r.clientPhone || ''}"`,
      `"${r.clientScore || ''}"`,
      `"${r.contractId || ''}"`,
      `"${r.installmentNumber || ''}"`,
      `"${r.method || ''}"`,
      Number(r.principalAmount || 0).toFixed(2),
      Number(r.interestAmount || 0).toFixed(2),
      Number(r.discountAmount || 0).toFixed(2),
      Number(r.totalAmount || 0).toFixed(2),
      `"${r.statusLabel}"`,
      `"${r.operatorName || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_analitico_vandomotos_${formatDateForInput()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gera arquivo CSV com extrato financeiro para download
 */
function exportFinancialCSV() {
  const installments = state.getInstallments();
  const clients = state.getClients();
  const loans = state.getLoans();

  const headers = ['ID Parcela', 'ID Contrato', 'Cliente', 'CPF', 'Nº Parcela', 'Vencimento', 'Valor Parcela (R$)', 'Valor Pago (R$)', 'Data Pagamento', 'Status'];

  const rows = installments.map(inst => {
    const client = clients.find(c => c.id === inst.clientId) || { name: 'Desconhecido', cpf: '' };
    return [
      `"${inst.id}"`,
      `"${inst.loanId}"`,
      `"${client.name}"`,
      `"${client.cpf || ''}"`,
      inst.number,
      inst.dueDate,
      Number(inst.installmentAmount || 0).toFixed(2),
      Number(inst.paidAmount || 0).toFixed(2),
      inst.paidDate || '',
      `"${inst.status}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_financeiro_vandomotos_${formatDateForInput()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
