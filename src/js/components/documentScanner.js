// src/js/components/documentScanner.js
// Leitor Inteligente de Documentos (CNH / RG) com OCR no Navegador (Custo Zero) - Vando Motos

import { maskCPF, showToast } from '../utils.js';

let scannerModal = null;
let currentStream = null;
let activeFacingMode = 'environment';
let tesseractWorker = null;

/**
 * Validação de dígitos verificadores de CPF
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
  const cpfMatches = rawText.match(/\b\d{3}\.?\d{3}\.?\d{3}[-\s]?\d{2}\b/g) || [];
  for (const m of cpfMatches) {
    const clean = m.replace(/\D/g, '');
    if (clean.length === 11 && validateCPF(clean)) {
      foundCpf = clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      break;
    }
  }

  // Fallback: Procura por sequência de 11 dígitos próxima à palavra CPF
  if (!foundCpf) {
    const cpfLabelMatch = /CPF[^\d]*(\d[\d\.\-\s]{9,14}\d)/i.exec(rawText);
    if (cpfLabelMatch) {
      const clean = cpfLabelMatch[1].replace(/\D/g, '');
      if (clean.length === 11 && validateCPF(clean)) {
        foundCpf = clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
    }
  }

  // 2. Extração de Data de Nascimento
  let birthDate = '';
  const birthLabelMatch = /NASC(?:IMENTO)?[^\d]*(\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4})/i.exec(rawText);
  if (birthLabelMatch) {
    birthDate = birthLabelMatch[1].replace(/[\.\-]/g, '/');
  } else {
    // Procura por datas coerentes com nascimento (entre 1930 e ano atual - 16)
    const dateMatches = rawText.match(/\b\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4}\b/g) || [];
    const currentYear = new Date().getFullYear();
    for (const d of dateMatches) {
      const parts = d.split(/[\/\.\-]/);
      const year = parseInt(parts[2], 10);
      if (year >= 1930 && year <= currentYear - 16) {
        birthDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${year}`;
        break;
      }
    }
  }

  // 3. Extração de RG / Documento de Identidade
  let rgNumber = '';
  const rgMatch = /(?:IDENTIDADE|DOC\.?\s*IDENTIDADE|REGISTRO GERAL|RG)[^\d]*(\d[\d\.\-\s]{5,14}[\dX])/i.exec(rawText);
  if (rgMatch) {
    rgNumber = rgMatch[1].trim().replace(/\s+/g, '');
  }

  // 4. Extração de Nome Completo
  let foundName = '';
  const ignoreTokens = [
    'REPUBLICA', 'FEDERATIVA', 'BRASIL', 'MINISTERIO', 'INFRAESTRUTURA',
    'CONTRAN', 'DENATRAN', 'SENATRAN', 'CARTEIRA', 'NACIONAL', 'HABILITACAO',
    'DETRAN', 'VALIDA', 'TERRITORIO', 'DOCUMENTO', 'IDENTIDADE', 'CONDUTOR',
    'REGISTRO', 'FILIACAO', 'PERMISSAO', 'ASSINATURA', 'PORTADOR',
    'SECRETARIA', 'SEGURANCA', 'PUBLICA', 'POLICIA', 'CIVIL', 'INSTITUTO',
    'IDENTIFICACAO', 'LOCAL', 'DATA', 'EMISSAO', 'VALIDADE', 'PRIMEIRA',
    'ESTADO', 'PREFEITURA', 'DEPARTAMENTO', 'TRANSITO', 'CATEGORIA', 'HABILITADO'
  ];

  // Estratégia A: Linha subsequente ao rótulo "NOME"
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^(?:1\s*)?NOME(?:\s*DO\s*CONDUTOR)?(?:\s*\/.*)?$/i.test(lineUpper) || lineUpper === 'NOME' || lineUpper.startsWith('NOME:')) {
      if (lineUpper.includes(':') && lineUpper.split(':')[1].trim().length > 3) {
        foundName = lines[i].split(':')[1].trim();
      } else if (i + 1 < lines.length) {
        const candidate = lines[i + 1].trim();
        const candidateClean = candidate.replace(/[^A-Za-zÁÉÍÓÚÂÊÎÔÛÃÕÇáéíóúâêîôûãõç\s]/g, '').trim();
        const words = candidateClean.split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2 && words.length <= 6) {
          foundName = candidateClean;
        }
      }
      if (foundName) break;
    }
  }

  // Estratégia B (Fallback): Procura pela primeira linha de 2 a 5 palavras sem números e sem palavras do cabeçalho
  if (!foundName) {
    for (const line of lines) {
      const cleanLine = line.replace(/[^A-Za-zÁÉÍÓÚÂÊÎÔÛÃÕÇáéíóúâêîôûãõç\s]/g, '').trim();
      const words = cleanLine.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 2 && words.length <= 6 && !/\d/.test(line)) {
        const upper = cleanLine.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const hasIgnore = ignoreTokens.some(token => upper.includes(token));
        if (!hasIgnore) {
          foundName = cleanLine;
          break;
        }
      }
    }
  }

  // Formatação em Title Case (Ex: "CARLOS SILVA" -> "Carlos Silva")
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
 * Pré-processa uma imagem para aumentar contraste e facilitar a leitura OCR
 */
