// src/js/components/loanManageModal.js
// Modais de Gestão de Contratos: Edição & Garantias/Avalista, Quitação Antecipada, Anexos e Promessas de Pagamento

import { state } from '../state.js';
import {
  formatBRL,
  formatDate,
  formatDateForInput,
  addDays,
  maskCPF,
  maskPhone,
  compressImageFile,
  escapeHtml,
  showToast
} from '../utils.js';
import { icon } from '../icons.js';

export function createLoanManageModals() {
  createEditLoanModal();
  createSettleLoanModal();
  createAttachmentsModal();
  createPromiseModal();
}

/* ============================================================================
 * 1. MODAL DE EDIÇÃO DO CONTRATO, GARANTIAS, AVALISTA E VENCIMENTOS
 * ========================================================================== */
function createEditLoanModal() {
  if (document.getElementById('modal-edit-loan')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-edit-loan';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 720px; max-height: 92vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${icon('edit', 18)} Editar Contrato, Garantia & Vencimentos</h3>
          <p class="modal-subtitle" id="edit-loan-subtitle">-</p>
        </div>
        <button class="modal-close-btn" id="edit-loan-close">${icon('x', 16)}</button>
      </div>

      <form id="form-edit-loan" class="modal-card-form" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
        <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
          <input type="hidden" id="edit-loan-id">

          <!-- Parâmetros do Contrato -->
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Forma de Liberação do Valor</label>
              <select class="form-control" id="edit-loan-disbursement">
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro (Gaveta)</option>
                <option value="Transferência">Transferência / TED</option>
                <option value="Sem Movimentação">Sem Movimentação de Caixa</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Multa por Atraso (%)</label>
              <input type="number" inputmode="decimal" class="form-control" id="edit-loan-penalty" step="0.1" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Mora Diária (%)</label>
              <input type="number" inputmode="decimal" class="form-control" id="edit-loan-daily" step="0.01" min="0">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observações Gerais do Contrato</label>
            <textarea class="form-control" id="edit-loan-notes" rows="2" placeholder="Observações adicionais do acordo..."></textarea>
          </div>

          <!-- Bloco Estruturado: Garantia -->
          <div style="background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--yellow); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              ${icon('shieldCheck', 15)} Garantia / Bem Alienado
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Tipo de Garantia</label>
                <select class="form-control" id="edit-guar-type">
                  <option value="">Sem garantia vinculada</option>
                  <option value="Veículo / Moto">Veículo / Moto</option>
                  <option value="Celular / Eletrônico">Celular / Eletrônico</option>
                  <option value="Imóvel">Imóvel / Terreno</option>
                  <option value="Equipamento / Outro">Equipamento / Outro Bem</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Valor Estimado do Bem (R$)</label>
                <input type="number" inputmode="decimal" class="form-control" id="edit-guar-value" step="100" min="0" placeholder="0,00">
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Modelo / Descrição</label>
                <input type="text" class="form-control" id="edit-guar-desc" placeholder="Ex: Honda CG 160 Titan Preta 2022">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Placa / Renavam / Nº Série</label>
                <input type="text" class="form-control" id="edit-guar-plate" placeholder="Ex: QRT-4B21 / Renavam...">
              </div>
            </div>
          </div>

          <!-- Bloco Estruturado: Avalista / Fiador -->
          <div style="background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--cyan); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              ${icon('userCheck', 15)} Avalista / Fiador Solidário
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Nome Completo do Avalista</label>
                <input type="text" class="form-control" id="edit-av-name" placeholder="Nome completo">
              </div>
              <div class="form-group">
                <label class="form-label">CPF do Avalista</label>
                <input type="text" inputmode="numeric" class="form-control" id="edit-av-cpf" placeholder="000.000.000-00">
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Telefone / WhatsApp</label>
                <input type="tel" inputmode="tel" class="form-control" id="edit-av-phone" placeholder="(00) 00000-0000">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Endereço do Avalista</label>
                <input type="text" class="form-control" id="edit-av-address" placeholder="Rua, nº, bairro">
              </div>
            </div>
          </div>

          <!-- Ajuste de Vencimentos das Parcelas Pendentes -->
          <div id="edit-loan-dates-wrap" style="background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
              <div style="font-size: 0.85rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
                ${icon('calendar', 15)} Ajustar Vencimentos Pendentes
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm btn-shift-dates" data-days="7">+7d</button>
                <button type="button" class="btn btn-secondary btn-sm btn-shift-dates" data-days="15">+15d</button>
                <button type="button" class="btn btn-secondary btn-sm btn-shift-dates" data-days="30">+30d</button>
              </div>
            </div>
            <div id="edit-loan-dates-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="edit-loan-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('save', 15)} Salvar Alterações</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.classList.remove('active');
  modal.querySelector('#edit-loan-close').addEventListener('click', closeModal);
  modal.querySelector('#edit-loan-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelector('#edit-av-cpf').addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value);
  });
  modal.querySelector('#edit-av-phone').addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });

  modal.querySelectorAll('.btn-shift-dates').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days, 10) || 0;
      modal.querySelectorAll('.edit-inst-date-input').forEach(input => {
        if (input.value) {
          const d = addDays(new Date(input.value + 'T12:00:00'), days);
          input.value = formatDateForInput(d);
        }
      });
      showToast(`Datas ajustadas em +${days} dias (clique em Salvar para confirmar).`);
    });
  });

  modal.querySelector('#form-edit-loan').addEventListener('submit', (e) => {
    e.preventDefault();
    const loanId = modal.querySelector('#edit-loan-id').value;

    const gType = modal.querySelector('#edit-guar-type').value;
    const gDesc = modal.querySelector('#edit-guar-desc').value.trim();
    const gPlate = modal.querySelector('#edit-guar-plate').value.trim();
    const gVal = Number(modal.querySelector('#edit-guar-value').value || 0);
    const guarantee = (gType || gDesc || gPlate || gVal > 0)
      ? { type: gType || 'Outro', description: gDesc, plateRenavam: gPlate, estimatedValue: gVal }
      : null;

    const avName = modal.querySelector('#edit-av-name').value.trim();
    const avCpf = modal.querySelector('#edit-av-cpf').value.trim();
    const avPhone = modal.querySelector('#edit-av-phone').value.trim();
    const avAddr = modal.querySelector('#edit-av-address').value.trim();
    const guarantor = (avName || avCpf)
      ? { name: avName, cpf: avCpf, phone: avPhone, address: avAddr }
      : null;

    const installmentDates = {};
    modal.querySelectorAll('.edit-inst-date-input').forEach(inp => {
      if (inp.dataset.instId && inp.value) {
        installmentDates[inp.dataset.instId] = inp.value;
      }
    });

    try {
      state.updateLoanDetails(loanId, {
        disbursementMethod: modal.querySelector('#edit-loan-disbursement').value,
        penaltyRate: modal.querySelector('#edit-loan-penalty').value,
        dailyInterestRate: modal.querySelector('#edit-loan-daily').value,
        notes: modal.querySelector('#edit-loan-notes').value.trim(),
        guarantee,
        guarantor,
        installmentDates
      });
      showToast('Contrato atualizado com sucesso!');
      closeModal();
      if (window.refreshCurrentTab) window.refreshCurrentTab();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar contrato', 'error');
    }
  });

  window.openLoanEditModal = function(loanId) {
    const loan = state.getLoanById(loanId);
    if (!loan) return;
    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    const insts = state.getInstallments({ loanId })
      .filter(i => i.status !== 'paid' && i.status !== 'renegotiated')
      .sort((a, b) => a.number - b.number);

    modal.querySelector('#edit-loan-id').value = loanId;
    modal.querySelector('#edit-loan-subtitle').textContent = `${client.name} • Principal: ${formatBRL(loan.principal)}`;
    modal.querySelector('#edit-loan-disbursement').value = loan.disbursementMethod || 'PIX';
    modal.querySelector('#edit-loan-penalty').value = loan.penaltyRate ?? 2.0;
    modal.querySelector('#edit-loan-daily').value = loan.dailyInterestRate ?? 0.1;
    modal.querySelector('#edit-loan-notes').value = loan.notes || '';

    const g = loan.guarantee || {};
    modal.querySelector('#edit-guar-type').value = g.type || '';
    modal.querySelector('#edit-guar-desc').value = g.description || '';
    modal.querySelector('#edit-guar-plate').value = g.plateRenavam || '';
    modal.querySelector('#edit-guar-value').value = g.estimatedValue || '';

    const av = loan.guarantor || {};
    modal.querySelector('#edit-av-name').value = av.name || '';
    modal.querySelector('#edit-av-cpf').value = av.cpf || '';
    modal.querySelector('#edit-av-phone').value = av.phone || '';
    modal.querySelector('#edit-av-address').value = av.address || '';

    const datesWrap = modal.querySelector('#edit-loan-dates-wrap');
    const datesList = modal.querySelector('#edit-loan-dates-list');

    if (insts.length === 0) {
      datesWrap.style.display = 'none';
    } else {
      datesWrap.style.display = 'block';
      datesList.innerHTML = insts.map(i => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-2); padding: 8px 12px; border-radius: var(--r-xs); border: 1px solid var(--border-soft);">
          <span style="font-size: 0.82rem; font-weight: 700; color: #fff;">
            ${loan.installmentsCount === 1 ? 'Única' : `Parcela #${i.number}`} • ${formatBRL(Number(i.installmentAmount) - Number(i.paidAmount || 0))}
          </span>
          <input type="date" class="form-control edit-inst-date-input" data-inst-id="${i.id}" value="${String(i.dueDate || '').split('T')[0]}" style="max-width: 165px; min-height: 36px; padding: 4px 8px;">
        </div>
      `).join('');
    }

    modal.classList.add('active');
  };
}

/* ============================================================================
 * 2. MODAL DE QUITAÇÃO ANTECIPADA INTEGRAL DO CONTRATO
 * ========================================================================== */
function createSettleLoanModal() {
  if (document.getElementById('modal-settle-loan')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-settle-loan';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 560px; max-height: 92vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${icon('checkCircle', 18)} Quitação Antecipada de Contrato</h3>
          <p class="modal-subtitle" id="settle-loan-subtitle">Liquidar todas as parcelas em aberto de uma só vez</p>
        </div>
        <button class="modal-close-btn" id="settle-loan-close">${icon('x', 16)}</button>
      </div>

      <form id="form-settle-loan" class="modal-card-form" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
        <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
          <input type="hidden" id="settle-loan-id">

          <div style="background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem;">
              <span style="color: var(--text-300);">Parcelas em Aberto:</span>
              <strong id="settle-open-count" style="color: #fff;">0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem;">
              <span style="color: var(--text-300);">Saldo Bruto a Quitar:</span>
              <strong id="settle-raw-total" style="color: var(--yellow);">R$ 0,00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
              <span style="color: var(--text-400);">Juros Futuros Pendentes (estimado):</span>
              <strong id="settle-open-interest" style="color: var(--cyan);">R$ 0,00</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Desconto por Antecipação (R$)</label>
            <input type="number" inputmode="decimal" class="form-control" id="settle-discount" value="0" min="0" step="0.01">
            <div class="rate-quick-chips" style="margin-top: 8px;">
              <button type="button" class="rate-chip settle-disc-chip" data-mode="pct" data-val="0">Sem Desc.</button>
              <button type="button" class="rate-chip settle-disc-chip" data-mode="pct" data-val="5">5%</button>
              <button type="button" class="rate-chip settle-disc-chip" data-mode="pct" data-val="10">10%</button>
              <button type="button" class="rate-chip settle-disc-chip" data-mode="interest">Abater Juros Pendentes</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Data do Pagamento *</label>
              <input type="date" class="form-control" id="settle-date" value="${formatDateForInput()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Forma de Recebimento *</label>
              <select class="form-control" id="settle-method">
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro (Espécie)</option>
                <option value="Transferência">Transferência / TED</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observação do Acordo / Quitação</label>
            <input type="text" class="form-control" id="settle-notes" placeholder="Ex: Quitação antecipada negociada com o cliente">
          </div>

          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--r-sm); padding: 14px; text-align: center;">
            <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-300); font-weight: 700;">Valor Líquido a Receber Hoje</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: var(--green);" id="settle-final-amount">R$ 0,00</div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="settle-loan-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('check', 16)} Confirmar Quitação Total</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  let currentRawTotal = 0;
  let currentOpenInterest = 0;

  const closeModal = () => modal.classList.remove('active');
  modal.querySelector('#settle-loan-close').addEventListener('click', closeModal);
  modal.querySelector('#settle-loan-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function updateFinalTotal() {
    const disc = Math.max(0, Math.min(currentRawTotal, Number(modal.querySelector('#settle-discount').value) || 0));
    const finalVal = Math.max(0, currentRawTotal - disc);
    modal.querySelector('#settle-final-amount').textContent = formatBRL(finalVal);
  }

  modal.querySelector('#settle-discount').addEventListener('input', updateFinalTotal);

  modal.querySelectorAll('.settle-disc-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const inp = modal.querySelector('#settle-discount');
      if (mode === 'interest') {
        inp.value = currentOpenInterest.toFixed(2);
      } else {
        const pct = Number(btn.dataset.val || 0);
        inp.value = ((currentRawTotal * pct) / 100).toFixed(2);
      }
      updateFinalTotal();
    });
  });

  modal.querySelector('#form-settle-loan').addEventListener('submit', (e) => {
    e.preventDefault();
    const loanId = modal.querySelector('#settle-loan-id').value;
    const discount = Number(modal.querySelector('#settle-discount').value) || 0;
    const paymentDate = modal.querySelector('#settle-date').value || formatDateForInput();
    const paymentMethod = modal.querySelector('#settle-method').value;
    const notes = modal.querySelector('#settle-notes').value.trim();

    try {
      const res = state.settleLoanEarly(loanId, { discount, paymentDate, paymentMethod, notes });
      showToast(`Contrato quitado! Recebido ${formatBRL(res.totalCashReceived)} (${res.settledCount} parcela(s)).`, 'success');
      closeModal();
      if (window.refreshCurrentTab) window.refreshCurrentTab();
    } catch (err) {
      showToast(err.message || 'Erro ao quitar contrato', 'error');
    }
  });

  window.openSettleLoanModal = function(loanId) {
    const loan = state.getLoanById(loanId);
    if (!loan) return;
    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    const openInsts = state.getInstallments({ loanId }).filter(i => i.status !== 'paid' && i.status !== 'renegotiated');

    if (openInsts.length === 0) {
      showToast('Este contrato já está totalmente quitado.');
      return;
    }

    currentRawTotal = openInsts.reduce((acc, i) => acc + Math.max(0, Number(i.installmentAmount) - Number(i.paidAmount || 0)), 0);
    currentOpenInterest = openInsts.reduce((acc, i) => {
      const remRatio = Number(i.installmentAmount) > 0
        ? Math.max(0, Number(i.installmentAmount) - Number(i.paidAmount || 0)) / Number(i.installmentAmount)
        : 0;
      return acc + Number(i.interestAmount || 0) * remRatio;
    }, 0);

    modal.querySelector('#settle-loan-id').value = loanId;
    modal.querySelector('#settle-loan-subtitle').textContent = `${client.name} • Empréstimo ${formatDate(loan.startDate)}`;
    modal.querySelector('#settle-open-count').textContent = `${openInsts.length} parcela(s)`;
    modal.querySelector('#settle-raw-total').textContent = formatBRL(currentRawTotal);
    modal.querySelector('#settle-open-interest').textContent = formatBRL(currentOpenInterest);
    modal.querySelector('#settle-discount').value = '0';
    modal.querySelector('#settle-date').value = formatDateForInput();
    modal.querySelector('#settle-notes').value = '';
    updateFinalTotal();

    modal.classList.add('active');
  };
}

/* ============================================================================
 * 3. MODAL DE ANEXOS, COMPROVANTES DE PIX E FOTOS DA GARANTIA
 * ========================================================================== */
function createAttachmentsModal() {
  if (document.getElementById('modal-loan-attachments')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-loan-attachments';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 720px; max-height: 92vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${icon('paperclip', 18)} Anexos, Comprovantes & Fotos do Contrato</h3>
          <p class="modal-subtitle" id="att-loan-subtitle">-</p>
        </div>
        <button class="modal-close-btn" id="att-modal-close">${icon('x', 16)}</button>
      </div>

      <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
        <input type="hidden" id="att-loan-id">

        <div style="background: var(--bg-3); border: 1px dashed var(--border-mid); border-radius: var(--r-sm); padding: 14px; margin-bottom: 18px;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Categoria do Anexo</label>
              <select class="form-control" id="att-category">
                <option value="Comprovante PIX Liberado">Comprovante PIX Liberado</option>
                <option value="Foto da Garantia / Moto">Foto da Garantia / Moto</option>
                <option value="Documento / Selfie do Cliente">Documento / Selfie do Cliente</option>
                <option value="Contrato Físico Assinado">Contrato Físico Assinado</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Legenda / Descrição (opcional)</label>
              <input type="text" class="form-control" id="att-caption" placeholder="Ex: Placa moto / Recibo PIX Banco Inter">
            </div>
          </div>

          <label class="btn btn-primary" style="cursor: pointer; width: 100%; justify-content: center;">
            ${icon('camera', 16)} Selecionar Foto ou Tirar Foto com Câmera
            <input type="file" id="att-file-input" accept="image/*" style="display: none;">
          </label>
          <div style="font-size: 0.72rem; color: var(--text-400); text-align: center; margin-top: 6px;">
            Otimização automática para sincronização em nuvem (máx. 8 imagens por contrato).
          </div>
        </div>

        <div id="att-gallery-grid" class="att-gallery-grid"></div>
        <div id="att-empty-msg" class="empty-state-box" style="display: none;">
          <p>Nenhum comprovante ou foto anexado a este contrato ainda.</p>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="att-modal-close-btn">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.classList.remove('active');
  modal.querySelector('#att-modal-close').addEventListener('click', closeModal);
  modal.querySelector('#att-modal-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function renderGallery(loanId) {
    const loan = state.getLoanById(loanId);
    const grid = modal.querySelector('#att-gallery-grid');
    const empty = modal.querySelector('#att-empty-msg');
    const list = (loan && loan.attachments) || [];

    if (list.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = list.map(att => `
      <div class="att-card">
        <a href="${att.dataUrl}" target="_blank" download="anexo_${att.id}.jpg" title="Clique para baixar ou ampliar">
          <img src="${att.dataUrl}" alt="${escapeHtml(att.category)}" class="att-thumb" />
        </a>
        <div class="att-meta">
          <div class="att-cat">${escapeHtml(att.category)}</div>
          ${att.caption ? `<div class="att-cap">${escapeHtml(att.caption)}</div>` : ''}
          <div class="att-date">${formatDate(att.createdAt)} • ${att.sizeKB || '?'} KB</div>
        </div>
        <div class="att-actions">
          <a href="${att.dataUrl}" download="vandomotos_${att.id}.jpg" class="btn btn-secondary btn-sm" title="Baixar Imagem">${icon('download', 13)}</a>
          <button type="button" class="btn btn-danger btn-sm btn-del-att" data-att-id="${att.id}" title="Excluir Anexo">${icon('trash', 13)}</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-del-att').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Excluir este anexo do contrato?')) {
          state.removeLoanAttachment(loanId, btn.dataset.attId);
          renderGallery(loanId);
          if (window.refreshCurrentTab) window.refreshCurrentTab();
        }
      });
    });
  }

  modal.querySelector('#att-file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const loanId = modal.querySelector('#att-loan-id').value;
    const category = modal.querySelector('#att-category').value;
    const caption = modal.querySelector('#att-caption').value.trim();

    try {
      showToast('Processando e comprimindo imagem...', 'info');
      const compressed = await compressImageFile(file, 800, 0.65);
      state.addLoanAttachment(loanId, {
        category,
        caption,
        dataUrl: compressed.dataUrl,
        sizeKB: compressed.sizeKB
      });
      modal.querySelector('#att-caption').value = '';
      renderGallery(loanId);
      if (window.refreshCurrentTab) window.refreshCurrentTab();
      showToast('Anexo salvo e sincronizado!', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao anexar imagem.', 'error');
    } finally {
      e.target.value = '';
    }
  });

  window.openLoanAttachmentsModal = function(loanId) {
    const loan = state.getLoanById(loanId);
    if (!loan) return;
    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    modal.querySelector('#att-loan-id').value = loanId;
    modal.querySelector('#att-loan-subtitle').textContent = `${client.name} • Empréstimo de ${formatBRL(loan.principal)}`;
    renderGallery(loanId);
    modal.classList.add('active');
  };
}

