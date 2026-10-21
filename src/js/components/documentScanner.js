// src/js/components/documentScanner.js
// Leitor Inteligente de Documentos (CNH / RG) com OCR no Navegador de Alta Precisão (Custo Zero)

import { maskCPF, showToast } from '../utils.js';

let scannerModal = null;
let currentStream = null;
let activeFacingMode = 'environment';
let isTorchActive = false;
let tesseractWorker = null;
let isInitializingWorker = false;

/**
 * Validação rigorosa dos dígitos verificadores do CPF
 */
export function validateCPF(cpf) {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.substring(10, 11), 10)) return false;

  return true;
}

/**
 * Normaliza erros ópticos comuns do OCR em dígitos numéricos
 * Ex: Letra 'O' ou 'o' lida no lugar do zero '0', 'l' ou 'I' no lugar de '1'
 */
function cleanCpfOcr(raw) {
  if (!raw) return '';
  return raw
    .replace(/[OoQq]/g, '0')
    .replace(/[Il|/]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2')
    .replace(/\D/g, '');
}

function formatCPF(digits) {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Analisa e extrai dados de CNH / RG a partir do texto bruto do OCR
 */
export function parseBrazilianDocument(rawText) {
  if (!rawText) return { name: '', cpf: '', birthDate: '', rg: '', rawText: '' };

  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // 1. Extração de CPF
  let foundCpf = '';

  // Estratégia A: Label CPF seguido de dígitos com possíveis caracteres OCR
  const labelledMatches = rawText.matchAll(/CPF[:\s\.\-]*([0-9OolISBZG\.\-\s]{11,18})/gi);
  for (const m of labelledMatches) {
    const clean = cleanCpfOcr(m[1]);
    if (clean.length === 11 && validateCPF(clean)) {
      foundCpf = formatCPF(clean);
      break;
    }
  }

  // Estratégia B: Procura padrão de 11 dígitos em tokens separados
  if (!foundCpf) {
    const tokens = rawText.split(/[\s,;|/]+/);
    for (const t of tokens) {
      const clean = cleanCpfOcr(t);
      if (clean.length === 11 && validateCPF(clean)) {
        foundCpf = formatCPF(clean);
        break;
      }
    }
  }

  // Estratégia C: Regex padrão brasileiro 000.000.000-00
  if (!foundCpf) {
    const cpfPatt = /\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2}\b/g;
    const matches = rawText.match(cpfPatt) || [];
    for (const m of matches) {
      const clean = cleanCpfOcr(m);
      if (clean.length === 11 && validateCPF(clean)) {
        foundCpf = formatCPF(clean);
        break;
      }
    }
  }

  // Estratégia D (Fallback de tolerância): Se encontrou rótulo de CPF com 11 dígitos
  if (!foundCpf) {
    const fb = /CPF[:\s\.\-]*([0-9OolISBZG\.\-\s]{11,18})/i.exec(rawText);
    if (fb) {
      const clean = cleanCpfOcr(fb[1]);
      if (clean.length === 11) {
        foundCpf = formatCPF(clean);
      }
    }
  }

  // 2. Extração de Data de Nascimento
  let birthDate = '';
  const birthLabelMatch = /(?:NASC(?:IMENTO)?|DATA\s*DE\s*NASCIMENTO|DT\.?\s*NASC)[^\d]*(\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4})/i.exec(rawText);
  if (birthLabelMatch) {
    birthDate = birthLabelMatch[1].replace(/[\.\-]/g, '/');
  } else {
    const dateMatches = rawText.match(/\b\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4}\b/g) || [];
    const currentYear = new Date().getFullYear();
    for (const d of dateMatches) {
      const parts = d.split(/[\/\.\-]/);
      const year = parseInt(parts[2], 10);
      if (year >= 1925 && year <= currentYear - 14) {
        birthDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`;
        break;
      }
    }
  }

  // 3. Extração de RG / Documento de Identidade
  let rgNumber = '';
  const rgMatch = /(?:IDENTIDADE|DOC\.?\s*IDENTIDADE|REGISTRO\s*GERAL|RG)[^\d]*(\d[\d\.\-\s]{5,14}[\dX])/i.exec(rawText);
  if (rgMatch) {
    rgNumber = rgMatch[1].trim().replace(/\s+/g, '');
  }

  // 4. Extração de Nome Completo
  let foundName = '';
  const ignoreTokens = [
    'REPUBLICA', 'FEDERATIVA', 'BRASIL', 'MINISTERIO', 'INFRAESTRUTURA',
    'TRANSPORTES', 'CONTRAN', 'DENATRAN', 'SENATRAN', 'CARTEIRA', 'NACIONAL', 'HABILITACAO',
    'DETRAN', 'VALIDA', 'TERRITORIO', 'DOCUMENTO', 'IDENTIDADE', 'CONDUTOR',
    'REGISTRO', 'FILIACAO', 'PERMISSAO', 'ASSINATURA', 'PORTADOR',
    'SECRETARIA', 'SEGURANCA', 'PUBLICA', 'POLICIA', 'CIVIL', 'INSTITUTO',
    'IDENTIFICACAO', 'LOCAL', 'DATA', 'EMISSAO', 'VALIDADE', 'PRIMEIRA',
    'ESTADO', 'PREFEITURA', 'DEPARTAMENTO', 'TRANSITO', 'CATEGORIA', 'HABILITADO',
    'OBSERVACOES', 'ACC', 'VALOR', 'PAGAMENTO', 'NOME', 'SOBRENOME', 'CPF',
    'NASCIMENTO', 'ORGAO', 'EMISSOR', 'NATURALIDADE', 'DOC'
  ];

  function cleanCandidate(str) {
    if (!str) return '';
    // Remove prefixos como '1 NOME', '1. NOME', 'NOME:', etc.
    let s = str.replace(/^(?:[0-9\.\-\s]+)?NOME(?:\s*DO\s*CONDUTOR|\s*DO\s*PORTADOR|\s*COMPLETO)?(?:\s*\/.*?)?[:\s\-]*/i, '').trim();
    // Remove prefixos de número de campo comuns na CNH como "1 ", "1. "
    s = s.replace(/^[0-9]+[\.\-\s]+/, '');
    s = s.replace(/[^A-Za-zÁÉÍÓÚÂÊÎÔÛÃÕÇáéíóúâêîôûãõç\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = s.split(' ').filter(w => w.length > 1);
    if (words.length >= 2 && words.length <= 6) {
      const hasBad = words.some(w => {
        const u = w.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return ignoreTokens.includes(u);
      });
      if (!hasBad) return s;
    }
    return '';
  }

  // Estratégia A: Próximo à linha contendo NOME
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/NOME/i.test(l)) {
      const sameLine = cleanCandidate(l);
      if (sameLine) {
        foundName = sameLine;
        break;
      }
      if (i + 1 < lines.length) {
        const nextLine = cleanCandidate(lines[i + 1]);
        if (nextLine) {
          foundName = nextLine;
          break;
        }
      }
      if (i + 2 < lines.length) {
        const nextNextLine = cleanCandidate(lines[i + 2]);
        if (nextNextLine) {
          foundName = nextNextLine;
          break;
        }
      }
    }
  }

  // Estratégia B: Se não encontrou linha de NOME, examina todas as linhas válidas
  if (!foundName) {
    for (const l of lines) {
      const candidate = cleanCandidate(l);
      if (candidate) {
        foundName = candidate;
        break;
      }
    }
  }

  // Formatação em Title Case elegante
  if (foundName) {
    foundName = foundName
      .toLowerCase()
      .split(/\s+/)
      .map(w => {
        if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }

  return {
    name: foundName,
    cpf: foundCpf,
    birthDate,
    rg: rgNumber,
    rawText
  };
}

/**
 * Corta exatamente a região do documento enquadrada na moldura amarela
 * eliminando mesas, fundos e mãos, e ajustando para alta resolução
 */
function captureFromVideo(videoEl, guideBoxEl) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  if (!guideBoxEl) {
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(videoEl, 0, 0, vw, vh);
    return canvas;
  }

  const vRect = videoEl.getBoundingClientRect();
  const gRect = guideBoxEl.getBoundingClientRect();

  const vAspect = vw / vh;
  const eAspect = vRect.width / vRect.height;

  let renderW, renderH, offsetX, offsetY;
  if (eAspect > vAspect) {
    renderW = vRect.width;
    renderH = vRect.width / vAspect;
    offsetX = 0;
    offsetY = (renderH - vRect.height) / 2;
  } else {
    renderH = vRect.height;
    renderW = vRect.height * vAspect;
    offsetY = 0;
    offsetX = (renderW - vRect.width) / 2;
  }

  const scale = renderW / vw;

  const relX = (gRect.left - vRect.left + offsetX) / scale;
  const relY = (gRect.top - vRect.top + offsetY) / scale;
  const relW = gRect.width / scale;
  const relH = gRect.height / scale;

  // Margem de segurança de 10% para não cortar bordas
  const padX = relW * 0.10;
  const padY = relH * 0.10;

  const cropX = Math.max(0, Math.floor(relX - padX));
  const cropY = Math.max(0, Math.floor(relY - padY));
  const cropW = Math.min(vw - cropX, Math.ceil(relW + padX * 2));
  const cropH = Math.min(vh - cropY, Math.ceil(relH + padY * 2));

  if (cropW < 200 || cropH < 200) {
    canvas.width = vw;
    canvas.height = vh;
    ctx.drawImage(videoEl, 0, 0, vw, vh);
    return canvas;
  }

  // Redimensiona o recorte para resolução ideal de leitura (~1600-2000px)
  const targetW = Math.min(2200, Math.max(1500, cropW));
  const targetH = Math.round((cropH / cropW) * targetW);

  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

  return canvas;
}

/**
 * Pré-processamento profissional de imagem para OCR
 * Converte para tons de cinza e aplica realce de contraste linear SEM inversão
 */
function preprocessImage(sourceImage, mode = 'enhanced') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const width = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height;

  // Ajusta escala mantendo alta densidade de pixels para fontes pequenas
  const targetWidth = Math.min(2200, Math.max(1400, width));
  const scale = targetWidth / width;
  canvas.width = targetWidth;
  canvas.height = Math.round(height * scale);

  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  if (mode === 'raw') {
    return canvas;
  }

  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Realce de contraste linear seguro (sem inversão)
    const factor = 1.35;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = Math.min(255, Math.max(0, Math.round((gray - 128) * factor + 128)));
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Processamento de contraste ignorado por segurança:', e);
  }

  return canvas;
}

/**
 * Cria ou recupera o elemento do Modal do Scanner
 */
function getOrCreateScannerModal() {
  if (scannerModal) return scannerModal;

  const modal = document.createElement('div');
  modal.className = 'scanner-modal-overlay';
  modal.id = 'modal-scanner-doc';

  modal.innerHTML = `
    <div class="scanner-modal-card">
      <div class="scanner-modal-header">
        <div class="scanner-header-info">
          <div class="scanner-header-badge">⚡ IA Local • Custo Zero</div>
          <h3 class="scanner-modal-title">📷 Leitor Inteligente de CNH & RG</h3>
          <p class="scanner-modal-subtitle">Aponte a câmera com foco e boa iluminação para ler nome e CPF</p>
        </div>
        <button type="button" class="scanner-close-btn" id="scanner-btn-close" title="Fechar">✕</button>
      </div>

      <!-- Abas de Modo -->
      <div class="scanner-tabs">
        <button type="button" class="scanner-tab active" id="tab-camera-mode">
          📹 Câmera ao Vivo
        </button>
        <button type="button" class="scanner-tab" id="tab-upload-mode">
          📁 Foto / Galeria / WhatsApp
        </button>
      </div>

      <div class="scanner-modal-body">
        
        <!-- VISÃO 1: Câmera ao Vivo -->
        <div class="scanner-view-section" id="view-camera">
          <div class="scanner-video-container">
            <video id="scanner-video" autoplay playsinline muted></video>
            <div class="scanner-overlay-guide">
              <div class="scanner-target-box" id="scanner-target-frame">
                <div class="scanner-corner corner-tl"></div>
                <div class="scanner-corner corner-tr"></div>
                <div class="scanner-corner corner-bl"></div>
                <div class="scanner-corner corner-br"></div>
                <div class="scanner-laser-line"></div>
                <div class="scanner-guide-text">Enquadre o documento nesta moldura</div>
              </div>
            </div>
          </div>

          <!-- Ações da Câmera -->
          <div class="scanner-camera-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-torch-toggle" style="display: none; border-radius: 4px;">
              💡 Lanterna
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-switch-camera" title="Inverter Câmera" style="border-radius: 4px;">
              🔄 Inverter Câmera
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-native-camera" title="Abrir Câmera em Alta Definição com foco automático do celular" style="border-radius: 4px; color: var(--yellow); border-color: rgba(245, 197, 24, 0.4);">
              📷 Câmera HD Nativa
            </button>
            <button type="button" class="btn btn-primary btn-capture" id="btn-snap-photo" style="flex: 1 1 100%; border-radius: 4px; padding: 12px; font-weight: 800; font-size: 0.95rem;">
              📸 Tirar Foto e Ler Documento
            </button>
          </div>
        </div>

        <!-- VISÃO 2: Envio de Arquivo / Foto Nativa do Celular -->
        <div class="scanner-view-section" id="view-upload" style="display: none;">
          <label class="scanner-dropzone" for="scanner-file-input">
            <div class="dropzone-icon">🪪</div>
            <div class="dropzone-title">Toque aqui para Tirar Foto ou Escolher da Galeria</div>
            <p class="dropzone-desc">Funciona com foto nítida de CNH física, CNH Digital ou print do WhatsApp (JPG, PNG)</p>
            <span class="btn btn-primary btn-sm" style="margin-top: 10px; pointer-events: none; border-radius: 4px;">
              Selecionar Imagem do Documento
            </span>
            <input type="file" id="scanner-file-input" accept="image/*" capture="environment" style="display: none;">
          </label>
        </div>

        <!-- VISÃO 3: Carregamento / Processamento OCR -->
        <div class="scanner-view-section" id="view-processing" style="display: none;">
          <div class="scanner-processing-box">
            <div class="scanner-preview-thumb">
              <img id="scanner-preview-img" alt="Documento capturado">
            </div>
            <div class="scanner-spinner-ring"></div>
            <h4 class="processing-title" id="processing-status-title">Lendo dados do documento...</h4>
            <p class="processing-desc" id="processing-status-desc">O algoritmo OCR está analisando os caracteres da imagem</p>
            
            <div class="scanner-progress-track">
              <div class="scanner-progress-bar" id="scanner-progress-fill" style="width: 25%;"></div>
            </div>
            <span class="scanner-progress-num" id="scanner-progress-text">25%</span>
          </div>
        </div>

        <!-- VISÃO 4: Revisão e Confirmação de Resultados -->
        <div class="scanner-view-section" id="view-results" style="display: none;">
          <div class="scanner-results-card">
            <div class="results-badge-ok">
              <span>✅</span> Leitura Concluída
            </div>
            <p class="results-helper-text">
              Confira os dados lidos e edite qualquer campo se necessário:
            </p>

            <div class="scanner-form-grid">
              <div class="form-group">
                <label class="form-label">Nome Completo Reconhecido</label>
                <input type="text" class="form-control" id="scan-out-name" placeholder="Ex: João da Silva">
              </div>

              <div class="form-group">
                <label class="form-label">
                  CPF Extraído
                  <span class="badge" id="scan-cpf-status-badge">Validação</span>
                </label>
                <input type="text" class="form-control" id="scan-out-cpf" placeholder="000.000.000-00">
              </div>

              <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Data de Nascimento</label>
                  <input type="text" class="form-control" id="scan-out-birth" placeholder="DD/MM/AAAA">
                </div>

                <div class="form-group">
                  <label class="form-label">RG / Órgão</label>
                  <input type="text" class="form-control" id="scan-out-rg" placeholder="Número do RG">
                </div>
              </div>
            </div>

            <!-- Diagnóstico / Texto Lido pelo OCR -->
            <details style="margin-top: 14px; background: var(--bg-2); border: 1px solid var(--border-soft); border-radius: 4px; padding: 8px 12px; font-size: 0.75rem;">
              <summary style="cursor: pointer; font-weight: 700; color: var(--yellow);">🔍 Ver texto bruto lido pelo OCR (Diagnóstico)</summary>
              <pre style="white-space: pre-wrap; word-break: break-all; margin-top: 8px; color: var(--text-muted); max-height: 120px; overflow-y: auto;" id="scan-raw-text">-</pre>
            </details>

            <div class="scanner-action-row" style="margin-top: 16px;">
              <button type="button" class="btn btn-secondary" id="btn-scan-retry" style="border-radius: 4px;">
                🔄 Tirar Outra Foto
              </button>
              <button type="button" class="btn btn-primary" id="btn-scan-apply" style="border-radius: 4px;">
                ✅ Preencher Cadastro Automaticamente
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
  scannerModal = modal;
  return modal;
}

/**
 * Inicializa a câmera no elemento de vídeo com foco contínuo e resolução full
 */
async function startCamera(videoEl) {
  stopCamera();
  try {
    const constraints = {
      video: {
        facingMode: activeFacingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      },
      audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = currentStream;
    await videoEl.play();

    // Aplica foco contínuo em navegadores que suportam
    const track = currentStream.getVideoTracks()[0];
    if (track) {
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        const adv = {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) {
          adv.focusMode = 'continuous';
        }
        if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
          adv.exposureMode = 'continuous';
        }
        if (Object.keys(adv).length > 0) {
          await track.applyConstraints({ advanced: [adv] });
        }

        // Exibe botão de lanterna se suportado
        const torchBtn = scannerModal?.querySelector('#btn-torch-toggle');
        if (torchBtn && caps.torch) {
          torchBtn.style.display = 'inline-flex';
          isTorchActive = false;
        }
      } catch (e) {
        console.warn('Recursos avançados de câmera não puderam ser ativados:', e);
      }
    }

    return true;
  } catch (err) {
    console.warn('Falha ao abrir câmera direta via getUserMedia:', err);
    return false;
  }
}

/**
 * Interrompe o stream da câmera
 */
function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  isTorchActive = false;
}

