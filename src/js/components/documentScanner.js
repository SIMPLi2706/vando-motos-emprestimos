// src/js/components/documentScanner.js
// Leitor Inteligente de Documentos (CNH / RG / CIN) com Inteligência Artificial Multimodal (Google Gemini Vision)

import { maskCPF, showToast } from '../utils.js';
import { state } from '../state.js';
import { icon } from '../icons.js';

let scannerModal = null;
let currentStream = null;
let activeFacingMode = 'environment';
let isTorchActive = false;
let pendingImageBase64 = null;

/**
 * Validação matemática rigorosa dos dígitos verificadores do CPF
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
 * Prepara e redimensiona a imagem para transmissão ultra-rápida e máxima nitidez visual
 */
function prepareImageForGemini(imgOrCanvas) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let w = imgOrCanvas.naturalWidth || imgOrCanvas.videoWidth || imgOrCanvas.width || 1200;
  let h = imgOrCanvas.naturalHeight || imgOrCanvas.videoHeight || imgOrCanvas.height || 800;

  // Escala para resolução ideal de leitura visual (max 1600px na maior dimensão)
  const maxDim = 1600;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(imgOrCanvas, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
  const base64 = dataUrl.split(',')[1];
  return { dataUrl, base64 };
}

/**
 * Corta a região do documento enquadrada na moldura da câmera ao vivo
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

  // Margem de 10% para garantir captura de bordas
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

  const targetW = Math.min(1800, Math.max(1200, cropW));
  const targetH = Math.round((cropH / cropW) * targetW);

  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

  return canvas;
}

/**
 * Chamada Multimodal à IA do Google Gemini (Vision) para extração de CNH/RG
 */