/* ============================================================================
 * 4. MODAL DE AGENDA / PROMESSA DE PAGAMENTO NA PARCELA
 * ========================================================================== */
function createPromiseModal() {
  if (document.getElementById('modal-payment-promise')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-payment-promise';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 460px; max-height: 90vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${icon('bell', 18)} Promessa de Pagamento</h3>
          <p class="modal-subtitle" id="promise-subtitle">-</p>
        </div>
        <button class="modal-close-btn" id="promise-close">${icon('x', 16)}</button>
      </div>

      <form id="form-payment-promise" class="modal-card-form" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
        <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
          <input type="hidden" id="promise-inst-id">

          <div class="form-group">
            <label class="form-label">Data Combinada / Prometida *</label>
            <input type="date" class="form-control" id="promise-date" required>
            <div class="rate-quick-chips" style="margin-top: 8px;">
              <button type="button" class="rate-chip promise-day-chip" data-days="0">Hoje</button>
              <button type="button" class="rate-chip promise-day-chip" data-days="1">Amanhã</button>
              <button type="button" class="rate-chip promise-day-chip" data-days="3">+3 dias</button>
              <button type="button" class="rate-chip promise-day-chip" data-days="7">+7 dias</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Anotação do Contato / Acordo</label>
            <textarea class="form-control" id="promise-note" rows="3" placeholder="Ex: Cliente ligou informando que recebe às 14h e faz o PIX."></textarea>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <button type="button" class="btn btn-danger btn-sm" id="promise-clear-btn" style="display: none;">Remover Promessa</button>
          <div style="display: flex; gap: 8px; margin-left: auto;">
            <button type="button" class="btn btn-secondary" id="promise-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">${icon('check', 15)} Salvar Promessa</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.classList.remove('active');
  modal.querySelector('#promise-close').addEventListener('click', closeModal);
  modal.querySelector('#promise-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelectorAll('.promise-day-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days, 10) || 0;
      modal.querySelector('#promise-date').value = formatDateForInput(addDays(new Date(), days));
    });
  });

  modal.querySelector('#promise-clear-btn').addEventListener('click', () => {
    const instId = modal.querySelector('#promise-inst-id').value;
    state.clearInstallmentPromise(instId);
    showToast('Promessa removida.');
    closeModal();
    if (window.refreshCurrentTab) window.refreshCurrentTab();
  });

  modal.querySelector('#form-payment-promise').addEventListener('submit', (e) => {
    e.preventDefault();
    const instId = modal.querySelector('#promise-inst-id').value;
    const promisedDate = modal.querySelector('#promise-date').value;
    const promiseNote = modal.querySelector('#promise-note').value;

    try {
      state.setInstallmentPromise(instId, { promisedDate, promiseNote });
      showToast(`Promessa agendada para ${formatDate(promisedDate)}!`, 'success');
      closeModal();
      if (window.refreshCurrentTab) window.refreshCurrentTab();
    } catch (err) {
      showToast(err.message || 'Erro ao agendar promessa.', 'error');
    }
  });

  window.openPromiseModal = function(installmentId) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;
    const client = state.getClientById(inst.clientId) || { name: 'Cliente' };

    modal.querySelector('#promise-inst-id').value = installmentId;
    modal.querySelector('#promise-subtitle').textContent = `${client.name} • Parcela #${inst.number} (${formatBRL(inst.installmentAmount)})`;
    modal.querySelector('#promise-date').value = inst.promisedDate || formatDateForInput();
    modal.querySelector('#promise-note').value = inst.promiseNote || '';
    modal.querySelector('#promise-clear-btn').style.display = inst.promisedDate ? 'inline-flex' : 'none';

    modal.classList.add('active');
  };
}
