// src/js/components/paymentModal.js
// Modal Completo de Baixa de Pagamento (Total, Parcial, Multa/Mora e Desconto)

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
import confetti from 'canvas-confetti';

export function createPaymentModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-pagamento';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title" id="pay-modal-title">💰 Baixa de Pagamento</h3>
        <button class="modal-close-btn" id="pay-modal-close">✕</button>
      </div>

      <form id="form-baixa-parcela">
        <div class="modal-body">
          <input type="hidden" id="pay-inst-id">

          <!-- Resumo da Parcela -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #fff;" id="pay-client-name">-</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);" id="pay-inst-details">Parcela nº - • Vencimento: -</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Valor Original</div>
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);" id="pay-original-amount">R$ 0,00</div>
              </div>
            </div>

            <!-- Box Dinâmico de Atraso -->
            <div id="pay-overdue-box" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(244, 63, 94, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 4px; font-size: 0.82rem; color: var(--rose-400); font-weight: 600;">
                <span id="pay-overdue-days">Atrasado há 0 dias</span>
                <span id="pay-overdue-charges">+ R$ 0,00 (Multa + Mora)</span>
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
                <button type="button" class="btn btn-secondary btn-sm" id="pay-btn-open-pix" style="padding: 2px 8px; font-size: 0.72rem; color: var(--emerald-400);">
                  ⚡ Ver QR Code PIX
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
            <label class="form-label">Valor Efetivamente Pago (R$) *</label>
            <input type="number" inputmode="decimal" class="form-control" id="pay-amount-paid" style="font-size: 1.25rem; font-weight: 800; color: var(--emerald-400);" required step="0.01">
            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;" id="pay-suggested-hint">
              Sugestão para quitação total: R$ 0,00
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observação do Pagamento</label>
            <input type="text" class="form-control" id="pay-notes" placeholder="Ex: Pago via PIX pelo celular da esposa">
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="pay-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="pay-modal-submit">
            ✓ Confirmar Baixa
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#form-baixa-parcela');
  const closeBtn = modal.querySelector('#pay-modal-close');
  const cancelBtn = modal.querySelector('#pay-modal-cancel');

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Re-cálculo da sugestão quando altera encargos ou desconto
  function recalcSuggested() {
    const orig = Number(modal.dataset.baseRemaining || 0);
    const charges = Number(modal.querySelector('#pay-late-charges').value || 0);
    const discount = Number(modal.querySelector('#pay-discount').value || 0);
    const suggested = Math.max(0, orig + charges - discount);

    modal.querySelector('#pay-amount-paid').value = suggested.toFixed(2);
    modal.querySelector('#pay-suggested-hint').textContent = `Sugestão para quitação total: ${formatBRL(suggested)}`;
  }

  modal.querySelector('#pay-late-charges').addEventListener('input', recalcSuggested);
  modal.querySelector('#pay-discount').addEventListener('input', recalcSuggested);

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

      // Efeito de confete ao liquidar
      if (res.installment.status === 'paid') {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 }
        });
      }

      window.refreshCurrentTab();

      // Pergunta se quer ver o recibo
      setTimeout(() => {
        if (confirm('Deseja visualizar e imprimir o recibo deste pagamento?')) {
          window.openReceiptModal(instId);
        }
      }, 400);

    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Função exportada para abrir o modal com a parcela selecionada
  window.openPaymentModal = function(installmentId) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;

    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido' };
    const loan = state.getLoanById(inst.loanId) || {};
    const settings = state.getSettings();

    modal.querySelector('#pay-inst-id').value = inst.id;
    modal.querySelector('#pay-client-name').textContent = client.name;
    modal.querySelector('#pay-inst-details').textContent = `Parcela nº ${inst.number} • Vencimento: ${formatDate(inst.dueDate)}`;
    
    const baseRemaining = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
    modal.dataset.baseRemaining = baseRemaining;
    modal.querySelector('#pay-original-amount').textContent = formatBRL(inst.installmentAmount);

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
      modal.querySelector('#pay-overdue-days').textContent = `⚠️ Atrasado há ${charges.daysOverdue} dias`;
      modal.querySelector('#pay-overdue-charges').textContent = `+ ${formatBRL(charges.totalLateCharges)} (Multa + Mora)`;
      modal.querySelector('#pay-late-charges').value = charges.totalLateCharges.toFixed(2);
    } else {
      overdueBox.style.display = 'none';
      modal.querySelector('#pay-late-charges').value = '0';
    }

    modal.querySelector('#pay-discount').value = '0';
    modal.querySelector('#pay-date').value = formatDateForInput();
    modal.querySelector('#pay-notes').value = '';

    recalcSuggested();
    modal.classList.add('active');
  };
}