export async function analyzeDocumentWithGemini(base64Image, apiKey) {
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `Você é um perito em análise e extração de dados cadastrais de documentos de identificação brasileiros (CNH - Carteira Nacional de Habilitação modelos novo e antigo, RG - Registro Geral de qualquer estado do Brasil, e CIN - Carteira de Identidade Nacional).

Analise visualmente a imagem deste documento com máxima atenção aos detalhes e extraia os dados cadastrais do cidadão.
Retorne EXCLUSIVAMENTE um objeto JSON válido, sem blocos de markdown, sem crases (backticks), sem texto antes ou depois:

{
  "tipoDocumento": "CNH" | "RG" | "CIN" | "OUTRO",
  "nome": "NOME COMPLETO EM MAIÚSCULAS CONFORME NO DOCUMENTO",
  "cpf": "000.000.000-00",
  "rg": "NÚMERO DO DOCUMENTO COM ÓRGÃO SE VISÍVEL",
  "dataNascimento": "DD/MM/AAAA",
  "filiacao": "NOME DA MÃE OU DOS PAIS",
  "cidadeUf": "CIDADE E UF DE EMISSÃO OU RESIDÊNCIA",
  "confianca": 98
}

Regras obrigatórias:
1. "nome": Extraia o nome completo do titular sem abreviações indevidas. Remova títulos ou palavras do cabeçalho como "NOME", "CONDUTOR", "DETRAN", "SSP", "REPÚBLICA FEDERATIVA".
2. "cpf": Formate sempre no padrão com pontos e traço "000.000.000-00".
3. "dataNascimento": Formate estritamente no padrão brasileiro "DD/MM/AAAA".
4. Se algum campo não for identificado ou não estiver presente na imagem, retorne string vazia "".
5. Não invente nenhum dado. Retorne apenas o que for visível no documento.`;

  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `Erro HTTP ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) throw new Error('A IA não retornou resposta para esta imagem.');

      let cleanJson = textResponse.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/i, '');
      }

      const parsed = JSON.parse(cleanJson);
      return parsed;
    } catch (err) {
      console.warn(`Tentativa com modelo ${model} falhou:`, err.message);
      lastError = err;
      if (err.message && (err.message.includes('API key not valid') || err.message.includes('PERMISSION_DENIED') || err.message.includes('403'))) {
        throw new Error('Chave de API do Google Gemini inválida. Verifique sua chave em aistudio.google.com/apikey');
      }
    }
  }

  throw lastError || new Error('Não foi possível conectar aos servidores da IA do Google.');
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
          <div class="scanner-header-badge">${icon('sparkles', 13)} Reconhecimento Óptico Gemini Vision</div>
          <h3 class="scanner-modal-title">${icon('idCard', 18)} Leitor Digital de Documentos</h3>
          <p class="scanner-modal-subtitle">Posicione a CNH ou RG para identificação e leitura dos dados cadastrais</p>
        </div>
        <button type="button" class="scanner-close-btn" id="scanner-btn-close" title="Fechar">${icon('x', 16)}</button>
      </div>

      <!-- Abas de Modo -->
      <div class="scanner-tabs">
        <button type="button" class="scanner-tab active" id="tab-camera-mode">
          ${icon('camera', 15)} Câmera ao Vivo
        </button>
        <button type="button" class="scanner-tab" id="tab-upload-mode">
          ${icon('upload', 15)} Foto / Arquivo
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
              ${icon('flash', 14)} Lanterna
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-switch-camera" title="Inverter Câmera" style="border-radius: 4px;">
              ${icon('switchCamera', 14)} Inverter
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-native-camera" title="Abrir Câmera em Alta Definição com foco nativo do aparelho" style="border-radius: 4px; color: var(--yellow); border-color: rgba(245, 197, 24, 0.4);">
              ${icon('camera', 14)} Foco Nativo HD
            </button>
            <button type="button" class="btn btn-primary btn-capture" id="btn-snap-photo" style="flex: 1 1 100%; border-radius: 4px; padding: 12px; font-weight: 800; font-size: 0.95rem;">
              ${icon('sparkles', 16)} Fotografar e Processar
            </button>
          </div>
        </div>

        <!-- VISÃO 2: Envio de Arquivo / Foto Nativa do Celular -->
        <div class="scanner-view-section" id="view-upload" style="display: none;">
          <label class="scanner-dropzone" for="scanner-file-input">
            <div class="dropzone-icon" style="color: var(--yellow);">${icon('idCard', 36)}</div>
            <div class="dropzone-title">Toque para Tirar Foto ou Selecionar da Galeria</div>
            <p class="dropzone-desc">Suporta fotos nítidas de CNH física, CNH Digital, RG ou imagens recebidas por mensagem</p>
            <span class="btn btn-primary btn-sm" style="margin-top: 10px; pointer-events: none; border-radius: 4px;">
              ${icon('upload', 14)} Selecionar Imagem
            </span>
            <input type="file" id="scanner-file-input" accept="image/*" capture="environment" style="display: none;">
          </label>
        </div>

        <!-- VISÃO 3: Configuração Rápida da Chave Gemini (Exibida se chave não existir) -->
        <div class="scanner-view-section" id="view-key-setup" style="display: none;">
          <div style="background: var(--bg-1); border: 1px solid rgba(245, 197, 24, 0.3); border-radius: 6px; padding: 20px 16px; text-align: center;">
            <div style="margin-bottom: 12px; color: var(--yellow);">${icon('key', 36)}</div>
            <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-100); margin-bottom: 6px;">
              Ativar Leitor Inteligente (Google Gemini)
            </h4>
            <p style="font-size: 0.82rem; color: var(--text-300); line-height: 1.45; margin-bottom: 14px;">
              Para leitura automática de CNH e RG por imagem com máxima precisão, informe sua chave do Google AI Studio.
            </p>
            <div class="form-group" style="text-align: left; margin-bottom: 12px;">
              <label class="form-label" style="font-size: 0.78rem;">Chave do Google Gemini (AI Studio):</label>
              <input type="password" id="input-modal-gemini-key" class="form-control" placeholder="AIzaSy..." style="font-family: monospace; font-size: 0.85rem;">
            </div>
            <div style="display: flex; gap: 8px; flex-direction: column;">
              <button type="button" class="btn btn-primary" id="btn-save-key-and-analyze" style="font-weight: 800; border-radius: 4px; padding: 10px;">
                ${icon('check', 15)} Salvar Chave e Analisar Documento
              </button>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration: none; color: var(--cyan); border-color: rgba(6, 182, 212, 0.3); justify-content: center;">
                ${icon('externalLink', 14)} Obter Chave no Google AI Studio
              </a>
            </div>
          </div>
        </div>

        <!-- VISÃO 4: Carregamento / Processamento pela IA -->
        <div class="scanner-view-section" id="view-processing" style="display: none;">
          <div class="scanner-processing-box">
            <div class="scanner-preview-thumb">
              <img id="scanner-preview-img" alt="Documento capturado">
            </div>
            <div class="scanner-spinner-ring"></div>
            <h4 class="processing-title" id="processing-status-title">Processando imagem do documento...</h4>
            <p class="processing-desc" id="processing-status-desc">A Inteligência Artificial está lendo e estruturando os campos cadastrais</p>
            
            <div class="scanner-progress-track">
              <div class="scanner-progress-bar" id="scanner-progress-fill" style="width: 25%;"></div>
            </div>
            <span class="scanner-progress-num" id="scanner-progress-text">25%</span>
          </div>
        </div>

        <!-- VISÃO 5: Revisão e Confirmação de Resultados -->
        <div class="scanner-view-section" id="view-results" style="display: none; overflow-y: auto; max-height: calc(80vh - 140px);">
          <div class="scanner-results-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div class="results-badge-ok" style="margin: 0;">
                ${icon('checkCircle', 14)} Documento Identificado
              </div>
              <span class="badge badge-paid" id="scan-out-doctype-badge">CNH</span>
            </div>

            <p class="results-helper-text">
              Confira os dados extraídos pela IA e edite qualquer campo se desejar:
            </p>

            <div class="scanner-form-grid">
              <div class="form-group">
                <label class="form-label">Nome Completo do Titular</label>
                <input type="text" class="form-control" id="scan-out-name" placeholder="Nome lido pela IA">
              </div>

              <div class="form-group">
                <label class="form-label">
                  CPF
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
                  <label class="form-label">RG / Registro</label>
                  <input type="text" class="form-control" id="scan-out-rg" placeholder="Número do RG">
                </div>
              </div>

            </div>

            <div class="scanner-action-row" style="margin-top: 12px; position: sticky; bottom: 0; background: var(--bg-1); padding-top: 10px;">
              <button type="button" class="btn btn-secondary" id="btn-scan-retry" style="border-radius: 4px;">
                ${icon('refresh', 14)} Tirar Outra Foto
              </button>
              <button type="button" class="btn btn-primary" id="btn-scan-apply" style="border-radius: 4px;">
                ${icon('check', 15)} Preencher Cadastro
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
 * Inicializa a câmera com foco contínuo e resolução HD
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

        const torchBtn = scannerModal?.querySelector('#btn-torch-toggle');
        if (torchBtn && caps.torch) {
          torchBtn.style.display = 'inline-flex';
          isTorchActive = false;
        }
      } catch (e) {
        console.warn('Configurações avançadas de câmera não suportadas:', e);
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
      torchBtn.innerHTML = isTorchActive ? `${icon('flash', 14)} Desligar Luz` : `${icon('flash', 14)} Lanterna`;
      torchBtn.classList.toggle('active', isTorchActive);
    }
  } catch (e) {
    console.warn('Falha ao alternar lanterna:', e);
  }
}

/**
 * Abre o scanner e gerencia todo o ciclo de leitura via IA e preenchimento
 */
export function openDocumentScanner(onConfirmCallback) {
  const modal = getOrCreateScannerModal();
  const videoEl = modal.querySelector('#scanner-video');
  const targetFrameEl = modal.querySelector('#scanner-target-frame');
  const viewCamera = modal.querySelector('#view-camera');
  const viewUpload = modal.querySelector('#view-upload');
  const viewKeySetup = modal.querySelector('#view-key-setup');
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

  const inputModalKey = modal.querySelector('#input-modal-gemini-key');
  const btnSaveKeyAndAnalyze = modal.querySelector('#btn-save-key-and-analyze');

  const previewImg = modal.querySelector('#scanner-preview-img');
  const progressFill = modal.querySelector('#scanner-progress-fill');
  const progressText = modal.querySelector('#scanner-progress-text');
  const statusTitle = modal.querySelector('#processing-status-title');
  const rawTextPre = modal.querySelector('#scan-raw-text');

  const outName = modal.querySelector('#scan-out-name');
  const outCpf = modal.querySelector('#scan-out-cpf');
  const outBirth = modal.querySelector('#scan-out-birth');
  const outRg = modal.querySelector('#scan-out-rg');
  const outFiliacao = modal.querySelector('#scan-out-filiacao');
  const docTypeBadge = modal.querySelector('#scan-out-doctype-badge');
  const cpfBadge = modal.querySelector('#scan-cpf-status-badge');

  function showSection(section) {
    viewCamera.style.display = section === 'camera' ? 'flex' : 'none';
    viewUpload.style.display = section === 'upload' ? 'flex' : 'none';
    viewKeySetup.style.display = section === 'key-setup' ? 'block' : 'none';
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
      showToast('Câmera direta indisponível. Abrindo modo foto...', 'warning');
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

  // Executa a análise inteligente por IA
  async function runAiAnalysis(base64Data, apiKey) {
    showSection('processing');
    updateProgress(20, 'Otimizando imagem para envio...');

    try {
      updateProgress(50, 'Processando documento com IA Gemini Vision...');
      const parsed = await analyzeDocumentWithGemini(base64Data, apiKey);

      updateProgress(90, 'Validando CPF e organizando dados...');

      // Normaliza CPF e valida
      let cpfClean = (parsed.cpf || '').replace(/\D/g, '');
      let formattedCpf = parsed.cpf || '';
      if (cpfClean.length === 11) {
        formattedCpf = cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }

      outName.value = parsed.nome || '';
      outCpf.value = formattedCpf;
      outBirth.value = parsed.dataNascimento || '';
      outRg.value = parsed.rg || '';
      outFiliacao.value = parsed.filiacao || '';

      docTypeBadge.textContent = parsed.tipoDocumento || 'DOCUMENTO';
      if (parsed.tipoDocumento === 'CNH') {
        docTypeBadge.className = 'badge badge-paid';
      } else if (parsed.tipoDocumento === 'RG' || parsed.tipoDocumento === 'CIN') {
        docTypeBadge.className = 'badge badge-pending';
      } else {
        docTypeBadge.className = 'badge';
      }

      // Validação do CPF
      if (formattedCpf) {
        const isValid = validateCPF(formattedCpf);
        cpfBadge.textContent = isValid ? 'CPF Válido' : 'Conferir CPF';
        cpfBadge.className = `badge ${isValid ? 'badge-paid' : 'badge-overdue'}`;
      } else {
        cpfBadge.textContent = 'Não detectado';
        cpfBadge.className = 'badge badge-pending';
      }

      // Relatório formatado de diagnóstico
      rawTextPre.textContent = `=== DOCUMENTO IDENTIFICADO PELA IA ===
Tipo: ${parsed.tipoDocumento || 'Desconhecido'}
Nome: ${parsed.nome || 'Não identificado'}
CPF: ${formattedCpf || 'Não identificado'}
Data de Nascimento: ${parsed.dataNascimento || 'Não identificada'}
RG / Registro: ${parsed.rg || 'Não identificado'}
Filiação / Mãe: ${parsed.filiacao || 'Não identificada'}
Cidade/UF: ${parsed.cidadeUf || 'Não identificada'}
Precisão Estimada: ${parsed.confianca || 98}%`;

      showSection('results');
      showToast('Dados da CNH/RG lidos com sucesso pela IA!', 'success');
    } catch (err) {
      console.error('Erro na análise por IA:', err);
      showToast(`Falha na IA: ${err.message}`, 'error');
      // Permite ao usuário tentar de novo ou verificar a chave
      showSection('key-setup');
    }
  }

  // Ponto de entrada quando uma imagem é capturada ou selecionada
  function handleImageProcessing(imgSource) {
    const { dataUrl, base64 } = prepareImageForGemini(imgSource);
    pendingImageBase64 = base64;
    previewImg.src = dataUrl;

    const apiKey = state.getGeminiApiKey();
    if (!apiKey) {
      // Chave não configurada ainda: exibe formulário amigável para salvar a chave sem perder a foto
      showSection('key-setup');
      return;
    }

    runAiAnalysis(base64, apiKey);
  }

  // Salvar chave no modal e já disparar a análise da foto que foi tirada
  btnSaveKeyAndAnalyze.onclick = () => {
    const enteredKey = inputModalKey.value.trim();
    if (!enteredKey) {
      showToast('Por favor, cole sua chave do Google Gemini.', 'warning');
      return;
    }

    state.setGeminiApiKey(enteredKey);
    showToast('Chave salva com sucesso!', 'success');

    if (pendingImageBase64) {
      runAiAnalysis(pendingImageBase64, enteredKey);
    } else {
      tabCamera.click();
    }
  };

  // Botão de fotografar na câmera ao vivo
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

  // Upload de arquivo / print / foto da galeria
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
      motherName: outFiliacao.value.trim(),
      docType: docTypeBadge.textContent.trim(),
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
