// src/js/components/signaturePad.js
// Captura de Assinatura Digital na Tela do Celular / Computador (Touch & Mouse) - Vando Motos

import { icon } from '../icons.js';

let signatureModal = null;
let currentResolve = null;

export function openSignaturePad({ title = 'Assinatura Digital do Cliente', signerName = 'Devedor' } = {}) {
  return new Promise((resolve) => {
    currentResolve = resolve;
    const modal = getOrCreateSignatureModal();

    modal.querySelector('#sig-modal-title').textContent = title;
    modal.querySelector('#sig-signer-name').textContent = signerName;

    const canvas = modal.querySelector('#sig-canvas');
    initCanvas(canvas);

    modal.classList.add('active');
  });
}

function getOrCreateSignatureModal() {
  if (signatureModal) return signatureModal;

  const modal = document.createElement('div');
  modal.className = 'sig-modal-overlay';
  modal.id = 'modal-signature-pad';

  modal.innerHTML = `
    <div class="sig-modal-card">
      <div class="sig-modal-header">
        <div>
          <div class="sig-badge">Validade Digital • Touch Screen</div>
          <h3 class="sig-title" id="sig-modal-title">${icon('pen', 18)} Assinatura do Cliente</h3>
          <p class="sig-subtitle">Peça para o cliente assinar com o dedo no espaço abaixo</p>
        </div>
        <button type="button" class="sig-close-btn" id="sig-btn-close">${icon('x', 16)}</button>
      </div>

      <div class="sig-body">
        <div class="sig-canvas-wrap">
          <canvas id="sig-canvas"></canvas>
          <div class="sig-guide-line">
            <span>Assine aqui (com o dedo ou caneta)</span>
          </div>
        </div>

        <div class="sig-signer-info">
          <span>Assinante:</span> <strong id="sig-signer-name">Cliente</strong>
        </div>
      </div>

      <div class="sig-footer">
        <button type="button" class="btn btn-secondary" id="sig-btn-clear">
          ${icon('trash', 14)} Limpar
        </button>
        <button type="button" class="btn btn-primary" id="sig-btn-confirm">
          ${icon('check', 14)} Confirmar Assinatura
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  signatureModal = modal;

  const closeBtn = modal.querySelector('#sig-btn-close');
  const clearBtn = modal.querySelector('#sig-btn-clear');
  const confirmBtn = modal.querySelector('#sig-btn-confirm');
  const canvas = modal.querySelector('#sig-canvas');

  function close(sigData = null) {
    modal.classList.remove('active');
    if (currentResolve) {
      currentResolve(sigData);
      currentResolve = null;
    }
  }

  closeBtn.addEventListener('click', () => close(null));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close(null);
  });

  clearBtn.addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.hasDrawing = 'false';
  });

  confirmBtn.addEventListener('click', () => {
    if (canvas.dataset.hasDrawing !== 'true') {
      alert('Por favor, faça a assinatura antes de confirmar.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    close({
      dataUrl,
      timestamp: new Date().toISOString(),
      dateFormatted: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date())
    });
  });

  return modal;
}

function initCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Ajusta resolução do canvas para não pixelar em telas Retina/OLED
  const displayWidth = rect.width || 440;
  const displayHeight = 220;

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0f172a'; // Tinta escura tipo caneta real

  ctx.clearRect(0, 0, displayWidth, displayHeight);
  canvas.dataset.hasDrawing = 'false';

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  function getCoords(e) {
    const canvasRect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - canvasRect.left,
        y: e.touches[0].clientY - canvasRect.top
      };
    }
    return {
      x: e.clientX - canvasRect.left,
      y: e.clientY - canvasRect.top
    };
  }

  function startDrawing(e) {
    isDrawing = true;
    const { x, y } = getCoords(e);
    lastX = x;
    lastY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.dataset.hasDrawing = 'true';
    if (e.cancelable) e.preventDefault();
  }

  function draw(e) {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
    if (e.cancelable) e.preventDefault();
  }

  function stopDrawing() {
    isDrawing = false;
    ctx.closePath();
  }

  // Mouse events
  canvas.onmousedown = startDrawing;
  canvas.onmousemove = draw;
  window.onmouseup = stopDrawing;

  // Touch events (celulares / tablets)
  canvas.ontouchstart = startDrawing;
  canvas.ontouchmove = draw;
  canvas.ontouchend = stopDrawing;
  canvas.ontouchcancel = stopDrawing;
}