function preprocessImage(sourceImage) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const width = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height;

  // Escala para resolução ideal de leitura (~1600px de largura)
  const targetWidth = Math.min(1800, Math.max(1200, width));
  const scale = targetWidth / width;
  canvas.width = targetWidth;
  canvas.height = Math.round(height * scale);

  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Escala de cinza e aumento de contraste
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const contrast = 1.25;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      let adjusted = factor * (gray - 128) + 128;
      adjusted = Math.min(255, Math.max(0, adjusted));

      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('CORS ou segurança impediu filtro de pixel, usando imagem original:', e);
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
          <div class="scanner-header-badge">⚡ IA Local Custo Zero</div>
          <h3 class="scanner-modal-title">📷 Leitor de CNH & RG</h3>
          <p class="scanner-modal-subtitle">Aponte a câmera para o documento ou selecione uma foto</p>
        </div>
        <button type="button" class="scanner-close-btn" id="scanner-btn-close" title="Fechar">✕</button>
      </div>

      <!-- Abas de Modo: Câmera ao Vivo / Enviar Arquivo -->
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
              <div class="scanner-target-box">
                <div class="scanner-corner corner-tl"></div>
                <div class="scanner-corner corner-tr"></div>
                <div class="scanner-corner corner-bl"></div>
                <div class="scanner-corner corner-br"></div>
                <div class="scanner-laser-line"></div>
                <div class="scanner-guide-text">Enquadre o documento aqui</div>
              </div>
            </div>
          </div>

          <div class="scanner-camera-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-switch-camera" title="Inverter Câmera">
              🔄 Inverter Câmera
            </button>
            <button type="button" class="btn btn-primary btn-capture" id="btn-snap-photo">
              📸 Tirar Foto e Ler
            </button>
          </div>
        </div>

        <!-- VISÃO 2: Envio de Arquivo / Foto Nativa do Celular -->
        <div class="scanner-view-section" id="view-upload" style="display: none;">
          <label class="scanner-dropzone" for="scanner-file-input">
            <div class="dropzone-icon">🪪</div>
            <div class="dropzone-title">Toque aqui para Tirar Foto ou Escolher da Galeria</div>
            <p class="dropzone-desc">Funciona com foto da CNH física, CNH Digital ou print do WhatsApp (JPG, PNG)</p>
            <span class="btn btn-primary btn-sm" style="margin-top: 10px; pointer-events: none;">
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
            <p class="processing-desc" id="processing-status-desc">O algoritmo OCR está reconhecendo o texto da imagem</p>
            
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
              <span>✅</span> Dados Reconhecidos com Sucesso
            </div>
            <p class="results-helper-text">
              Revise as informações extraídas abaixo antes de confirmar o preenchimento:
            </p>

            <div class="scanner-form-grid">
              <div class="form-group">
                <label class="form-label">Nome Completo Reconhecido</label>
                <input type="text" class="form-control" id="scan-out-name" placeholder="Nome não identificado">
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

            <div class="scanner-action-row">
              <button type="button" class="btn btn-secondary" id="btn-scan-retry">
                🔄 Tirar Outra Foto
              </button>
              <button type="button" class="btn btn-primary" id="btn-scan-apply">
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
 * Inicializa a câmera no elemento de vídeo
 */
