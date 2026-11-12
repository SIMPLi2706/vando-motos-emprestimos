// src/js/components/publicSignPortal.js
// Portal Público de Visualização, Impressão e Assinatura Digital de Notas Promissórias - Vando Motos Locadora LTDA
// Validade Jurídica: MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020 (Assinatura Eletrônica Avançada)

import { formatBRL, formatDate, createWhatsAppUrl, showToast, escapeHtml } from '../utils.js';
import { renderSinglePromissoryCard, renderDebtConfessionContract } from './receiptModal.js';
import { icon } from '../icons.js';
import { state } from '../state.js';

/**
 * Codifica os dados da Nota Promissória e do Contrato em um token seguro e compacto para a URL
 */
export function createPromissorySigningToken(loan, client, installment, settings) {
  const loanInsts = (typeof state !== 'undefined' && state.getInstallments)
    ? state.getInstallments({ loanId: loan.id })
    : [];

  const payload = {
    v: 2,
    loanId: loan.id,
    instNum: installment ? installment.number : 1,
    clientId: client.id || '',
    clientName: client.name || 'Cliente',
    clientCpf: client.cpf || '',
    clientPhone: client.phone || '',
    clientAddress: client.address || '',
    amount: installment ? Number(installment.installmentAmount) : Number(loan.totalPayable || loan.principal || 0),
    principal: Number(loan.principal || 0),
    totalPayable: Number(loan.totalPayable || loan.principal || 0),
    interestRate: Number(loan.interestRate || 0),
    interestType: loan.interestType || 'simple',
    penaltyRate: loan.penaltyRate ?? 2,
    dailyInterestRate: loan.dailyInterestRate ?? 0.1,
    totalCount: installment ? (loan.installmentsCount || 1) : (loan.installmentsCount || 1),
    dueDate: installment ? installment.dueDate : (loan.startDate || new Date().toISOString().split('T')[0]),
    startDate: loan.startDate || new Date().toISOString().split('T')[0],
    creditorName: (settings && settings.businessName) || 'Vando motos locadora LTDA',
    creditorCpfCnpj: (settings && settings.creditorCpfCnpj) || '28.623.431-0001-23',
    creditorCity: (settings && settings.creditorCity) || 'PORTO VELHO RONDONIA',
    creditorPhone: (settings && (settings.pixKey || settings.phone)) || '69992323382',
    signature: loan.signature || (installment && installment.signature) || null
  };

  if (loan.guarantee && (loan.guarantee.description || loan.guarantee.type)) {
    payload.guarantee = {
      type: loan.guarantee.type || '',
      description: String(loan.guarantee.description || '').slice(0, 120),
      identifier: String(loan.guarantee.identifier || '').slice(0, 60),
      value: Number(loan.guarantee.value || 0)
    };
  }
  if (loan.guarantor && loan.guarantor.name) {
    payload.guarantor = {
      name: String(loan.guarantor.name).slice(0, 80),
      cpf: String(loan.guarantor.cpf || '').slice(0, 20),
      phone: String(loan.guarantor.phone || '').slice(0, 25)
    };
  }
  if (loanInsts.length > 0 && loanInsts.length <= 24) {
    payload.insts = loanInsts.map(i => [i.number, i.dueDate, Number(i.installmentAmount)]);
  }

  const jsonStr = JSON.stringify(payload);
  // Base64 seguro para URL (sem quebras de linha e caracteres especiais)
  return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodifica o token seguro da URL
 */
export function decodePromissorySigningToken(token) {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(base64), (c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Falha ao decodificar token de assinatura:', e);
    return null;
  }
}

/**
 * Gera a URL completa para envio ao cliente
 */
export function getPromissorySigningUrl(loan, client, installment, settings) {
  const token = createPromissorySigningToken(loan, client, installment, settings);
  const origin = window.location.origin;
  const path = window.location.pathname;
  return `${origin}${path}?sign=${token}`;
}

/**
 * Renderiza o Portal de Assinatura Digital do Cliente
 */
export function renderPublicSigningPortal(container, rawData) {
  let data = {
    ...rawData,
    creditorName: rawData.creditorName || 'Vando motos locadora LTDA',
    creditorCpfCnpj: rawData.creditorCpfCnpj || '28.623.431-0001-23',
    creditorCity: rawData.creditorCity || 'PORTO VELHO RONDONIA',
    creditorPhone: rawData.creditorPhone || '69992323382'
  };

  // Verifica se o empréstimo existe localmente no state para obter a versão mais recente
  if (data.loanId && window.state) {
    const localLoan = state.getLoanById(data.loanId);
    if (localLoan && localLoan.signature) {
      data.signature = localLoan.signature;
    }
  }

  // Verifica se já foi assinado e salvo no localStorage deste navegador
  const localSavedSig = localStorage.getItem(`vando_signed_${data.loanId}`);
  if (localSavedSig && !data.signature) {
    try {
      data.signature = JSON.parse(localSavedSig);
    } catch (e) {}
  }

  const isAlreadySigned = !!data.signature;

  // Monta objetos para renderização dos documentos
  const localLoan = (data.loanId && window.state) ? state.getLoanById(data.loanId) : null;
  const localClient = (localLoan && window.state) ? state.getClientById(localLoan.clientId) : null;

  const mockInstallment = {
    number: data.instNum || 1,
    dueDate: data.dueDate,
    installmentAmount: data.amount,
    signature: data.signature
  };

  const mockLoan = {
    id: data.loanId,
    startDate: data.startDate,
    totalPayable: data.totalPayable || (localLoan ? localLoan.totalPayable : data.amount),
    principal: data.principal || (localLoan ? localLoan.principal : 0),
    interestRate: data.interestRate ?? (localLoan ? localLoan.interestRate : 0),
    interestType: data.interestType || (localLoan ? localLoan.interestType : 'simple'),
    penaltyRate: data.penaltyRate ?? (localLoan ? localLoan.penaltyRate : 2),
    dailyInterestRate: data.dailyInterestRate ?? (localLoan ? localLoan.dailyInterestRate : 0.1),
    installmentsCount: data.totalCount || (localLoan ? localLoan.installmentsCount : 1) || 1,
    guarantee: data.guarantee || (localLoan ? localLoan.guarantee : null),
    guarantor: data.guarantor || (localLoan ? localLoan.guarantor : null),
    notes: data.notes || (localLoan ? localLoan.notes : ''),
    signature: data.signature
  };

  const mockClient = {
    name: data.clientName,
    cpf: data.clientCpf || (localClient ? localClient.cpf : ''),
    phone: data.clientPhone || (localClient ? localClient.phone : ''),
    address: data.clientAddress || (localClient ? localClient.address : '')
  };

  const mockSettings = {
    businessName: data.creditorName,
    creditorCpfCnpj: data.creditorCpfCnpj,
    creditorCity: data.creditorCity
  };

  const localInsts = (data.loanId && window.state) ? state.getInstallments({ loanId: data.loanId }) : [];
  const contractInsts = localInsts.length > 0
    ? localInsts
    : (Array.isArray(data.insts) && data.insts.length > 0
        ? data.insts.map(arr => ({ number: arr[0], dueDate: arr[1], installmentAmount: arr[2] }))
        : [mockInstallment]);

  let activeDocType = 'promissory';

  container.innerHTML = `
    <div class="public-portal-wrapper">
      <!-- Barra Superior / Header do Portal -->
      <header class="public-portal-header">
        <div class="public-portal-header-inner">
          <div class="public-portal-brand">
            <img src="/logo-vandomotos.png" alt="Vando Motos" class="public-portal-logo" />
            <div>
              <h1 class="public-portal-title">Vando Motos Locadora</h1>
              <p class="public-portal-subtitle">Portal Oficial de Assinatura Eletrônica de Documentos</p>
            </div>
          </div>
          <div class="public-portal-badge">
            ${icon('shield', 15)} Ambiente Seguro • MP nº 2.200-2/2001
          </div>
        </div>
      </header>

      <main class="public-portal-main">
        <!-- Card de Resumo do Empréstimo -->
        <div class="public-summary-card">
          <div class="public-summary-header">
            <div>
              <div class="public-summary-status-tag ${isAlreadySigned ? 'tag-signed' : 'tag-pending'}">
                ${isAlreadySigned ? `${icon('checkCircle', 14)} Documento Assinado Digitalmente` : `${icon('clock', 14)} Aguardando Sua Assinatura`}
              </div>
              <h2 class="public-summary-client-name">${escapeHtml(data.clientName)}</h2>
              <div class="public-summary-client-cpf">CPF: ${escapeHtml(mockClient.cpf || 'Não informado')}</div>
            </div>
            <div class="public-summary-amount-box">
              <span class="ps-label">Valor do Título</span>
              <strong class="ps-amount text-green">${formatBRL(data.amount)}</strong>
              <span class="ps-due">Vencimento: ${formatDate(data.dueDate)}</span>
            </div>
          </div>

          <div class="public-summary-grid">
            <div class="ps-item">
              <span class="ps-item-label">Credor / Beneficiário</span>
              <strong class="ps-item-value">${escapeHtml(data.creditorName)}</strong>
              <span class="ps-item-sub">CNPJ: ${escapeHtml(data.creditorCpfCnpj)}</span>
            </div>
            <div class="ps-item">
              <span class="ps-item-label">Praça de Pagamento</span>
              <strong class="ps-item-value">${escapeHtml(data.creditorCity)}</strong>
              <span class="ps-item-sub">Título nº ${String(data.instNum || 1).padStart(2, '0')}/${String(data.totalCount || 1).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <!-- Visualização dos Documentos Oficiais -->
        <div class="public-promissory-preview-section">
          <div class="public-section-title-wrap" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
            <div>
              <h3 class="public-section-title">${icon('fileText', 18)} Visualização dos Documentos Oficiais</h3>
              <p class="public-section-subtitle">Alterne abaixo entre Nota Promissória e Contrato de Confissão de Dívida antes de assinar</p>
            </div>
            <div class="doc-view-tabs" id="public-doc-tabs">
              <button type="button" class="doc-tab-btn active" data-public-doc="promissory">Nota Promissória</button>
              <button type="button" class="doc-tab-btn" data-public-doc="contract">Contrato Confissão de Dívida</button>
            </div>
          </div>

          <div class="public-promissory-scroll-box" id="public-promissory-container"></div>
        </div>

        <!-- Seção de Assinatura Digital Touch -->
        <div class="public-signing-action-section" id="public-signing-action-area">
          ${isAlreadySigned ? renderSignedSuccessBanner(data.signature, data) : renderSignatureForm(data)}
        </div>
      </main>

      <footer class="public-portal-footer">
        <p>Vando Motos Locadora LTDA • CNPJ ${escapeHtml(data.creditorCpfCnpj)} • ${escapeHtml(data.creditorCity)}</p>
        <p class="public-legal-footer-note">
          Validade jurídica integral conforme Art. 10 da Medida Provisória nº 2.200-2/2001 e Art. 4º da Lei Federal nº 14.063/2020.
        </p>
      </footer>
    </div>
  `;

  function renderPublicDocPreview() {
    const promContainer = container.querySelector('#public-promissory-container');
    if (!promContainer) return;
    mockInstallment.signature = data.signature;
    mockLoan.signature = data.signature;
    if (activeDocType === 'contract') {
      promContainer.innerHTML = renderDebtConfessionContract(mockLoan, mockClient, contractInsts, mockSettings);
    } else {
      promContainer.innerHTML = renderSinglePromissoryCard(mockInstallment, mockLoan, mockClient, mockSettings, data.instNum || 1, data.totalCount || 1);
    }
  }

  renderPublicDocPreview();

  container.querySelectorAll('[data-public-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDocType = btn.dataset.publicDoc;
      container.querySelectorAll('[data-public-doc]').forEach(b => b.classList.toggle('active', b === btn));
      renderPublicDocPreview();
    });
  });

  // Inicializa o comportamento da assinatura se ainda não estiver assinado
  if (!isAlreadySigned) {
    setupSignatureCanvas(container, data, mockInstallment, mockLoan, mockClient, mockSettings, renderPublicDocPreview);
  } else {
    setupSignedActions(container, data);
  }
}

