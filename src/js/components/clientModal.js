// src/js/components/clientModal.js
// Modal de Cadastro e Edição de Clientes com Máscaras

import { state } from '../state.js';
import { maskCPF, maskPhone, showToast } from '../utils.js';
import { generateClientReportPDF } from './pdfExport.js';
import { openDocumentScanner } from './documentScanner.js';

export function createClientModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-cliente';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title" id="client-modal-title">👤 Cadastro de Cliente</h3>
        <button class="modal-close-btn" id="client-modal-close">✕</button>
      </div>

      <form id="form-cliente">
        <div class="modal-body">
          <input type="hidden" id="cli-id">

          <!-- Scanner Hero CTA -->
          <div class="scanner-hero-cta" id="btn-open-doc-scanner" role="button" tabindex="0">
            <div class="scanner-hero-icon-wrap">
              <span class="scanner-hero-icon">📷</span>
            </div>
            <div class="scanner-hero-text">
              <div class="scanner-hero-title">
                Escanear CNH / RG com a Câmera
                <span class="scanner-tag-badge">IA Local • Custo Zero</span>
              </div>
              <div class="scanner-hero-sub">Tire foto ou anexe o documento para preencher nome e CPF na hora</div>
            </div>
            <span class="scanner-hero-arrow">➔</span>
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
              <label class="form-label">Endereço Residencial / Comercial</label>
              <input type="text" class="form-control" id="cli-address" placeholder="Rua, número, bairro, cidade" autocomplete="street-address">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observações Internas</label>
            <textarea class="form-control" id="cli-notes" rows="2" placeholder="Garantias, fiador, local de trabalho ou referências..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <div style="display: flex; gap: 8px; margin-right: auto;">
            <button type="button" class="btn btn-secondary" id="client-modal-statement" style="display: none; color: var(--yellow); border-color: rgba(245, 197, 24, 0.4);">📊 Extrato da Conta</button>
            <button type="button" class="btn btn-secondary" id="client-modal-pdf" style="display: none;">📄 Dossiê PDF</button>
          </div>
          <button type="button" class="btn btn-secondary" id="client-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar Cliente</button>
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
      if (extracted.birthDate) extraNotes.push(`Nascimento: ${extracted.birthDate}`);
      if (extracted.rg) extraNotes.push(`RG/Doc: ${extracted.rg}`);

      if (extraNotes.length > 0) {
        const notesInput = modal.querySelector('#cli-notes');
        const currentNotes = notesInput.value.trim();
        const prefix = currentNotes ? currentNotes + '\n' : '';
        notesInput.value = `${prefix}[Leitura CNH/RG: ${extraNotes.join(' | ')}]`;
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
    const address = modal.querySelector('#cli-address').value.trim();
    const notes = modal.querySelector('#cli-notes').value.trim();

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
      address,
      notes
    });

    closeModal();
    showToast(`Cliente ${name} salvo com sucesso!`);
    window.refreshCurrentTab();
  });

  window.openClientModal = function(clientId = null, prefillData = null) {
    const pdfBtn = modal.querySelector('#client-modal-pdf');
    const statementBtn = modal.querySelector('#client-modal-statement');
    if (clientId) {
      const client = state.getClientById(clientId);
      if (!client) return;
      modal.querySelector('#client-modal-title').textContent = '👤 Editar Cliente';
      modal.querySelector('#cli-id').value = client.id;
      modal.querySelector('#cli-name').value = client.name || '';
      modal.querySelector('#cli-cpf').value = client.cpf || '';
      modal.querySelector('#cli-phone').value = client.phone || '';
      modal.querySelector('#cli-limit').value = client.creditLimit || 5000;
      modal.querySelector('#cli-address').value = client.address || '';
      modal.querySelector('#cli-notes').value = client.notes || '';
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
      modal.querySelector('#client-modal-title').textContent = '👤 Novo Cliente';
      modal.querySelector('#cli-id').value = '';
      form.reset();
      modal.querySelector('#cli-limit').value = '5000';
      if (pdfBtn) pdfBtn.style.display = 'none';
      if (statementBtn) statementBtn.style.display = 'none';

      if (prefillData) {
        if (prefillData.name) modal.querySelector('#cli-name').value = prefillData.name;
        if (prefillData.cpf) modal.querySelector('#cli-cpf').value = maskCPF(prefillData.cpf);
        const extraNotes = [];
        if (prefillData.birthDate) extraNotes.push(`Nascimento: ${prefillData.birthDate}`);
        if (prefillData.rg) extraNotes.push(`RG/Doc: ${prefillData.rg}`);
        if (extraNotes.length > 0) {
          modal.querySelector('#cli-notes').value = `[Leitura CNH/RG: ${extraNotes.join(' | ')}]`;
        }
      }
    }
    modal.classList.add('active');
  };
}
