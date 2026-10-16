// src/js/components/clientModal.js
// Modal de Cadastro e Edição de Clientes com Máscaras

import { state } from '../state.js';
import { maskCPF, maskPhone, showToast } from '../utils.js';
import { generateClientReportPDF } from './pdfExport.js';

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
          <button type="button" class="btn btn-secondary" id="client-modal-pdf" style="display: none; margin-right: auto;">📄 Dossiê PDF</button>
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

  window.openClientModal = function(clientId = null) {
    const pdfBtn = modal.querySelector('#client-modal-pdf');
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
    } else {
      modal.querySelector('#client-modal-title').textContent = '👤 Novo Cliente';
      modal.querySelector('#cli-id').value = '';
      form.reset();
      modal.querySelector('#cli-limit').value = '5000';
      if (pdfBtn) pdfBtn.style.display = 'none';
    }
    modal.classList.add('active');
  };
}
