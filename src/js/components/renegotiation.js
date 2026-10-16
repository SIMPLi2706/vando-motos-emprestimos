// src/js/components/renegotiation.js
// Módulo de Renegociação de Dívidas - Unifica parcelas em atraso em um novo contrato formal

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, addMonths, showToast } from '../utils.js';
import { calculateLateCharges, calculateAmortizationSchedule } from '../finance.js';

export function renderRenegotiation(initialClientId = null) {
  const container = document.createElement('div');
  container.className = 'renegotiation-view animate-fade-in';

  const clients = state.getClients();
  const settings = state.getSettings();

  container.innerHTML = `
    <div class="renegotiation-layout">
      
      <!-- Painel Esquerdo: Seleção do Cliente e Parcelas Devedoras -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <div>
            <h3 class="card-title">🔄 Renegociação & Acordo de Dívidas</h3>
            <p class="card-subtitle">Vando motos locadora LTDA • Renegocie parcelas em atraso e emita novos carnês/promissórias</p>
          </div>
        </div>

        <!-- Seletor de Cliente -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label class="form-label">Selecione o Cliente Devedor *</label>
          <select class="form-control" id="reneg-select-client">
            <option value="">-- Escolha um cliente para carregar as dívidas --</option>
            ${clients.map(c => `
              <option value="${c.id}" ${c.id === initialClientId ? 'selected' : ''}>
                ${c.name} ${c.cpf ? `(${c.cpf})` : ''} - Tel: ${c.phone || 'N/A'}
              </option>
            `).join('')}
          </select>
        </div>

        <div id="reneg-debt-container" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff;">Parcelas em Aberto / Vencidas</h4>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="reneg-btn-sel-overdue">Selecionar Apenas Vencidas</button>
              <button type="button" class="btn btn-secondary btn-sm" id="reneg-btn-sel-all">Selecionar Todas</button>
            </div>
          </div>

          <div class="scroll-hint-mobile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Deslize a tabela para ver valores detalhados</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <div class="table-responsive table-scroll-x" style="max-height: 320px; overflow-x: auto !important; overflow-y: auto; margin-bottom: 16px;">
            <table class="table table-mobile-card-view" id="reneg-table-installments" style="min-width: 520px;">
              <thead>
                <tr>
                  <th style="width: 40px;"></th>
                  <th>Parcela</th>
                  <th>Vencimento</th>
                  <th>Valor Base</th>
                  <th>Atraso</th>
                  <th>Multa + Juros</th>
                  <th>Total Atualizado</th>
                </tr>
              </thead>
              <tbody id="reneg-tbody-installments">
                <!-- Preenchido dinamicamente -->
              </tbody>
            </table>
          </div>

          <!-- Resumo da Dívida Selecionada -->
          <div class="grid-auto-fit" style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Principal Selecionado:</div>
              <div style="font-size: 1.1rem; font-weight: 700;" id="reneg-disp-principal">R$ 0,00</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Encargos por Atraso:</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--rose-400);" id="reneg-disp-charges">R$ 0,00</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Dívida Bruta Acumulada:</div>
              <div style="font-size: 1.2rem; font-weight: 800; color: var(--amber-400);" id="reneg-disp-total-raw">R$ 0,00</div>
            </div>
          </div>
        </div>

        <div id="reneg-no-debt-msg" style="display: none; text-align: center; padding: 32px; color: var(--emerald-400);">
          🎉 Este cliente não possui débitos pendentes no momento!
        </div>
      </div>

      <!-- Card: Proposta do Novo Financiamento -->
      <div class="card" id="reneg-terms-card" style="display: none;">
        <div class="card-header">
          <div>
            <h3 class="card-title">📝 Novas Condições do Acordo</h3>
            <p class="card-subtitle">Defina o abatimento e o novo plano de parcelamento</p>
          </div>
        </div>

        <form id="form-reneg-submit">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Desconto Concedido no Acordo (R$)</label>
              <input type="number" class="form-control" id="reneg-input-discount" value="0.00" step="0.01" min="0">
              <span style="font-size: 0.72rem; color: var(--text-dim);">Abatimento sobre juros/multas para viabilizar o acordo</span>
            </div>

            <div class="form-group">
              <label class="form-label">Novo Saldo Financiado (R$) *</label>
              <input type="number" class="form-control" id="reneg-input-final-principal" step="0.01" min="1" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Quantidade de Parcelas *</label>
              <input type="number" class="form-control" id="reneg-input-count" value="12" min="1" max="72" required>
            </div>

            <div class="form-group">
              <label class="form-label">Taxa de Juros (% ao mês)</label>
              <input type="number" class="form-control" id="reneg-input-rate" value="0.0" step="0.1" min="0" required>
              <span style="font-size: 0.72rem; color: var(--text-dim);">0% para parcelar a dívida pura sem juros adicionais</span>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Periodicidade</label>
              <select class="form-control" id="reneg-select-periodicity">
                <option value="monthly" selected>Mensal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Vencimento da 1ª Parcela *</label>
              <input type="date" class="form-control" id="reneg-input-start-date" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observações do Acordo</label>
            <input type="text" class="form-control" id="reneg-input-notes" placeholder="Ex: Acordo formal Vando Motos Locadora para quitação de débitos">
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 14px; font-size: 1rem; padding: 12px;">
            🤝 Confirmar Renegociação & Emitir Contrato
          </button>
        </form>
      </div>

      <!-- Card: Simulação do Novo Carnê -->
      <div class="card" id="reneg-sim-card" style="display: none;">
        <div class="card-header">
          <div>
            <h3 class="card-title">📊 Simulação do Novo Carnê</h3>
            <p class="card-subtitle">Prévia das novas parcelas a serem geradas</p>
          </div>
        </div>

        <div style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-dim);">Total do Novo Acordo:</span>
            <strong style="color: var(--emerald-400); font-size: 1.2rem;" id="reneg-sim-total-payable">R$ 0,00</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-dim);">Valor de Cada Parcela:</span>
            <strong style="color: #fff; font-size: 1.1rem;" id="reneg-sim-inst-amount">R$ 0,00</strong>
          </div>
        </div>

        <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
          <table class="table table-mobile-card-view" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Vencimento</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody id="reneg-sim-tbody">
              <!-- Prévia das parcelas -->
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    const clientSelect = container.querySelector('#reneg-select-client');
    const debtContainer = container.querySelector('#reneg-debt-container');
    const noDebtMsg = container.querySelector('#reneg-no-debt-msg');
    const termsCard = container.querySelector('#reneg-terms-card');
    const simCard = container.querySelector('#reneg-sim-card');
    const tbodyInsts = container.querySelector('#reneg-tbody-installments');

    const dispPrincipal = container.querySelector('#reneg-disp-principal');
    const dispCharges = container.querySelector('#reneg-disp-charges');
    const dispTotalRaw = container.querySelector('#reneg-disp-total-raw');

    const inputDiscount = container.querySelector('#reneg-input-discount');
    const inputFinalPrincipal = container.querySelector('#reneg-input-final-principal');
    const inputCount = container.querySelector('#reneg-input-count');
    const inputRate = container.querySelector('#reneg-input-rate');
    const selectPeriodicity = container.querySelector('#reneg-select-periodicity');
    const inputStartDate = container.querySelector('#reneg-input-start-date');
    const inputNotes = container.querySelector('#reneg-input-notes');

    const btnSelOverdue = container.querySelector('#reneg-btn-sel-overdue');
    const btnSelAll = container.querySelector('#reneg-btn-sel-all');
    const formSubmit = container.querySelector('#form-reneg-submit');

    // Inicializa data para o próximo mês
    inputStartDate.value = formatDateForInput(addMonths(new Date(), 1));

    let currentPendingInsts = [];

    function updateClientDebts() {
      const clientId = clientSelect.value;
      if (!clientId) {
        debtContainer.style.display = 'none';
        noDebtMsg.style.display = 'none';
        termsCard.style.display = 'none';
        simCard.style.display = 'none';
        return;
      }

      const allInsts = state.getInstallments({ clientId });
      currentPendingInsts = allInsts
        .filter(i => i.status !== 'paid' && i.status !== 'renegotiated')
        .map(i => {
          const isOverdue = i.dueDate < formatDateForInput();
          const charges = calculateLateCharges(
            i,
            new Date(),
            settings.defaultPenaltyRate,
            settings.defaultDailyRate
          );
          return {
            ...i,
            isOverdue,
            charges
          };
        });

      if (currentPendingInsts.length === 0) {
        debtContainer.style.display = 'none';
        termsCard.style.display = 'none';
        simCard.style.display = 'none';
        noDebtMsg.style.display = 'block';
        return;
      }

      noDebtMsg.style.display = 'none';
      debtContainer.style.display = 'block';
      termsCard.style.display = 'block';
      simCard.style.display = 'block';

      tbodyInsts.innerHTML = currentPendingInsts.map(i => `
        <tr>
          <td data-label="Selecionar">
            <div class="td-cell-val">
              <input type="checkbox" class="reneg-checkbox" data-id="${i.id}" ${i.isOverdue ? 'checked' : ''} style="cursor: pointer; width: 20px; height: 20px;">
            </div>
          </td>
          <td data-label="Parcela">
            <div class="td-cell-val"><strong>#${i.number}</strong></div>
          </td>
          <td data-label="Vencimento">
            <div class="td-cell-val">
              <div>${formatDate(i.dueDate)}</div>
              ${i.isOverdue ? `<span class="badge badge-overdue" style="font-size: 0.68rem;">Atrasada</span>` : `<span class="badge badge-pending" style="font-size: 0.68rem;">A Vencer</span>`}
            </div>
          </td>
          <td data-label="Valor Base">
            <div class="td-cell-val">${formatBRL(i.installmentAmount)}</div>
          </td>
          <td data-label="Atraso">
            <div class="td-cell-val">${i.isOverdue ? `${i.charges.daysOverdue} dias` : '-'}</div>
          </td>
          <td data-label="Multa+Juros">
            <div class="td-cell-val" style="color: var(--red);">${i.isOverdue ? `+${formatBRL(i.charges.totalLateCharges)}` : 'R$ 0,00'}</div>
          </td>
          <td data-label="Total">
            <div class="td-cell-val" style="font-weight: 700; color: #fff;">
              ${formatBRL(i.isOverdue ? i.charges.totalUpdatedAmount : i.installmentAmount)}
            </div>
          </td>
        </tr>
      `).join('');

      tbodyInsts.querySelectorAll('.reneg-checkbox').forEach(cb => {
        cb.addEventListener('change', recalcSelection);
      });

      recalcSelection();
    }

    function recalcSelection() {
      const checkedBoxes = Array.from(tbodyInsts.querySelectorAll('.reneg-checkbox:checked'));
      const selectedIds = checkedBoxes.map(cb => cb.dataset.id);

      let totalPrincipal = 0;
      let totalCharges = 0;
      let totalRaw = 0;

      currentPendingInsts.forEach(i => {
        if (selectedIds.includes(i.id)) {
          totalPrincipal += Number(i.installmentAmount);
          if (i.isOverdue) {
            totalCharges += Number(i.charges.totalLateCharges);
            totalRaw += Number(i.charges.totalUpdatedAmount);
          } else {
            totalRaw += Number(i.installmentAmount);
          }
        }
      });

      dispPrincipal.textContent = formatBRL(totalPrincipal);
      dispCharges.textContent = formatBRL(totalCharges);
      dispTotalRaw.textContent = formatBRL(totalRaw);

      const discount = Number(inputDiscount.value) || 0;
      const finalPrincipal = Math.max(0, totalRaw - discount);
      inputFinalPrincipal.value = finalPrincipal.toFixed(2);

      updateSimulation();
    }

    function updateSimulation() {
      const principal = Number(inputFinalPrincipal.value) || 0;
      const count = Number(inputCount.value) || 1;
      const rate = Number(inputRate.value) || 0;
      const periodicity = selectPeriodicity.value;
      const startDate = inputStartDate.value || formatDateForInput();

      if (principal <= 0 || count <= 0) {
        container.querySelector('#reneg-sim-total-payable').textContent = 'R$ 0,00';
        container.querySelector('#reneg-sim-inst-amount').textContent = 'R$ 0,00';
        container.querySelector('#reneg-sim-tbody').innerHTML = '';
        return;
      }

      const schedule = calculateAmortizationSchedule({
        principal,
        interestRate: rate,
        interestType: 'simple',
        periodicity,
        installmentsCount: count,
        startDate
      });

      container.querySelector('#reneg-sim-total-payable').textContent = formatBRL(schedule.totalPayable);
      const singleAmount = schedule.installments[0]?.installmentAmount || 0;
      container.querySelector('#reneg-sim-inst-amount').textContent = formatBRL(singleAmount);

      container.querySelector('#reneg-sim-tbody').innerHTML = schedule.installments.map(i => `
        <tr>
          <td data-label="Nº">#${i.number}</td>
          <td data-label="Vencimento">${formatDate(i.dueDate)}</td>
          <td data-label="Valor" style="text-align: right; font-weight: 700; color: var(--emerald-400);">${formatBRL(i.installmentAmount)}</td>
        </tr>
      `).join('');
    }

    clientSelect.addEventListener('change', updateClientDebts);

    btnSelOverdue.addEventListener('click', () => {
      tbodyInsts.querySelectorAll('.reneg-checkbox').forEach(cb => {
        const id = cb.dataset.id;
        const item = currentPendingInsts.find(i => i.id === id);
        cb.checked = Boolean(item && item.isOverdue);
      });
      recalcSelection();
    });

    btnSelAll.addEventListener('click', () => {
      tbodyInsts.querySelectorAll('.reneg-checkbox').forEach(cb => cb.checked = true);
      recalcSelection();
    });

    inputDiscount.addEventListener('input', () => {
      const totalRaw = currentPendingInsts.reduce((acc, i) => {
        const cb = tbodyInsts.querySelector(`.reneg-checkbox[data-id="${i.id}"]`);
        if (cb && cb.checked) {
          return acc + (i.isOverdue ? i.charges.totalUpdatedAmount : Number(i.installmentAmount));
        }
        return acc;
      }, 0);
      const discount = Number(inputDiscount.value) || 0;
      inputFinalPrincipal.value = Math.max(0, totalRaw - discount).toFixed(2);
      updateSimulation();
    });

    inputFinalPrincipal.addEventListener('input', updateSimulation);
    inputCount.addEventListener('input', updateSimulation);
    inputRate.addEventListener('input', updateSimulation);
    selectPeriodicity.addEventListener('change', updateSimulation);
    inputStartDate.addEventListener('change', updateSimulation);

    formSubmit.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = clientSelect.value;
      const checkedBoxes = Array.from(tbodyInsts.querySelectorAll('.reneg-checkbox:checked'));
      const installmentIds = checkedBoxes.map(cb => cb.dataset.id);

      if (!installmentIds.length) {
        showToast('Selecione pelo menos uma parcela para renegociar.', 'error');
        return;
      }

      const newPrincipal = Number(inputFinalPrincipal.value);
      if (newPrincipal <= 0) {
        showToast('O saldo a financiar deve ser maior que zero.', 'error');
        return;
      }

      if (!confirm(`Confirmar a renegociação de ${installmentIds.length} parcelas no valor financiado de ${formatBRL(newPrincipal)} em ${inputCount.value}x?`)) {
        return;
      }

      try {
        const result = state.renegotiateLoan({
          clientId,
          installmentIds,
          newPrincipal,
          interestRate: Number(inputRate.value),
          interestType: 'simple',
          periodicity: selectPeriodicity.value,
          installmentsCount: Number(inputCount.value),
          startDate: inputStartDate.value,
          notes: inputNotes.value || `Renegociação formal de ${installmentIds.length} parcela(s) - Vando Motos Locadora LTDA`
        });

        showToast('Renegociação efetuada com sucesso! Novo contrato gerado.', 'success');

        // Abre o modal de Promissória / Carnê para impressão imediata
        if (window.openPromissoryModal) {
          window.openPromissoryModal(result.loan.id);
        } else {
          window.navigateToTab('installments');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    if (initialClientId) {
      updateClientDebts();
    }
  }, 0);

  return container;
}
