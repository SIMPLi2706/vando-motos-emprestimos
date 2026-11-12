// src/js/components/clientModal.js
// Modal de Cadastro e Edição de Clientes com Máscaras

import { state } from '../state.js';
import { maskCPF, maskPhone, showToast } from '../utils.js';
import { generateClientReportPDF } from './pdfExport.js';
import { openDocumentScanner } from './documentScanner.js';
import { icon } from '../icons.js';

export function createClientModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-cliente';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title" id="client-modal-title">${icon('user', 18)} Cadastro de Cliente</h3>
        <button class="modal-close-btn" id="client-modal-close">${icon('x', 16)}</button>
      </div>

      <form id="form-cliente" class="modal-card-form" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden;">
        <div class="modal-body" style="overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important; flex: 1 1 auto; min-height: 0;">
          <input type="hidden" id="cli-id">

          <!-- Scanner Hero CTA -->
          <div class="scanner-hero-cta" id="btn-open-doc-scanner" role="button" tabindex="0">
            <div class="scanner-hero-icon-wrap">
              <span class="scanner-hero-icon">${icon('camera', 18)}</span>
            </div>
            <div class="scanner-hero-text">
              <div class="scanner-hero-title">
                Escanear CNH / RG com a Câmera
                <span class="scanner-tag-badge">IA Gemini Vision</span>
              </div>
              <div class="scanner-hero-sub">Tire foto ou anexe o documento para preencher nome e CPF na hora</div>
            </div>
            <span class="scanner-hero-arrow">${icon('arrowRight', 16)}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Nome Completo *</label>
            <input type="text" class="form-control" id="cli-name" required placeholder="Ex: João da Silva">
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">CPF / CNPJ</label>
              <input type="text" inputmode="numeric" class="form-control" id="cli-cpf" placeholder="000.000.000-00" autocomplete="off">
            </div>

            <div class="form-group">
              <label class="form-label">Telefone / WhatsApp *</label>
              <input type="tel" inputmode="tel" class="form-control" id="cli-phone" required placeholder="(11) 99999-9999" autocomplete="tel">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Limite de Crédito Aprovado (R$)</label>
              <input type="number" inputmode="decimal" class="form-control" id="cli-limit" value="5000" min="0" step="100" autocomplete="off">
            </div>

            <div class="form-group">
              <label class="form-label">Indicado por (Opcional)</label>
              <input type="text" class="form-control" id="cli-referred-by" list="cli-referred-list" placeholder="Nome de quem indicou" autocomplete="off">
              <datalist id="cli-referred-list"></datalist>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Endereço Residencial / Comercial</label>
            <input type="text" class="form-control" id="cli-address" placeholder="Rua, número, bairro, cidade" autocomplete="street-address">
          </div>

          <div class="form-group">
            <label class="form-label">Observações Internas</label>
            <textarea class="form-control" id="cli-notes" rows="2" placeholder="Garantias, fiador, local de trabalho ou referências..."></textarea>
          </div>

          <!-- Lista de Restrição / Bloqueio -->
          <div class="client-block-box">
            <label class="client-block-toggle">
              <input type="checkbox" id="cli-blocked">
              <span><strong>Bloquear para novos empréstimos</strong> (Lista de Restrição)</span>
            </label>
            <div id="cli-blocked-reason-wrap" style="display: none; margin-top: 8px;">
              <input type="text" class="form-control" id="cli-blocked-reason" placeholder="Motivo da restrição (ex: Inadimplência recorrente, acordo descumprido...)">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div style="display: flex; gap: 8px; margin-right: auto;">
            <button type="button" class="btn btn-secondary" id="client-modal-statement" style="display: none; color: var(--yellow); border-color: rgba(245, 197, 24, 0.4);">${icon('fileText', 14)} Extrato da Conta</button>
            <button type="button" class="btn btn-secondary" id="client-modal-pdf" style="display: none;">${icon('fileText', 14)} Dossiê PDF</button>
          </div>
          <button type="button" class="btn btn-secondary" id="client-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('save', 15)} Salvar Cliente</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#form-cliente');
  const closeBtn = modal.querySelector('#client-modal-close');
  const cancelBtn = modal.querySelector('#client-modal-cancel');
  const inputCpf = modal.querySelector('#cli-cpf');
  const inputPhone = modal.querySelector('#cli-phone');
  const chkBlocked = modal.querySelector('#cli-blocked');
  const blockedReasonWrap = modal.querySelector('#cli-blocked-reason-wrap');

  chkBlocked?.addEventListener('change', () => {
    if (blockedReasonWrap) {
      blockedReasonWrap.style.display = chkBlocked.checked ? 'block' : 'none';
    }
  });

  inputCpf.addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value);
  });

  inputPhone.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });

  const btnScanDoc = modal.querySelector('#btn-open-doc-scanner');
  btnScanDoc?.addEventListener('click', () => {
    openDocumentScanner((extracted) => {
      if (extracted.name) {
        modal.querySelector('#cli-name').value = extracted.name;
      }
      if (extracted.cpf) {
        modal.querySelector('#cli-cpf').value = maskCPF(extracted.cpf);
      }
      const extraNotes = [];
      if (extracted.docType) extraNotes.push(`Doc: ${extracted.docType}`);
      if (extracted.rg) extraNotes.push(`Nº ${extracted.rg}`);
      if (extracted.birthDate) extraNotes.push(`Nasc: ${extracted.birthDate}`);
      if (extracted.motherName) extraNotes.push(`Mãe: ${extracted.motherName}`);

      if (extraNotes.length > 0) {
        const notesInput = modal.querySelector('#cli-notes');
        const currentNotes = notesInput.value.trim();
        const prefix = currentNotes ? currentNotes + '\n' : '';
        notesInput.value = `${prefix}[IA Gemini: ${extraNotes.join(' | ')}]`;
      }
    });
  });

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = modal.querySelector('#cli-id').value;
    const name = modal.querySelector('#cli-name').value.trim();
    const cpf = modal.querySelector('#cli-cpf').value.trim();
    const phone = modal.querySelector('#cli-phone').value.trim();
    const creditLimit = Number(modal.querySelector('#cli-limit').value || 0);
    const referredBy = modal.querySelector('#cli-referred-by')?.value.trim() || '';
    const address = modal.querySelector('#cli-address').value.trim();
    const notes = modal.querySelector('#cli-notes').value.trim();
    const blocked = !!chkBlocked?.checked;
    const blockedReason = blocked ? (modal.querySelector('#cli-blocked-reason')?.value.trim() || '') : '';

    if (!name || !phone) {
      showToast('Nome e telefone são obrigatórios.', 'error');
      return;
    }

    state.saveClient({
      id: id || undefined,
      name,
      cpf,
      phone,
      creditLimit,
      referredBy,
      address,
      notes,
      blocked,
      blockedReason
    });

    closeModal();
    showToast(`Cliente ${name} salvo com sucesso!`);
    window.refreshCurrentTab();
  });

  window.openClientModal = function(clientId = null, prefillData = null) {
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;

    // Popula sugestões de "Indicado por" com nomes de clientes existentes e indicações anteriores
    const refList = modal.querySelector('#cli-referred-list');
    if (refList) {
      const suggestions = new Set();
      state.getClients().forEach(c => {
        if (c.id !== clientId && c.name) suggestions.add(c.name);
        if (c.referredBy) suggestions.add(c.referredBy);
      });
      refList.innerHTML = Array.from(suggestions).map(n => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    const pdfBtn = modal.querySelector('#client-modal-pdf');
    const statementBtn = modal.querySelector('#client-modal-statement');
    if (clientId) {
      const client = state.getClientById(clientId);
      if (!client) return;
      modal.querySelector('#client-modal-title').innerHTML = `${icon('user', 18)} Editar Cliente`;
      modal.querySelector('#cli-id').value = client.id;
      modal.querySelector('#cli-name').value = client.name || '';
      modal.querySelector('#cli-cpf').value = client.cpf || '';
      modal.querySelector('#cli-phone').value = client.phone || '';
      modal.querySelector('#cli-limit').value = client.creditLimit || 5000;
      modal.querySelector('#cli-referred-by').value = client.referredBy || '';
      modal.querySelector('#cli-address').value = client.address || '';
      modal.querySelector('#cli-notes').value = client.notes || '';
      if (chkBlocked) chkBlocked.checked = !!client.blocked;
      modal.querySelector('#cli-blocked-reason').value = client.blockedReason || '';
      if (blockedReasonWrap) blockedReasonWrap.style.display = client.blocked ? 'block' : 'none';
      if (pdfBtn) {
        pdfBtn.style.display = 'inline-flex';
        pdfBtn.onclick = () => generateClientReportPDF(client.id);
      }
      if (statementBtn) {
        statementBtn.style.display = 'inline-flex';
        statementBtn.onclick = () => {
          if (window.openClientStatementModal) {
            window.openClientStatementModal(client.id);
          }
        };
      }
    } else {
      modal.querySelector('#client-modal-title').innerHTML = `${icon('user', 18)} Novo Cliente`;
      modal.querySelector('#cli-id').value = '';
      form.reset();
      modal.querySelector('#cli-limit').value = '5000';
      if (chkBlocked) chkBlocked.checked = false;
      if (blockedReasonWrap) blockedReasonWrap.style.display = 'none';
      if (pdfBtn) pdfBtn.style.display = 'none';
      if (statementBtn) statementBtn.style.display = 'none';

      if (prefillData) {
        if (prefillData.name) modal.querySelector('#cli-name').value = prefillData.name;
        if (prefillData.cpf) modal.querySelector('#cli-cpf').value = maskCPF(prefillData.cpf);
        const extraNotes = [];
        if (prefillData.docType) extraNotes.push(`Doc: ${prefillData.docType}`);
        if (prefillData.rg) extraNotes.push(`Nº ${prefillData.rg}`);
        if (prefillData.birthDate) extraNotes.push(`Nasc: ${prefillData.birthDate}`);
        if (prefillData.motherName) extraNotes.push(`Mãe: ${prefillData.motherName}`);
        if (extraNotes.length > 0) {
          modal.querySelector('#cli-notes').value = `[IA Gemini: ${extraNotes.join(' | ')}]`;
        }
      }
    }
    modal.classList.add('active');
  };
}
