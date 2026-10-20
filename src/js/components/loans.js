// src/js/components/loans.js
// Simulador Dinâmico, Emissão de Novos Empréstimos e Gestão de Contratos - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast } from '../utils.js';
import { calculateAmortizationSchedule } from '../finance.js';

export function renderLoans(options = {}) {
  const container = document.createElement('div');
  container.className = 'loans-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();

  container.innerHTML = `
    <!-- Topo da Visão: Alternar entre Novo Empréstimo e Contratos Ativos -->
    <div class="tabs-bar">
      <button class="tab-btn active" id="tab-btn-simulador">Simular & Novo Empréstimo</button>
      <button class="tab-btn" id="tab-btn-contratos">Contratos Ativos (${loans.length})</button>
    </div>

    <!-- SEÇÃO 1: SIMULADOR E NOVO EMPRÉSTIMO -->
    <div id="section-simulador">
      <div class="loan-simulator-layout">
        
        <!-- Formulário de Parâmetros -->
        <div class="card sim-card-config">
          <div class="card-header">
            <div>
              <h3 class="card-title">Configurar Empréstimo</h3>
              <p class="card-subtitle">Informe os valores para simulação em tempo real</p>
            </div>
          </div>

          <form id="form-novo-emprestimo">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <div style="display: flex; gap: 8px;">
                <select class="form-control" id="sim-cliente" required style="flex: 1;">
                  <option value="">Selecione um cliente...</option>
                  ${clients.map(c => `
                    <option value="${c.id}">${c.name} (${c.phone || c.cpf || 'Sem doc'})</option>
                  `).join('')}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-new-client" title="Novo Cliente">
                  + Novo
                </button>
              </div>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Valor do Empréstimo *</label>
                <span class="sim-val-hint text-yellow" id="sim-val-display" style="font-size: 0.88rem; font-weight: 700;">R$ 5.000,00</span>
              </div>
              <input type="number" inputmode="decimal" class="form-control" id="sim-valor" value="5000" min="10" step="10" required>
              <div class="amount-quick-chips">
                <button type="button" class="amount-chip" data-add="500">+ R$ 500</button>
                <button type="button" class="amount-chip" data-add="1000">+ R$ 1.000</button>
                <button type="button" class="amount-chip" data-add="2000">+ R$ 2.000</button>
                <button type="button" class="amount-chip" data-set="5000">R$ 5.000</button>
                <button type="button" class="amount-chip" data-set="10000">R$ 10.000</button>
              </div>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Quantidade de Parcelas *</label>
                <span class="sim-parcelas-hint text-yellow" id="sim-parcelas-display" style="font-size: 0.88rem; font-weight: 700;">5 parcelas</span>
              </div>
              <div class="installment-pills">
                <button type="button" class="pill-btn" data-n="2">2x</button>
                <button type="button" class="pill-btn" data-n="3">3x</button>
                <button type="button" class="pill-btn active" data-n="5">5x</button>
                <button type="button" class="pill-btn" data-n="6">6x</button>
                <button type="button" class="pill-btn" data-n="10">10x</button>
                <button type="button" class="pill-btn" data-n="12">12x</button>
              </div>
              <div style="margin-top: 8px;">
                <input type="number" inputmode="numeric" class="form-control" id="sim-parcelas" value="5" min="1" max="120" placeholder="Ou digite o número de parcelas" required>
              </div>
            </div>

            <!-- Hero Box de Resumo Imediato (Fintech) -->
            <div class="sim-hero-box">
              <div class="sim-hero-main">
                <span class="sim-hero-label">Valor Estimado da Parcela</span>
                <div class="sim-hero-value" id="sim-hero-parcela">5x de R$ 0,00</div>
              </div>
              <div class="sim-hero-subgrid">
                <div class="sim-hero-subitem">
                  <span class="sim-hero-sublabel">Total a Receber</span>
                  <span class="sim-hero-subvalue text-green" id="sim-hero-total">R$ 0,00</span>
                </div>
                <div class="sim-hero-subitem">
                  <span class="sim-hero-sublabel">Total de Juros</span>
                  <span class="sim-hero-subvalue text-yellow" id="sim-hero-juros">R$ 0,00</span>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary sim-submit-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Efetivar Empréstimo</span>
            </button>

            <!-- Detalhes Avançados (Accordion) -->
            <details class="sim-advanced-details" id="sim-advanced-details">
              <summary class="sim-advanced-summary">
                <span class="sim-advanced-summary-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>Opções Avançadas (Taxas, Prazos & Garantias)</span>
                </span>
                <span class="sim-details-chevron">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
              </summary>

              <div class="sim-advanced-body">
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Taxa de Juros (%) *</label>
                    <input type="number" inputmode="decimal" class="form-control" id="sim-taxa" value="10" min="0" step="0.1" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tipo de Juros *</label>
                    <select class="form-control" id="sim-tipo-juros">
                      <option value="price">Tabela Price (Parcelas Fixas)</option>
                      <option value="simple">Juros Simples (Taxa Fixa)</option>
                      <option value="sac">Tabela SAC (Amortização Constante)</option>
                      <option value="interest_only">Só Juros (Amortização no Fim)</option>
                    </select>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Periodicidade *</label>
                    <select class="form-control" id="sim-periodicidade">
                      <option value="monthly">Mensal</option>
                      <option value="biweekly">Quinzenal (15 dias)</option>
                      <option value="weekly">Semanal (7 dias)</option>
                      <option value="daily">Diário</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Data de Início *</label>
                    <input type="date" class="form-control" id="sim-data-inicio" value="${formatDateForInput()}" required>
                  </div>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Carência (Dias p/ 1ª parcela)</label>
                    <input type="number" inputmode="numeric" class="form-control" id="sim-carencia" value="0" min="0">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Multa por Atraso (%)</label>
                    <input type="number" inputmode="decimal" class="form-control" id="sim-multa" value="2.0" step="0.5">
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Observações / Garantias</label>
                  <textarea class="form-control" id="sim-notas" rows="2" placeholder="Veículo em garantia, avalista, observações..."></textarea>
                </div>
              </div>
            </details>
          </form>
        </div>

        <!-- Painel de Resultados do Simulador -->
        <div class="card sim-card-schedule">
          <div class="card-header">
            <div>
              <h3 class="card-title">Cronograma de Vencimentos</h3>
              <p class="card-subtitle">Cálculo detalhado do retorno financeiro</p>
            </div>
            <span class="badge badge-pending" id="sim-badge-parcelas">5x parcelas</span>
          </div>

          <div class="kpi-grid" style="margin-bottom: 14px;">
            <div class="kpi-card" style="padding: 10px 12px;">
              <span class="kpi-label">Total a Receber</span>
              <div class="kpi-value text-green" id="sim-total-pagar">R$ 0,00</div>
            </div>
            <div class="kpi-card" style="padding: 10px 12px;">
              <span class="kpi-label">Total de Juros</span>
              <div class="kpi-value text-yellow" id="sim-total-juros">R$ 0,00</div>
            </div>
          </div>

          <div class="scroll-hint-mobile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Deslize a tabela para ver todas as colunas</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
            <table class="table table-mobile-card-view table-sim-parcelas" id="sim-tabela-parcelas">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Vencimento</th>
                  <th>Parcela</th>
                  <th>Juros</th>
                  <th>Amortização</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                <!-- Inserido dinamicamente -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- SEÇÃO 2: CONTRATOS ATIVOS -->
    <div id="section-contratos" style="display: none;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Contratos de Empréstimo</h3>
            <p class="card-subtitle">Histórico de contratos firmados e andamento de amortizações</p>
          </div>
        </div>

        ${loans.length === 0 ? `
          <div class="empty-state-box">
            <p>Nenhum contrato cadastrado no momento.</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${loans.map(loan => {
              const client = state.getClientById(loan.clientId) || { name: 'Cliente Removido' };
              const loanInsts = installments.filter(i => i.loanId === loan.id);
              const totalInsts = loanInsts.length;
              const paidInsts = loanInsts.filter(i => i.status === 'paid').length;
              const totalPaid = loanInsts.reduce((acc, i) => acc + Number(i.paidAmount || 0), 0);
              const progressPct = totalInsts > 0 ? Math.round((paidInsts / totalInsts) * 100) : 0;

              let tipoFormatado = 'Price';
              if (loan.interestType === 'simple') tipoFormatado = 'Simples';
              if (loan.interestType === 'sac') tipoFormatado = 'SAC';
              if (loan.interestType === 'interest_only') tipoFormatado = 'Só Juros';

              return `
                <div class="card" style="background: var(--bg-3); border-color: var(--border-soft); margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div>
                      <div style="font-size: 1.05rem; font-weight: 800; color: #fff;">${client.name}</div>
                      <div style="font-size: 0.8rem; color: var(--text-400);">
                        Liberado em: ${formatDate(loan.startDate)} • Tipo: <strong>${tipoFormatado}</strong> (${loan.interestRate}% ${loan.periodicity === 'monthly' ? 'a.m.' : 'período'})
                      </div>
                      ${loan.notes ? `<div style="font-size: 0.75rem; color: var(--text-400); margin-top: 4px;">Obs: ${loan.notes}</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                      <span class="badge ${loan.status === 'paid' ? 'badge-paid' : 'badge-pending'}">
                        ${loan.status === 'paid' ? 'Quitado' : 'Em Andamento'}
                      </span>
                      <div style="font-size: 1.2rem; font-weight: 800; color: var(--green); margin-top: 4px;">
                        ${formatBRL(loan.totalPayable)}
                      </div>
                    </div>
                  </div>

                  <!-- Barra de Progresso de Quitação -->
                  <div style="margin: 12px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-400); margin-bottom: 6px;">
                      <span>Progresso: ${paidInsts} de ${totalInsts} parcelas pagas (${progressPct}%)</span>
                      <span>Total recebido: <strong style="color: var(--text-100);">${formatBRL(totalPaid)}</strong></span>
                    </div>
                    <div style="height: 6px; background: var(--bg-1); border-radius: var(--r-full); overflow: hidden;">
                      <div style="height: 100%; width: ${progressPct}%; background: var(--green); border-radius: var(--r-full); transition: width 0.3s ease;"></div>
                    </div>
                  </div>

                  <!-- Ações do Empréstimo -->
                  <div class="loan-card-actions">
                    <button class="btn btn-secondary btn-sm btn-print-promissoria" data-loan-id="${loan.id}">
                      Promissória
                    </button>
                    <button class="btn btn-secondary btn-sm btn-ver-parcelas-loan" data-loan-id="${loan.id}">
                      Parcelas
                    </button>
                    <button class="btn btn-danger btn-sm btn-excluir-loan" data-loan-id="${loan.id}">
                      Excluir
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  function updateSimulation() {
    const val = Number(container.querySelector('#sim-valor').value) || 0;
    const taxa = Number(container.querySelector('#sim-taxa').value) || 0;
    const tipo = container.querySelector('#sim-tipo-juros').value;
    const periodicidade = container.querySelector('#sim-periodicidade').value;
    const parcelas = parseInt(container.querySelector('#sim-parcelas').value, 10) || 1;
    const dataInicio = container.querySelector('#sim-data-inicio').value;
    const carencia = parseInt(container.querySelector('#sim-carencia').value, 10) || 0;

    const res = calculateAmortizationSchedule({
      principal: val,
      interestRate: taxa,
      interestType: tipo,
      periodicity: periodicidade,
      installmentsCount: parcelas,
      startDate: dataInicio,
      firstPaymentDays: carencia
    });

    const parcelaUnit = res.schedule.length > 0 ? res.schedule[0].installmentAmount : 0;

    const valDisplay = container.querySelector('#sim-val-display');
    if (valDisplay) valDisplay.textContent = formatBRL(val);

    const parcelasDisplay = container.querySelector('#sim-parcelas-display');
    if (parcelasDisplay) parcelasDisplay.textContent = `${parcelas} parcela${parcelas > 1 ? 's' : ''}`;

    const heroParcela = container.querySelector('#sim-hero-parcela');
    if (heroParcela) {
      if (res.schedule.length > 1 && tipo === 'sac') {
        const first = res.schedule[0].installmentAmount;
        const last = res.schedule[res.schedule.length - 1].installmentAmount;
        heroParcela.textContent = `${parcelas}x (${formatBRL(first)} ~ ${formatBRL(last)})`;
      } else {
        heroParcela.textContent = `${parcelas}x de ${formatBRL(parcelaUnit)}`;
      }
    }

    const heroTotal = container.querySelector('#sim-hero-total');
    if (heroTotal) heroTotal.textContent = formatBRL(res.totalPayable);

    const heroJuros = container.querySelector('#sim-hero-juros');
    if (heroJuros) heroJuros.textContent = `${formatBRL(res.totalInterest)} (${taxa}%)`;

    container.querySelector('#sim-total-pagar').textContent = formatBRL(res.totalPayable);
    container.querySelector('#sim-total-juros').textContent = formatBRL(res.totalInterest);
    container.querySelector('#sim-badge-parcelas').textContent = `${parcelas}x parcelas`;

    // Sincroniza active dos botões de parcelas (pills)
    container.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.n, 10) === parcelas);
    });

    const tbody = container.querySelector('#sim-tabela-parcelas tbody');
    tbody.innerHTML = res.schedule.map(item => `
      <tr>
        <td data-label="Nº">
          <div class="td-cell-val" style="align-items: flex-start; font-weight: 800; color: var(--yellow);">#${item.number}</div>
        </td>
        <td data-label="Vencimento">
          <div class="td-cell-val">${formatDate(item.dueDate)}</div>
        </td>
        <td data-label="Parcela">
          <div class="td-cell-val" style="font-weight: 800; color: var(--green);">${formatBRL(item.installmentAmount)}</div>
        </td>
        <td data-label="Juros">
          <div class="td-cell-val" style="color: var(--yellow);">${formatBRL(item.interestAmount)}</div>
        </td>
        <td data-label="Amortização">
          <div class="td-cell-val">${formatBRL(item.amortizationAmount)}</div>
        </td>
        <td data-label="Saldo Devedor">
          <div class="td-cell-val" style="color: var(--text-400);">${formatBRL(item.remainingBalance)}</div>
        </td>
      </tr>
    `).join('');
  }

  setTimeout(() => {
    const tabSim = container.querySelector('#tab-btn-simulador');
    const tabCont = container.querySelector('#tab-btn-contratos');
    const secSim = container.querySelector('#section-simulador');
    const secCont = container.querySelector('#section-contratos');

    tabSim.addEventListener('click', () => {
      tabSim.classList.add('active');
      tabCont.classList.remove('active');
      secSim.style.display = 'block';
      secCont.style.display = 'none';
    });

    tabCont.addEventListener('click', () => {
      tabCont.classList.add('active');
      tabSim.classList.remove('active');
      secCont.style.display = 'block';
      secSim.style.display = 'none';
    });

    if (options.tab === 'contratos' || options.loanId) {
      tabCont.click();
    }

    // Chips de valor rápido (+R$ 500, +R$ 1.000, +R$ 2.000, R$ 5.000, R$ 10.000)
    container.querySelectorAll('.amount-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = container.querySelector('#sim-valor');
        let current = Number(input.value) || 0;
        if (chip.dataset.add) {
          current += Number(chip.dataset.add);
        } else if (chip.dataset.set) {
          current = Number(chip.dataset.set);
        }
        input.value = current;
        updateSimulation();
      });
    });

    // Pills de parcelas (2x, 3x, 5x, 6x, 10x, 12x)
    container.querySelectorAll('.pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const input = container.querySelector('#sim-parcelas');
        input.value = pill.dataset.n;
        updateSimulation();
      });
    });

    // Se estiver no desktop (tela ampla), abre opções avançadas por padrão
    if (window.innerWidth > 768) {
      const advDetails = container.querySelector('#sim-advanced-details');
      if (advDetails) advDetails.open = true;
    }

    const inputs = ['#sim-valor', '#sim-taxa', '#sim-tipo-juros', '#sim-periodicidade', '#sim-parcelas', '#sim-data-inicio', '#sim-carencia'];
    inputs.forEach(sel => {
      const el = container.querySelector(sel);
      if (el) {
        el.addEventListener('input', updateSimulation);
        el.addEventListener('change', updateSimulation);
      }
    });

    updateSimulation();

    container.querySelector('#btn-quick-new-client')?.addEventListener('click', () => {
      window.openClientModal();
    });

    const form = container.querySelector('#form-novo-emprestimo');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = container.querySelector('#sim-cliente').value;
      if (!clientId) {
        showToast('Por favor, selecione um cliente.', 'error');
        return;
      }

      const newLoanData = {
        clientId,
        principal: container.querySelector('#sim-valor').value,
        interestRate: container.querySelector('#sim-taxa').value,
        interestType: container.querySelector('#sim-tipo-juros').value,
        periodicity: container.querySelector('#sim-periodicidade').value,
        installmentsCount: container.querySelector('#sim-parcelas').value,
        startDate: container.querySelector('#sim-data-inicio').value,
        firstPaymentDays: container.querySelector('#sim-carencia').value,
        penaltyRate: container.querySelector('#sim-multa').value,
        notes: container.querySelector('#sim-notas').value
      };

      try {
        const created = state.createLoan(newLoanData);
        showToast('Empréstimo efetivado com sucesso!');
        window.navigateToTab('installments', { loanId: created.id });
      } catch (err) {
        showToast(err.message || 'Erro ao criar empréstimo', 'error');
      }
    });

    container.querySelectorAll('.btn-ver-parcelas-loan').forEach(btn => {
      btn.addEventListener('click', () => {
        window.navigateToTab('installments', { loanId: btn.dataset.loanId });
      });
    });

    container.querySelectorAll('.btn-print-promissoria').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromissoryModal(btn.dataset.loanId);
      });
    });

    container.querySelectorAll('.btn-excluir-loan').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Deseja realmente excluir este empréstimo e todas as suas parcelas?')) {
          await state.deleteLoan(btn.dataset.loanId);
          showToast('Empréstimo excluído com sucesso.', 'success');
          window.refreshCurrentTab();
        }
      });
    });

  }, 0);

  return container;
}