/**
 * Renderiza o formulário de assinatura digital na tela
 */
function renderSignatureForm(data) {
  return `
    <div class="public-sig-card">
      <div class="public-sig-header">
        <div class="psh-badge">Assinatura Eletrônica na Tela</div>
        <h3 class="psh-title">${icon('pen', 18)} Assine com o dedo no quadro abaixo</h3>
        <p class="psh-desc">Use a ponta do seu dedo ou caneta touch diretamente na tela do seu celular para assinar:</p>
      </div>

      <div class="public-sig-canvas-wrap">
        <canvas id="public-sig-canvas" class="public-sig-canvas"></canvas>
        <div class="public-sig-guide-line">
          <span>Área de Assinatura de ${data.clientName}</span>
        </div>
      </div>

      <div class="public-sig-terms">
        <label class="public-sig-checkbox-label">
          <input type="checkbox" id="chk-accept-terms" />
          <span>Declaro sob as penas da lei que li e concordo com todos os valores, prazos e termos desta Nota Promissória, autorizando a aposição da minha assinatura eletrônica.</span>
        </label>
      </div>

      <div class="public-sig-buttons">
        <button type="button" class="btn btn-secondary" id="btn-public-clear-sig">
          ${icon('trash', 14)} Limpar
        </button>
        <button type="button" class="btn btn-primary btn-pulse" id="btn-public-confirm-sig" style="flex: 1; padding: 12px 20px; font-size: 1rem; font-weight: 800;">
          ${icon('checkCircle', 18)} Gravar e Assinar Nota Promissória
        </button>
      </div>
    </div>
  `;
}