async function startCamera(videoEl) {
  stopCamera();
  try {
    const constraints = {
      video: {
        facingMode: activeFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = currentStream;
    await videoEl.play();
    return true;
  } catch (err) {
    console.warn('Falha ao abrir câmera direta via getUserMedia:', err);
    return false;
  }
}

/**
 * Interrompe o stream da câmera para economizar bateria e liberar hardware
 */
function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

/**
 * Executa o OCR utilizando Tesseract.js com carregamento assíncrono sob demanda
 */
async function processImageWithOCR(imageElementOrCanvas, onProgress) {
  // Carrega Tesseract.js de forma dinâmica (chunk separado para manter app ultrarrápido)
  const { createWorker } = await import('tesseract.js');

  onProgress(15, 'Carregando motor OCR...');

  // Inicializa worker otimizado para português
  const worker = await createWorker('por', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 80) + 15;
        onProgress(Math.min(95, pct), 'Lendo texto do documento...');
      }
    }
  });

  onProgress(30, 'Processando documento...');
  const { data } = await worker.recognize(imageElementOrCanvas);
  await worker.terminate();

  onProgress(100, 'Extraindo campos...');
  return data.text;
}

/**
 * Abre o scanner e executa o fluxo completo
 * @param {Function} onConfirmCallback - Chamado com { name, cpf, birthDate, rg, rawText }
 */
export function openDocumentScanner(onConfirmCallback) {
  const modal = getOrCreateScannerModal();
  const videoEl = modal.querySelector('#scanner-video');
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
  const btnRetry = modal.querySelector('#btn-scan-retry');
  const btnApply = modal.querySelector('#btn-scan-apply');

  const previewImg = modal.querySelector('#scanner-preview-img');
  const progressFill = modal.querySelector('#scanner-progress-fill');
  const progressText = modal.querySelector('#scanner-progress-text');
  const statusTitle = modal.querySelector('#processing-status-title');
  const statusDesc = modal.querySelector('#processing-status-desc');

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

    // Tabs
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

  // Alterna para Câmera
  tabCamera.onclick = async () => {
    showSection('camera');
    const started = await startCamera(videoEl);
    if (!started) {
      showToast('Câmera indisponível no navegador. Use a opção de foto/arquivo.', 'warning');
      showSection('upload');
    }
  };

  // Alterna para Upload
  tabUpload.onclick = () => {
    stopCamera();
    showSection('upload');
  };

  // Inverter câmera (frontal/traseira)
  btnSwitchCam.onclick = async () => {
    activeFacingMode = activeFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(videoEl);
  };

  // Processa a imagem escolhida ou capturada
  async function handleImageProcessing(imgSource) {
    showSection('processing');
    updateProgress(10, 'Otimizando imagem...');

    // Cria preview visual
    if (imgSource instanceof HTMLCanvasElement) {
      previewImg.src = imgSource.toDataURL('image/jpeg', 0.85);
    } else if (imgSource instanceof HTMLImageElement) {
      previewImg.src = imgSource.src;
    }

    try {
      // Pré-processa para maximizar precisão do OCR
      const processedCanvas = preprocessImage(imgSource);
      const rawText = await processImageWithOCR(processedCanvas, (pct, msg) => {
        updateProgress(pct, msg);
      });

      console.log('Texto reconhecido pelo OCR:', rawText);
      const parsed = parseBrazilianDocument(rawText);

      // Preenche os campos de revisão
      outName.value = parsed.name || '';
      outCpf.value = parsed.cpf || '';
      outBirth.value = parsed.birthDate || '';
      outRg.value = parsed.rg || '';

      // Atualiza badge de CPF
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
        showToast('Documento com baixa nitidez. Você pode digitar os dados ou tentar outra foto.', 'warning');
      } else {
        showToast('Dados extraídos com sucesso!', 'success');
      }

    } catch (err) {
      console.error('Erro no processamento OCR:', err);
      showToast('Não foi possível ler a imagem. Tente uma foto mais nítida e bem iluminada.', 'error');
      showSection('upload');
    }
  }

  // Capturar frame do vídeo ao vivo
  btnSnap.onclick = () => {
    if (!videoEl.videoWidth) {
      showToast('Aguarde a câmera iniciar.', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    stopCamera();
    handleImageProcessing(canvas);
  };

  // Upload de arquivo
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
    fileInput.value = ''; // reseta input
  };

  // Tentar novamente
  btnRetry.onclick = () => {
    tabCamera.click();
  };

  // Aplicar resultados ao formulário do cliente
  btnApply.onclick = () => {
    const finalData = {
      name: outName.value.trim(),
      cpf: outCpf.value.trim(),
      birthDate: outBirth.value.trim(),
      rg: outRg.value.trim()
    };

    if (onConfirmCallback) {
      onConfirmCallback(finalData);
    }

    closeModal();
    showToast('Dados preenchidos no cadastro!', 'success');
  };

  btnClose.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Inicia modal
  modal.classList.add('active');
  tabCamera.click();
}
