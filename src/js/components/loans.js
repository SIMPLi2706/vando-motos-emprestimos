// src/js/components/loans.js
// Simulador Dinâmico, Emissão de Novos Empréstimos e Gestão de Contratos

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast } from '../utils.js';
import { calculateAmortizationSchedule } from '../finance.js';

export function renderLoans() {
  const container = document.createElement('div');
  container.className = 'loans-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();

  container.innerHTML = `
    <!-- Topo da Visão: Alternar entre Novo Empréstimo e Contratos Ativos -->
    <div class="tabs-bar">
      <button class="tab-btn active" id="tab-btn-simulador">➕ Simular & Novo Empréstimo</button>
      <button class="tab-btn" id="tab-btn-contratos">📁 Contratos Ativos (${loans.length})</button>
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
                <input type="number" class="form-control" id="sim-carencia" value="0" min="0">
              </div>

              <div class="form-group">
                <label class="form-label">Multa por Atraso (%)</label>
                <input type="number" class="form-control" id="sim-multa" value="2.0" step="0.1">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Observações / Garantias</label>
              <textarea class="form-control" id="sim-notas" rows="2" placeholder="Ex: Deixou cheque caução, nota promissória assinada..."></textarea>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              💾 Efetivar e Emitir Empréstimo
            </button>
          </form>
        </div>

        <!-- Painel de Resumo e Prévia da Tabela de Amortização -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Resumo da Simulação</h3>
              <p class="card-subtitle">Prévia dos valores calculados</p>
            </div>
            <span class="badge badge-pending" id="sim-badge-parcelas">5 parcelas</span>
          </div>

          <!-- Cards de Totais Calculados -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--silver-metallic); text-transform: uppercase; font-weight: 700;">Total a Receber</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--brand-yellow);" id="sim-total-pagar">R$ 0,00</div>
            </div>

            <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--silver-metallic); text-transform: uppercase; font-weight: 700;">Lucro em Juros</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--silver-chrome);" id="sim-total-juros">R$ 0,00</div>
            </div>
          </div>

          <!-- Tabela de Prévia das Parcelas -->
          <div class="table-responsive" style="max-height: 380px;">
            <table class="table table-mobile-card-view" id="sim-tabela-parcelas">
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
                <!-- Preenchido via script -->
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
            <h3 class="card-title">Empréstimos Cadastrados (${loans.length})</h3>
            <p class="card-subtitle">Acompanhamento dos contratos vigentes</p>
          </div>
        </div>

        ${loans.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-dim);">
            Nenhum empréstimo cadastrado ainda. Use o simulador ao lado para criar o primeiro!
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${loans.map(loan => {
              const client = state.getClientById(loan.clientId) || { name: 'Cliente Removido' };
              const loanInsts = installments.filter(i => i.loanId === loan.id);
              const paidInsts = loanInsts.filter(i => i.status === 'paid').length;
              const totalInsts = loanInsts.length;
              const progressPct = totalInsts > 0 ? Math.round((paidInsts / totalInsts) * 100) : 0;
              const totalPaid = loanInsts.reduce((acc, i) => acc + (Number(i.paidAmount) || 0), 0);

              const tipoFormatado = {
                price: 'Tabela Price',
                simple: 'Juros Simples',
                sac: 'Tabela SAC',
                interest_only: 'Só Juros'
              }[loan.interestType] || loan.interestType;

              return `
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div>
                      <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${client.name}</div>
                      <div style="font-size: 0.8rem; color: var(--text-muted);">
                        Liberado em: ${formatDate(loan.startDate)} • Tipo: <strong>${tipoFormatado}</strong> (${loan.interestRate}% ${loan.periodicity === 'monthly' ? 'a.m.' : 'período'})
                      </div>
                      ${loan.notes ? `<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">📝 ${loan.notes}</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                      <span class="badge ${loan.status === 'paid' ? 'badge-paid' : 'badge-pending'}">
                        ${loan.status === 'paid' ? '✓ Quitado' : 'Em Andamento'}
                      </span>
                      <div style="font-size: 1.25rem; font-weight: 800; color: var(--emerald-400); margin-top: 4px;">
                        ${formatBRL(loan.totalPayable)}
                      </div>
                    </div>
                  </div>

                  <!-- Barra de Progresso de Quitação -->
                  <div style="margin: 12px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
                      <span>Progresso: ${paidInsts} de ${totalInsts} parcelas pagas (${progressPct}%)</span>
                      <span>Total recebido: <strong>${formatBRL(totalPaid)}</strong></span>
                    </div>
                    <div style="height: 8px; background: var(--bg-primary); border-radius: var(--radius-full); overflow: hidden;">
                      <div style="height: 100%; width: ${progressPct}%; background: linear-gradient(90deg, var(--emerald-500), var(--emerald-400)); border-radius: var(--radius-full); transition: width 0.3s ease;"></div>
                    </div>
                  </div>

                  <!-- Ações do Empréstimo -->
                  <div class="loan-card-actions">
                    <button class="btn btn-secondary btn-sm btn-print-promissoria" data-loan-id="${loan.id}">
                      📄 Promissória
                    </button>
                    <button class="btn btn-secondary btn-sm btn-ver-parcelas-loan" data-loan-id="${loan.id}">
                      🔍 Parcelas
                    </button>
                    <button class="btn btn-danger btn-sm btn-excluir-loan" data-loan-id="${loan.id}">
                      🗑️ Excluir
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

  // Função interna para rodar a simulação ao vivo
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
        <td data-label="Parcela" style="font-weight: 700; color: var(--emerald-400);">${formatBRL(item.installmentAmount)}</td>
        <td data-label="Juros" style="color: var(--indigo-400);">${formatBRL(item.interestAmount)}</td>
        <td data-label="Amortização">${formatBRL(item.amortizationAmount)}</td>
        <td data-label="Saldo" style="color: var(--text-dim);">${formatBRL(item.remainingBalance)}</td>
      </tr>
    `).join('');
  }

  // Event Listeners
  setTimeout(() => {
    // Alternar abas
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

    // Inputs que disparam re-cálculo da simulação
    const inputs = ['#sim-valor', '#sim-taxa', '#sim-tipo-juros', '#sim-periodicidade', '#sim-parcelas', '#sim-data-inicio', '#sim-carencia'];
    inputs.forEach(sel => {
      const el = container.querySelector(sel);
      if (el) {
        el.addEventListener('input', updateSimulation);
        el.addEventListener('change', updateSimulation);
      }
    });

    // Roda a simulação inicial
    updateSimulation();

    // Atalho para cadastrar cliente rápido
    container.querySelector('#btn-quick-new-client').addEventListener('click', () => {
      window.openClientModal();
    });

    // Submissão do novo empréstimo
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
        // Redireciona para visualização de parcelas
        window.navigateToTab('installments', { loanId: created.id });
      } catch (err) {
        showToast(err.message || 'Erro ao criar empréstimo', 'error');
      }
    });

    // Ações na lista de contratos
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