/**
 * Renderiza o banner de sucesso e botões de ação após assinar
 */
function renderSignedSuccessBanner(sig, data) {
  const protocol = sig.protocol || `VM-NP-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const dateFormatted = sig.dateFormatted || formatDate(sig.timestamp || new Date());

  return `
    <div class="public-signed-success-card">
      <div class="pssc-icon">
        ${icon('checkCircle', 42)}
      </div>
      <h3 class="pssc-title">Nota Promissória Assinada com Sucesso!</h3>
      <p class="pssc-desc">Sua assinatura foi vinculada e autenticada digitalmente no documento oficial.</p>

      <div class="pssc-badge-box">
        <div class="pssc-badge-row">
          <span>Protocolo de Autenticidade:</span>
          <strong>${protocol}</strong>
        </div>
        <div class="pssc-badge-row">
          <span>Data e Hora do Carimbo:</span>
          <strong>${dateFormatted}</strong>
        </div>
        <div class="pssc-badge-row">
          <span>Assinante:</span>
          <strong>${data.clientName} (CPF: ${data.clientCpf || 'Registrado'})</strong>
        </div>
      </div>

      <div class="pssc-actions">
        <button type="button" class="btn btn-primary" id="btn-public-print" style="padding: 12px 18px; font-size: 0.95rem; font-weight: 700;">
          ${icon('print', 16)} Imprimir / Salvar PDF da Promissória
        </button>
        <button type="button" class="btn btn-whatsapp" id="btn-public-wpp-confirm" style="padding: 12px 18px; font-size: 0.95rem; font-weight: 700; background: #25d366; color: #fff; border: none;">
          ${icon('whatsapp', 16)} Enviar Confirmação p/ Vando Motos via WhatsApp
        </button>
      </div>
    </div>
  `;
}

/**
 * Configura o canvas interativo de assinatura touch
 */
function setupSignatureCanvas(container, data, mockInstallment, mockLoan, mockClient, mockSettings, renderPublicDocPreview) {
  const canvas = container.querySelector('#public-sig-canvas');
  const clearBtn = container.querySelector('#btn-public-clear-sig');
  const confirmBtn = container.querySelector('#btn-public-confirm-sig');
  const chkTerms = container.querySelector('#chk-accept-terms');

  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || Math.min(window.innerWidth - 48, 520);
    const displayHeight = 180;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#000000'; // Traço preto oficial
  }

  resizeCanvas();
  window.addEventListener('resize', () => {
    // Não limpa o desenho caso o usuário rotacione a tela se possível
  });

  let isDrawing = false;
  let hasDrawn = false;

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function start(e) {
    isDrawing = true;
    hasDrawn = true;
    canvas.dataset.hasDrawing = 'true';
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (e.cancelable) e.preventDefault();
  }

  function move(e) {
    if (!isDrawing) return;
    hasDrawn = true;
    canvas.dataset.hasDrawing = 'true';
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (e.cancelable) e.preventDefault();
  }

  function stop() {
    isDrawing = false;
    ctx.closePath();
  }

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);
  canvas.addEventListener('touchcancel', stop);

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', stop);

  clearBtn.addEventListener('click', () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, 180);
    hasDrawn = false;
    canvas.dataset.hasDrawing = 'false';
  });

  confirmBtn.addEventListener('click', () => {
    if (!hasDrawn && canvas.dataset.hasDrawing !== 'true') {
      showToast('Por favor, faça sua assinatura na tela antes de confirmar.', 'error');
      return;
    }

    if (!chkTerms.checked) {
      showToast('Por favor, marque a caixa concordando com os termos do documento para concluir a assinatura.', 'error');
      chkTerms.focus();
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const now = new Date();
    const protocol = `VM-NP-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(now);

    const signatureData = {
      dataUrl,
      timestamp: now.toISOString(),
      dateFormatted,
      protocol,
      signer: data.clientName,
      signerCpf: data.clientCpf
    };

    // 1. Salva no localStorage local
    localStorage.setItem(`vando_signed_${data.loanId}`, JSON.stringify(signatureData));

    // 2. Se a aplicação local tiver o state e o empréstimo (ex: admin ou sync):
    if (window.state && state.getLoanById(data.loanId)) {
      state.updateLoan(data.loanId, {
        signature: signatureData,
        signedAt: signatureData.timestamp,
        signProtocol: protocol
      });
    }

    // 3. Atualiza os mocks e a tela
    data.signature = signatureData;
    mockInstallment.signature = signatureData;
    mockLoan.signature = signatureData;

    // Atualiza a prévia do documento imediatamente para mostrar a assinatura carimbada
    if (typeof renderPublicDocPreview === 'function') {
      renderPublicDocPreview();
    } else {
      const promContainer = container.querySelector('#public-promissory-container');
      if (promContainer) {
        promContainer.innerHTML = renderSinglePromissoryCard(mockInstallment, mockLoan, mockClient, mockSettings, data.instNum || 1, data.totalCount || 1);
      }
    }

    // Atualiza o card de resumo
    const statusTag = container.querySelector('.public-summary-status-tag');
    if (statusTag) {
      statusTag.className = 'public-summary-status-tag tag-signed';
      statusTag.innerHTML = `${icon('checkCircle', 14)} Documento Assinado Digitalmente`;
    }

    // Substitui a área de assinatura pelo banner de sucesso
    const actionArea = container.querySelector('#public-signing-action-area');
    if (actionArea) {
      actionArea.innerHTML = renderSignedSuccessBanner(signatureData, data);
      setupSignedActions(container, data);
    }

    // Rola suavemente até o comprovante
    actionArea.scrollIntoView({ behavior: 'smooth' });
  });
}

/**
 * Configura os botões de ação após o documento estar assinado
 */
function setupSignedActions(container, data) {
  const printBtn = container.querySelector('#btn-public-print');
  const wppBtn = container.querySelector('#btn-public-wpp-confirm');

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (wppBtn) {
    wppBtn.addEventListener('click', () => {
      const sig = data.signature || {};
      const msg = `Olá Vando Motos! Eu, *${data.clientName}*, acabei de assinar digitalmente a Nota Promissória referente ao meu empréstimo de *${formatBRL(data.amount)}* (Vencimento: ${formatDate(data.dueDate)}).\n\n📄 *Protocolo de Assinatura:* ${sig.protocol || 'Autenticado'}\n🕒 *Data:* ${sig.dateFormatted || formatDate(new Date())}\n\nO documento está autenticado com sucesso!`;

      // Telefone do Vando Motos para envio da confirmação
      const vandoPhone = data.creditorPhone || '69992323382';
      const url = createWhatsAppUrl(vandoPhone, msg);
      window.open(url, '_blank');
    });
  }
}
