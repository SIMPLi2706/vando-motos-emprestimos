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
        <div class="card">
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

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Valor do Empréstimo (R$) *</label>
                <input type="number" inputmode="decimal" class="form-control" id="sim-valor" value="5000" min="10" step="10" required>
              </div>

              <div class="form-group">
                <label class="form-label">Taxa de Juros (%) *</label>
                <input type="number" inputmode="decimal" class="form-control" id="sim-taxa" value="10" min="0" step="0.1" required>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Tipo de Juros *</label>
                <select class="form-control" id="sim-tipo-juros">
                  <option value="price">Tabela Price (Parcelas Fixas)</option>
                  <option value="simple">Juros Simples (Taxa Fixa)</option>
                  <option value="sac">Tabela SAC (Amortização Constante)</option>
                  <option value="interest_only">Só Juros (Amortização no Fim)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Periodicidade *</label>
                <select class="form-control" id="sim-periodicidade">
                  <option value="monthly">Mensal</option>
                  <option value="biweekly">Quinzenal (15 dias)</option>
                  <option value="weekly">Semanal (7 dias)</option>
                  <option value="daily">Diário</option>
                </select>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Qtd. de Parcelas *</label>
                <input type="number" inputmode="numeric" class="form-control" id="sim-parcelas" value="5" min="1" max="120" required>
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

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              Efetivar Empréstimo
            </button>
          </form>
        </div>

        <!-- Painel de Resultados do Simulador -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Resumo da Simulação</h3>
              <p class="card-subtitle">Cálculo detalhado do retorno financeiro</p>
            </div>
            <span class="badge badge-pending" id="sim-badge-parcelas">5x parcelas</span>
          </div>

          <div class="kpi-grid" style="margin-bottom: 16px;">
            <div class="kpi-card" style="padding: 12px;">
              <span class="kpi-label">Total a Receber</span>
              <div class="kpi-value text-green" id="sim-total-pagar">R$ 0,00</div>
            </div>
            <div class="kpi-card" style="padding: 12px;">
              <span class="kpi-label">Total de Juros</span>
              <div class="kpi-value text-yellow" id="sim-total-juros">R$ 0,00</div>
            </div>
          </div>

          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-300); margin-bottom: 8px;">
            Cronograma de Vencimentos:
          </div>

          <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
            <table class="table" id="sim-tabela-parcelas">
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

    container.querySelector('#sim-total-pagar').textContent = formatBRL(res.totalPayable);
    container.querySelector('#sim-total-juros').textContent = formatBRL(res.totalInterest);
    container.querySelector('#sim-badge-parcelas').textContent = `${parcelas}x parcelas`;

    const tbody = container.querySelector('#sim-tabela-parcelas tbody');
    tbody.innerHTML = res.schedule.map(item => `
      <tr>
        <td data-label="Nº" style="font-weight: 700;">#${item.number}</td>
        <td data-label="Vencimento">${formatDate(item.dueDate)}</td>
        <td data-label="Parcela" style="font-weight: 700; color: var(--green);">${formatBRL(item.installmentAmount)}</td>
        <td data-label="Juros" style="color: var(--yellow);">${formatBRL(item.interestAmount)}</td>
        <td data-label="Amortização">${formatBRL(item.amortizationAmount)}</td>
        <td data-label="Saldo" style="color: var(--text-400);">${formatBRL(item.remainingBalance)}</td>
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
      btn.addEventListener('click', () => {
        if (confirm('Deseja realmente excluir este empréstimo e todas as suas parcelas?')) {
          state.deleteLoan(btn.dataset.loanId);
          showToast('Empréstimo excluído.');
          window.refreshCurrentTab();
        }
      });
    });

  }, 0);

  return container;
}