/**
 * Liga/desliga lanterna se o dispositivo possuir
 */
async function toggleTorch() {
  if (!currentStream) return;
  const track = currentStream.getVideoTracks()[0];
  if (!track) return;

  try {
    isTorchActive = !isTorchActive;
    await track.applyConstraints({ advanced: [{ torch: isTorchActive }] });
    const torchBtn = scannerModal?.querySelector('#btn-torch-toggle');
    if (torchBtn) {
      torchBtn.textContent = isTorchActive ? '🔦 Desligar Luz' : '💡 Lanterna';
      torchBtn.classList.toggle('active', isTorchActive);
    }
  } catch (e) {
    console.warn('Falha ao alternar lanterna:', e);
  }
}

/**
 * Inicializa ou reaproveita o Worker do Tesseract
 */
async function getOrInitWorker(onProgress) {
  if (tesseractWorker) return tesseractWorker;
  if (isInitializingWorker) {
    while (isInitializingWorker) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (tesseractWorker) return tesseractWorker;
  }

  isInitializingWorker = true;
  try {
    onProgress(15, 'Carregando motor OCR...');
    const { createWorker } = await import('tesseract.js');

    tesseractWorker = await createWorker('por', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 65) + 30;
          onProgress(Math.min(95, pct), 'Lendo texto do documento...');
        } else if (m.status === 'loading language traineddata') {
          onProgress(22, 'Baixando biblioteca em português...');
        }
      }
    });

    await tesseractWorker.setParameters({
      preserve_interword_spaces: '1'
    });

    return tesseractWorker;
  } finally {
    isInitializingWorker = false;
  }
}

