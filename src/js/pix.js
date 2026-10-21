// src/js/pix.js
// Gerador Oficial de PIX Copia e Cola (EMV BR Code Banco Central) e QR Code

import QRCode from 'qrcode';
import { state } from './state.js';
import { formatBRL, formatDate, createWhatsAppUrl, showToast } from './utils.js';
import { calculateLateCharges } from './finance.js';
import { icon } from './icons.js';

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTag(id, value) {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

export function generatePixPayload({ key, name, city, amount, txid = '***' }) {
  // Limpa chave se for CPF ou CNPJ
  let cleanKey = key;
  if (key.includes('/') || key.includes('-') || key.includes('.')) {
    cleanKey = key.replace(/[^\d]/g, '');
  }

  const cleanName = (name || 'VANDO MOTOS')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .substring(0, 25);

  const cleanCity = (city || 'PORTO VELHO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .substring(0, 15);

  const accountInfo = formatTag('00', 'BR.GOV.BCB.PIX') + formatTag('01', cleanKey);
  const additionalData = formatTag('05', txid);

  let payload = 
    formatTag('00', '01') +
    formatTag('26', accountInfo) +
    formatTag('52', '0000') +
    formatTag('53', '986');

  if (amount && Number(amount) > 0) {
    payload += formatTag('54', Number(amount).toFixed(2));
  }

  payload += 
    formatTag('58', 'BR') +
    formatTag('59', cleanName) +
    formatTag('60', cleanCity) +
    formatTag('62', additionalData) +
    '6304';

  const crc = crc16(payload);
  return payload + crc;
}

export function createPixModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-pix-qrcode';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 480px; text-align: center;">
      <div class="modal-header">
        <h3 class="modal-title">${icon('zap', 18)} Cobrança via PIX</h3>
        <button class="modal-close-btn" id="pix-modal-close">${icon('x', 16)}</button>
      </div>

      <div class="modal-body" style="padding: 24px;">
        <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 4px;" id="pix-client-title">Cliente</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: var(--emerald-400); margin-bottom: 16px;" id="pix-amount-title">R$ 0,00</div>

        <!-- Container do QR Code -->
        <div style="background: #fff; padding: 14px; border-radius: var(--radius-md); display: inline-block; box-shadow: var(--shadow-sm); margin-bottom: 16px;">
          <canvas id="pix-qrcode-canvas" style="display: block; width: 200px; height: 200px;"></canvas>
        </div>

        <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 14px;">
          Aponte a câmera do aplicativo do seu banco para escanear ou copie o código abaixo:
        </div>

        <!-- Campo Copia e Cola -->
        <div class="form-group" style="text-align: left;">
          <label class="form-label" style="font-size: 0.75rem;">Código PIX Copia e Cola</label>
          <div style="position: relative;">
            <textarea class="form-control" id="pix-copia-cola-text" rows="3" readonly style="font-family: monospace; font-size: 0.75rem; word-break: break-all; resize: none;"></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="justify-content: space-between;">
        <button type="button" class="btn btn-secondary btn-sm" id="pix-modal-close-btn">Fechar</button>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-whatsapp btn-sm" id="pix-modal-wpp-btn">
            ${icon('whatsapp', 14)} Enviar no WhatsApp
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="pix-modal-copy-btn">
            ${icon('copy', 14)} Copiar Código PIX
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#pix-modal-close');
  const closeBtn2 = modal.querySelector('#pix-modal-close-btn');
  const copyBtn = modal.querySelector('#pix-modal-copy-btn');
  const wppBtn = modal.querySelector('#pix-modal-wpp-btn');
  const textarea = modal.querySelector('#pix-copia-cola-text');
  const canvas = modal.querySelector('#pix-qrcode-canvas');

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('Código PIX Copia e Cola copiado com sucesso!');
    });
  });

  let currentWppData = null;
  wppBtn.addEventListener('click', () => {
    if (!currentWppData) return;
    const msg = `Olá, ${currentWppData.clientName}! Segue o seu código PIX para pagamento da parcela nº ${currentWppData.instNumber} no valor de ${formatBRL(currentWppData.amount)}:\n\n*PIX Copia e Cola:*\n\`${textarea.value}\`\n\nBeneficiário: ${currentWppData.businessName}\nBasta copiar e colar no app do seu banco. Obrigado!`;
    const url = createWhatsAppUrl(currentWppData.phone, msg);
    if (url) window.open(url, '_blank');
  });

  window.openPixModal = function(installmentId) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;

    const client = state.getClientById(inst.clientId) || { name: 'Cliente', phone: '' };
    const loan = state.getLoanById(inst.loanId) || {};
    const settings = state.getSettings();

    // Se estiver atrasada, calcula com multa e juros
    let finalAmount = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
    const today = new Date().toISOString().split('T')[0];
    if (inst.dueDate < today && inst.status !== 'paid') {
      const charges = calculateLateCharges(
        inst,
        new Date(),
        loan.penaltyRate || settings.defaultPenaltyRate,
        loan.dailyInterestRate || settings.defaultDailyRate
      );
      finalAmount = charges.totalUpdatedAmount;
    }

    modal.querySelector('#pix-client-title').textContent = `${client.name} • Parcela nº ${inst.number} (Venc. ${formatDate(inst.dueDate)})`;
    modal.querySelector('#pix-amount-title').textContent = formatBRL(finalAmount);

    const payload = generatePixPayload({
      key: settings.pixKey,
      name: settings.pixHolder || settings.businessName,
      city: settings.creditorCity || 'PORTO VELHO',
      amount: finalAmount,
      txid: `PARC${inst.number}`
    });

    textarea.value = payload;

    QRCode.toCanvas(canvas, payload, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, (err) => {
      if (err) console.error('Erro ao renderizar QRCode PIX:', err);
    });

    currentWppData = {
      clientName: client.name,
      phone: client.phone,
      instNumber: inst.number,
      amount: finalAmount,
      businessName: settings.businessName
    };

    modal.classList.add('active');
  };
}
