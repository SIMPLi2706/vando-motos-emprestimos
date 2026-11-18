// src/js/components/paymentModal.js
// Modal Completo de Baixa de Pagamento: Quitação, Rolagem de Dívida (Apenas Juros) e Desconto de Antecipação

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast, addMonths } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
import { icon } from '../icons.js';
import confetti from 'canvas-confetti';

export function createPaymentModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-pagamento';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title" id="pay-modal-title">${icon('creditCard', 18)} Baixa e Gestão de Pagamento</h3>
        <button class="modal-close-btn" id="pay-modal-close">${icon('x', 16)}</button>
      </div>

      <!-- Barra de Seleção de Operação Financeira (Modelo Seu Vando) -->
      <div style="padding: 12px 20px 0 20px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm flex-1" id="pay-mode-rollover" style="border-radius: 6px; font-weight: 800; font-size: 0.82rem; padding: 10px 12px; border-color: rgba(245, 197, 24, 0.4); color: var(--yellow);">
            ${icon('refresh', 15)} Receber Só Juros (Rolagem 20%)
          </button>
          <button type="button" class="btn btn-secondary btn-sm flex-1" id="pay-mode-standard" style="border-radius: 6px; font-weight: 800; font-size: 0.82rem; padding: 10px 12px;">
            ${icon('dollar', 15)} Quitação Total
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="pay-btn-discount-early" title="Calcular abatimento por adiantamento" style="border-radius: 6px; font-weight: 700; font-size: 0.8rem; padding: 10px 12px; white-space: nowrap; border-color: rgba(16, 185, 129, 0.4); color: var(--green);">
            ${icon('zap', 14)} Antecipar
          </button>
        </div>
      </div>

      <form id="form-baixa-parcela" class="modal-card-form" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
        <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
          <input type="hidden" id="pay-inst-id">

          <!-- Resumo da Parcela -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #fff;" id="pay-client-name">-</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);" id="pay-inst-details">Parcela nº - • Vencimento: -</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Valor da Parcela</div>
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);" id="pay-original-amount">R$ 0,00</div>
              </div>
            </div>

            <!-- Box Informativo de Composição (Principal vs Juros) -->
            <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.76rem; color: var(--text-muted);">
              <span>Amortização (Principal): <strong id="pay-comp-amort" style="color: #fff;">R$ 0,00</strong></span>
              <span>Juros do Contrato: <strong id="pay-comp-interest" style="color: var(--yellow);">R$ 0,00</strong></span>
            </div>

            <!-- Box Dinâmico de Atraso -->
            <div id="pay-overdue-box" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(244, 63, 94, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 4px; font-size: 0.82rem; color: var(--red); font-weight: 600;">
                <span id="pay-overdue-days">Atrasado há 0 dias</span>
                <span id="pay-overdue-charges">+ R$ 0,00 (Multa + Mora)</span>
              </div>
            </div>

            <!-- Box Dinâmico de Rolagem de Dívida (Modelo Seu Vando) -->
            <div id="pay-rollover-box" style="display: none; margin-top: 12px; padding: 14px; background: rgba(245, 197, 24, 0.08); border: 1.5px solid rgba(245, 197, 24, 0.4); border-radius: var(--r-md);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                <div style="font-size: 0.88rem; font-weight: 800; color: var(--yellow);">
                  ${icon('refresh', 16)} ROLAGEM DE DÍVIDA (PAGAR JUROS DO MÊS)
                </div>
                <span class="badge" style="background: rgba(245, 197, 24, 0.2); color: var(--yellow); border: 1px solid rgba(245, 197, 24, 0.5); font-size: 0.72rem;">Padrão Seu Vando</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-200); line-height: 1.45; margin-bottom: 12px;">
                O cliente paga os juros do ciclo. O capital (<strong id="pay-rollover-principal-txt" style="color: #fff;">R$ 0,00</strong>) <strong>permanece em aberto</strong> e o vencimento é estendido para o próximo mês, onde os 20% de juros retornarão sucessivamente.
              </div>

              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--yellow);">Nova Data de Vencimento do Capital *</label>
                <input type="date" class="form-control" id="pay-rollover-new-date" style="border-color: rgba(245, 197, 24, 0.5); font-weight: 700;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                  <button type="button" class="btn btn-secondary btn-sm pay-quick-date" data-days="15" style="font-size: 0.72rem; padding: 4px 8px;">+15 dias</button>
                  <button type="button" class="btn btn-secondary btn-sm pay-quick-date" data-days="30" style="font-size: 0.72rem; padding: 4px 8px;">+30 dias (1 mês)</button>
                  <button type="button" class="btn btn-secondary btn-sm pay-quick-date" data-days="45" style="font-size: 0.72rem; padding: 4px 8px;">+45 dias</button>
                  <button type="button" class="btn btn-secondary btn-sm pay-quick-date" data-days="60" style="font-size: 0.72rem; padding: 4px 8px;">+60 dias (2 meses)</button>
                </div>
              </div>

              <!-- Amortização opcional de parte do capital -->
              <div class="form-group" style="margin-bottom: 0; padding-top: 8px; border-top: 1px dashed rgba(245, 197, 24, 0.25);">
                <label class="form-label" style="font-size: 0.76rem; color: var(--text-300);">Amortização Parcial do Capital (Opcional - R$)</label>
                <input type="number" inputmode="decimal" class="form-control" id="pay-rollover-amort-input" value="0" min="0" step="10" placeholder="0,00" style="font-size: 0.95rem;">
                <small style="font-size: 0.72rem; color: var(--text-400); margin-top: 3px; display: block;">Se o cliente pagar um valor além dos juros para abater na dívida principal.</small>
              </div>
            </div>
          </div>

          <!-- Campos de Ajuste Financeiro -->
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Data do Pagamento *</label>
              <input type="date" class="form-control" id="pay-date" value="${formatDateForInput()}" required>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Forma de Pagamento *</label>
                <button type="button" class="btn btn-secondary btn-sm" id="pay-btn-open-pix" style="padding: 2px 8px; font-size: 0.72rem; color: var(--cyan);">
                  ${icon('zap', 12)} Ver QR Code PIX
                </button>
              </div>
              <select class="form-control" id="pay-method">
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro em Espécie</option>
                <option value="Transferência">Transferência Bancária</option>
                <option value="Cartão">Cartão</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Encargos por Atraso (R$)</label>
              <input type="number" inputmode="decimal" class="form-control" id="pay-late-charges" value="0" min="0" step="0.01">
            </div>

            <div class="form-group">
              <label class="form-label">Desconto / Abatimento (R$)</label>
              <input type="number" inputmode="decimal" class="form-control" id="pay-discount" value="0" min="0" step="0.01">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" id="pay-amount-label">Valor Efetivamente Pago (R$) *</label>
            <input type="number" inputmode="decimal" class="form-control" id="pay-amount-paid" style="font-size: 1.25rem; font-weight: 800; color: var(--green);" required step="0.01">
            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;" id="pay-suggested-hint">
              Sugestão para quitação total: R$ 0,00
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observação do Pagamento</label>
            <input type="text" class="form-control" id="pay-notes" placeholder="Ex: Pago via PIX ou juros de prorrogação">
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="pay-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="pay-modal-submit">
            ${icon('check', 15)} Confirmar Baixa
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#form-baixa-parcela');
  const closeBtn = modal.querySelector('#pay-modal-close');
  const cancelBtn = modal.querySelector('#pay-modal-cancel');
  const modeStandardBtn = modal.querySelector('#pay-mode-standard');
  const modeRolloverBtn = modal.querySelector('#pay-mode-rollover');
  const discountEarlyBtn = modal.querySelector('#pay-btn-discount-early');
  const rolloverBox = modal.querySelector('#pay-rollover-box');
  const submitBtn = modal.querySelector('#pay-modal-submit');

  let currentMode = 'standard'; // 'standard' | 'rollover'

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'rollover') {
      modeRolloverBtn.classList.add('active');
      modeRolloverBtn.style.background = 'rgba(245, 197, 24, 0.2)';
      modeStandardBtn.classList.remove('active');
      modeStandardBtn.style.background = '';
      rolloverBox.style.display = 'block';
      submitBtn.innerHTML = `${icon('refresh', 15)} Confirmar Rolagem (Receber Juros)`;
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-warning');

      const interest = Number(modal.dataset.interestAmount || 0);
      const charges = Number(modal.querySelector('#pay-late-charges').value || 0);
      const discount = Number(modal.querySelector('#pay-discount').value || 0);
      const pAmort = Number(modal.querySelector('#pay-rollover-amort-input')?.value || 0);
      const suggested = Math.max(0, interest + charges - discount);
      const totalToPay = suggested + pAmort;

      modal.querySelector('#pay-amount-paid').value = totalToPay.toFixed(2);
      modal.querySelector('#pay-suggested-hint').textContent = `Juros do ciclo: ${formatBRL(suggested)}${pAmort > 0 ? ` + Amortização: ${formatBRL(pAmort)} (Total: ${formatBRL(totalToPay)})` : ''}`;
      modal.querySelector('#pay-amount-label').textContent = pAmort > 0 ? 'Valor Total Pago (Juros + Amortização) *' : 'Valor dos Juros Recebidos (R$) *';
    } else {
      modeStandardBtn.classList.add('active');
      modeStandardBtn.style.background = '';
      modeRolloverBtn.classList.remove('active');
      modeRolloverBtn.style.background = '';
      rolloverBox.style.display = 'none';
      submitBtn.innerHTML = `${icon('check', 15)} Confirmar Quitação Total`;
      submitBtn.classList.remove('btn-warning');
      submitBtn.classList.add('btn-primary');
      modal.querySelector('#pay-amount-label').textContent = 'Valor Efetivamente Pago (R$) *';
      recalcSuggested();
    }
  }

  modeStandardBtn.addEventListener('click', () => setMode('standard'));
  modeRolloverBtn.addEventListener('click', () => setMode('rollover'));

  // Botões de atalho de data da rolagem
  modal.querySelectorAll('.pay-quick-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days, 10) || 30;
      const baseDate = modal.dataset.dueDate ? new Date(modal.dataset.dueDate + 'T00:00:00') : new Date();
      baseDate.setDate(baseDate.getDate() + days);
      modal.querySelector('#pay-rollover-new-date').value = formatDateForInput(baseDate);
    });
  });

  // Desconto por antecipação
  discountEarlyBtn.addEventListener('click', () => {
    const dueDateStr = modal.dataset.dueDate;
    if (!dueDateStr) return;

    const todayStr = formatDateForInput();
    if (dueDateStr <= todayStr) {
      showToast('Esta parcela já está no vencimento ou vencida. Desconto por antecipação disponível para parcelas futuras.', 'warning');
      return;
    }

    const today = new Date(todayStr + 'T00:00:00');
    const due = new Date(dueDateStr + 'T00:00:00');
    const diffTime = due.getTime() - today.getTime();
    const daysEarly = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    const interestAmount = Number(modal.dataset.interestAmount || 0);
    // Abate pro-rata sobre a taxa de juros da parcela pelos dias adiantados
    const calculatedDiscount = Math.min(interestAmount, Math.round(((interestAmount / 30) * daysEarly * 0.75) * 100) / 100);

    modal.querySelector('#pay-discount').value = calculatedDiscount.toFixed(2);
    recalcSuggested();
    showToast(`Desconto por antecipação de ${formatBRL(calculatedDiscount)} aplicado (${daysEarly} dias adiantados)!`);
  });

  // Re-cálculo da sugestão quando altera encargos ou desconto
  function recalcSuggested() {
    if (currentMode === 'rollover') {
      const interest = Number(modal.dataset.interestAmount || 0);
      const charges = Number(modal.querySelector('#pay-late-charges').value || 0);
      const discount = Number(modal.querySelector('#pay-discount').value || 0);
      const pAmort = Number(modal.querySelector('#pay-rollover-amort-input')?.value || 0);
      const suggested = Math.max(0, interest + charges - discount);
      const totalToPay = suggested + pAmort;
      modal.querySelector('#pay-amount-paid').value = totalToPay.toFixed(2);
      modal.querySelector('#pay-suggested-hint').textContent = `Juros a receber: ${formatBRL(suggested)}${pAmort > 0 ? ` + Amortização de Capital: ${formatBRL(pAmort)} (Total: ${formatBRL(totalToPay)})` : ''}`;
      return;
    }

    const orig = Number(modal.dataset.baseRemaining || 0);
    const charges = Number(modal.querySelector('#pay-late-charges').value || 0);
    const discount = Number(modal.querySelector('#pay-discount').value || 0);
    const suggested = Math.max(0, orig + charges - discount);

    modal.querySelector('#pay-amount-paid').value = suggested.toFixed(2);
    modal.querySelector('#pay-suggested-hint').textContent = `Sugestão para quitação total: ${formatBRL(suggested)}`;
  }

  modal.querySelector('#pay-late-charges').addEventListener('input', recalcSuggested);
  modal.querySelector('#pay-discount').addEventListener('input', recalcSuggested);
  modal.querySelector('#pay-rollover-amort-input')?.addEventListener('input', recalcSuggested);

  modal.querySelector('#pay-btn-open-pix').addEventListener('click', () => {
    const instId = modal.querySelector('#pay-inst-id').value;
    if (instId && window.openPixModal) {
      window.openPixModal(instId);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const instId = modal.querySelector('#pay-inst-id').value;
    const amountPaid = Number(modal.querySelector('#pay-amount-paid').value);
    const paymentDate = modal.querySelector('#pay-date').value;
    const paymentMethod = modal.querySelector('#pay-method').value;
    const discount = Number(modal.querySelector('#pay-discount').value || 0);
    const lateChargesPaid = Number(modal.querySelector('#pay-late-charges').value || 0);
    const notes = modal.querySelector('#pay-notes').value;

    if (amountPaid <= 0) {
      showToast('O valor pago deve ser maior que zero.', 'error');
      return;
    }

    try {
      if (currentMode === 'rollover') {
        const newDueDate = modal.querySelector('#pay-rollover-new-date').value;
        if (!newDueDate) {
          showToast('Informe a nova data de vencimento da dívida.', 'error');
          return;
        }

        const pAmort = Number(modal.querySelector('#pay-rollover-amort-input')?.value || 0);
        const interestDue = Number(modal.dataset.interestAmount || 0);
        // O valor dos juros é o total pago menos a amortização
        const interestPaid = Math.max(0, amountPaid - pAmort);

        const res = state.rollOverInstallment(instId, {
          amountPaid: interestPaid,
          paymentDate,
          paymentMethod,
          newDueDate,
          principalAmortization: pAmort,
          notes: notes || `Rolagem de dívida. Juros de ${formatBRL(interestPaid)} quitados.${pAmort > 0 ? ` Amortizou ${formatBRL(pAmort)} do capital.` : ''}`
        });

        closeModal();
        showToast('Rolagem confirmada! Juros recebidos e novo vencimento agendado.');

        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.7 }
        });

        window.refreshCurrentTab();

        setTimeout(() => {
          if (confirm('Deseja visualizar e imprimir o recibo de quitação dos juros?')) {
            window.openReceiptModal(instId);
          }
        }, 400);

      } else {
        const res = state.payInstallment(instId, {
          amountPaid,
          paymentDate,
          paymentMethod,
          discount,
          lateChargesPaid,
          notes
        });

        closeModal();
        showToast('Baixa confirmada com sucesso!');

        if (res.installment.status === 'paid') {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 }
          });
        }

        window.refreshCurrentTab();

        setTimeout(() => {
          if (confirm('Deseja visualizar e imprimir o recibo deste pagamento?')) {
            window.openReceiptModal(instId);
          }
        }, 400);
      }

    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Função exportada para abrir o modal com a parcela selecionada
  window.openPaymentModal = function(installmentId, options = {}) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;

    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;

    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido' };
    const loan = state.getLoanById(inst.loanId) || {};
    const settings = state.getSettings();

    modal.querySelector('#pay-inst-id').value = inst.id;
    modal.querySelector('#pay-client-name').textContent = client.name;
    modal.querySelector('#pay-inst-details').textContent = `Parcela nº ${inst.number} • Vencimento: ${formatDate(inst.dueDate)}`;

    const baseRemaining = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
    const interestVal = Number(inst.interestAmount || 0);
    const amortVal = Number(inst.amortizationAmount || (baseRemaining - interestVal));

    modal.dataset.baseRemaining = baseRemaining;
    modal.dataset.interestAmount = interestVal;
    modal.dataset.amortAmount = amortVal;
    modal.dataset.dueDate = inst.dueDate;

    modal.querySelector('#pay-original-amount').textContent = formatBRL(inst.installmentAmount);
    modal.querySelector('#pay-comp-amort').textContent = formatBRL(amortVal);
    modal.querySelector('#pay-comp-interest').textContent = formatBRL(interestVal);
    modal.querySelector('#pay-rollover-principal-txt').textContent = formatBRL(amortVal);
    modal.querySelector('#pay-rollover-new-date').value = addMonths(inst.dueDate, 1);
    const amortInput = modal.querySelector('#pay-rollover-amort-input');
    if (amortInput) amortInput.value = '0';

    // Checa atraso
    const charges = calculateLateCharges(
      inst,
      new Date(),
      loan.penaltyRate || settings.defaultPenaltyRate,
      loan.dailyInterestRate || settings.defaultDailyRate
    );

    const overdueBox = modal.querySelector('#pay-overdue-box');
    if (charges.daysOverdue > 0) {
      overdueBox.style.display = 'block';
      modal.querySelector('#pay-overdue-days').textContent = `Atrasado há ${charges.daysOverdue} dias`;
      modal.querySelector('#pay-overdue-charges').textContent = `+ ${formatBRL(charges.totalLateCharges)} (Multa + Mora)`;
      modal.querySelector('#pay-late-charges').value = charges.totalLateCharges.toFixed(2);
    } else {
      overdueBox.style.display = 'none';
      modal.querySelector('#pay-late-charges').value = '0';
    }

    modal.querySelector('#pay-discount').value = '0';
    modal.querySelector('#pay-date').value = formatDateForInput();
    modal.querySelector('#pay-notes').value = '';

    // Se o empréstimo for do modelo Seu Vando ou parcela única, sugere rollover (pagar só juros) como padrão
    const isSingleOrRollover = Number(loan.installmentsCount || 1) === 1 || loan.interestType === 'interest_only';
    const targetMode = options.mode || (isSingleOrRollover ? 'rollover' : 'standard');
    setMode(targetMode);
    recalcSuggested(); // Atualiza o valor sugerido ao abrir o modal
    modal.classList.add('active');
  };
}