/**
 * Executa o OCR utilizando reconhecimento em dois passos para garantir leitura de CPF e Nome
 */
async function processImageWithOCR(imageElementOrCanvas, onProgress) {
  const worker = await getOrInitWorker(onProgress);

  onProgress(35, 'Analisando imagem...');
  const { data } = await worker.recognize(imageElementOrCanvas);
  onProgress(100, 'Extraindo campos...');
  return data.text || '';
}

/**
 * Abre o scanner e gerencia todo o ciclo de leitura e preenchimento
 */
export function openDocumentScanner(onConfirmCallback) {
  const modal = getOrCreateScannerModal();
  const videoEl = modal.querySelector('#scanner-video');
  const targetFrameEl = modal.querySelector('#scanner-target-frame');
  const viewCamera = modal.querySelector('#view-camera');
  const viewUpload = modal.querySelector('#view-upload');
  const viewProcessing = modal.querySelector('#view-processing');
  const viewResults = modal.querySelector('#view-results');

  const tabCamera = modal.querySelector('#tab-camera-mode');
  const tabUpload = modal.querySelector('#tab-upload-mode');
  const fileInput = modal.querySelector('#scanner-file-input');

  const btnClose = modal.querySelector('#scanner-btn-close');
  const btnSnap = modal.querySelector('#btn-snap-photo');
  const btnSwitchCam = modal.querySelector('#btn-switch-camera');
  const btnNativeCam = modal.querySelector('#btn-native-camera');
  const btnTorch = modal.querySelector('#btn-torch-toggle');
  const btnRetry = modal.querySelector('#btn-scan-retry');
  const btnApply = modal.querySelector('#btn-scan-apply');

  const previewImg = modal.querySelector('#scanner-preview-img');
  const progressFill = modal.querySelector('#scanner-progress-fill');
  const progressText = modal.querySelector('#scanner-progress-text');
  const statusTitle = modal.querySelector('#processing-status-title');
  const rawTextPre = modal.querySelector('#scan-raw-text');

  const outName = modal.querySelector('#scan-out-name');
  const outCpf = modal.querySelector('#scan-out-cpf');
  const outBirth = modal.querySelector('#scan-out-birth');
  const outRg = modal.querySelector('#scan-out-rg');
  const cpfBadge = modal.querySelector('#scan-cpf-status-badge');

  function showSection(section) {
    viewCamera.style.display = section === 'camera' ? 'flex' : 'none';
    viewUpload.style.display = section === 'upload' ? 'flex' : 'none';
    viewProcessing.style.display = section === 'processing' ? 'flex' : 'none';
    viewResults.style.display = section === 'results' ? 'block' : 'none';

    tabCamera.classList.toggle('active', section === 'camera');
    tabUpload.classList.toggle('active', section === 'upload');
    modal.querySelector('.scanner-tabs').style.display = (section === 'camera' || section === 'upload') ? 'flex' : 'none';
  }

  function updateProgress(pct, message) {
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${pct}%`;
    if (message) statusTitle.textContent = message;
  }

  function closeModal() {
    stopCamera();
    modal.classList.remove('active');
  }

  tabCamera.onclick = async () => {
    showSection('camera');
    const started = await startCamera(videoEl);
    if (!started) {
      showToast('Câmera ao vivo indisponível no navegador. Abrindo câmera nativa...', 'warning');
      showSection('upload');
    }
  };

  tabUpload.onclick = () => {
    stopCamera();
    showSection('upload');
  };

  btnSwitchCam.onclick = async () => {
    activeFacingMode = activeFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(videoEl);
  };

  btnNativeCam.onclick = () => {
    stopCamera();
    fileInput.click();
  };

  btnTorch.onclick = toggleTorch;

  // Processamento inteligente da imagem com multi-passagem
  async function handleImageProcessing(imgSource) {
    showSection('processing');
    updateProgress(10, 'Otimizando imagem...');

    // Preview
    if (imgSource instanceof HTMLCanvasElement) {
      previewImg.src = imgSource.toDataURL('image/jpeg', 0.90);
    } else if (imgSource instanceof HTMLImageElement) {
      previewImg.src = imgSource.src;
    }

    try {
      // Passagem 1: Imagem com realce de contraste
      const enhancedCanvas = preprocessImage(imgSource, 'enhanced');
      let rawText = await processImageWithOCR(enhancedCanvas, (pct, msg) => {
        updateProgress(pct, msg);
      });

      console.log('Texto reconhecido pelo OCR (Passo 1):', rawText);
      let parsed = parseBrazilianDocument(rawText);

      // Passagem 2 (Recuperação): Se não detectou CPF ou Nome, executa no original com cores
      if (!parsed.cpf || !parsed.name) {
        updateProgress(75, 'Refinando leitura com segunda passagem...');
        const rawCanvas = preprocessImage(imgSource, 'raw');
        const rawText2 = await processImageWithOCR(rawCanvas, () => {});
        console.log('Texto reconhecido pelo OCR (Passo 2):', rawText2);
        const parsed2 = parseBrazilianDocument(rawText2);

        if (!parsed.name && parsed2.name) parsed.name = parsed2.name;
        if (!parsed.cpf && parsed2.cpf) parsed.cpf = parsed2.cpf;
        if (!parsed.birthDate && parsed2.birthDate) parsed.birthDate = parsed2.birthDate;
        if (!parsed.rg && parsed2.rg) parsed.rg = parsed2.rg;
        rawText += '\n\n--- Leitura Adicional ---\n' + rawText2;
      }

      // Preenche os campos de revisão
      outName.value = parsed.name || '';
      outCpf.value = parsed.cpf || '';
      outBirth.value = parsed.birthDate || '';
      outRg.value = parsed.rg || '';
      rawTextPre.textContent = rawText.trim() || 'Nenhum texto detectado na imagem.';

      // Badge de validação do CPF
      if (parsed.cpf) {
        const isValid = validateCPF(parsed.cpf);
        cpfBadge.textContent = isValid ? '✅ CPF Válido' : '⚠️ Conferir CPF';
        cpfBadge.className = `badge ${isValid ? 'badge-paid' : 'badge-overdue'}`;
      } else {
        cpfBadge.textContent = 'Não detectado';
        cpfBadge.className = 'badge badge-pending';
      }

      showSection('results');

      if (!parsed.name && !parsed.cpf) {
        showToast('Documento lido, mas nome e CPF não foram detectados com certeza. Você pode digitar ou tirar foto com a Câmera HD.', 'warning');
      } else {
        showToast('Dados do documento extraídos com sucesso!', 'success');
      }

    } catch (err) {
      console.error('Erro no processamento OCR:', err);
      showToast('Falha ao processar o texto do documento. Tente novamente com a Câmera HD.', 'error');
      showSection('upload');
    }
  }

  // Capturar frame da câmera com recorte inteligente na moldura
  btnSnap.onclick = () => {
    if (!videoEl.videoWidth) {
      showToast('Aguarde a câmera iniciar.', 'warning');
      return;
    }

    const croppedCanvas = captureFromVideo(videoEl, targetFrameEl);
    if (!croppedCanvas) {
      showToast('Erro ao capturar frame de vídeo.', 'error');
      return;
    }

    stopCamera();
    handleImageProcessing(croppedCanvas);
  };

  // Upload de arquivo ou foto da câmera nativa
  fileInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        handleImageProcessing(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  };

  btnRetry.onclick = () => {
    tabCamera.click();
  };

  btnApply.onclick = () => {
    const finalData = {
      name: outName.value.trim(),
      cpf: outCpf.value.trim(),
      birthDate: outBirth.value.trim(),
      rg: outRg.value.trim(),
      rawText: rawTextPre.textContent
    };

    if (onConfirmCallback) {
      onConfirmCallback(finalData);
    }

    closeModal();
    showToast('Dados preenchidos no cadastro do cliente!', 'success');
  };

  btnClose.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  modal.classList.add('active');
  tabCamera.click();
}
