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
            ${icon('shield', 15)} Assinador Oficial GOV.BR • Lei nº 14.063/2020
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

        <!-- Seção Oficial de Assinatura GOV.BR -->
        <div class="public-signing-action-section" id="public-signing-action-area">
          ${renderGovSigningForm(data)}
        </div>
      </main>

      <footer class="public-portal-footer">
        <p>Vando Motos Locadora LTDA • CNPJ ${escapeHtml(data.creditorCpfCnpj)} • ${escapeHtml(data.creditorCity)}</p>
        <p class="public-legal-footer-note">
          Validade jurídica integral conforme Lei Federal nº 14.063/2020 e Decreto nº 10.543/2020 (Assinatura Eletrônica Avançada GOV.BR).
        </p>
      </footer>
    </div>
  `;

  function renderPublicDocPreview() {
    const promContainer = container.querySelector('#public-promissory-container');
    if (!promContainer) return;
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

  // Configura as ações do fluxo de assinatura Gov.br
  setupGovSigningActions(container, data);
}

/**
 * Renderiza o painel oficial de instrução e assinatura GOV.BR
 */
function renderGovSigningForm(data) {
  return `
    <div class="public-sig-card gov-signing-card">
      <div class="public-sig-header" style="text-align: center; border-bottom: 1px solid var(--border-soft); padding-bottom: 16px;">
        <div class="psh-badge" style="background: rgba(19, 81, 180, 0.15); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.4); margin: 0 auto 10px; display: inline-flex; align-items: center; gap: 6px;">
          🏛️ Assinatura Oficial GOV.BR
        </div>
        <h3 class="psh-title" style="color: #fff; font-size: 1.25rem; font-weight: 800; margin-bottom: 8px;">
          Assine seu Contrato pelo Portal Gov.br
        </h3>
        <p class="psh-desc" style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5; max-width: 600px; margin: 0 auto;">
          Este documento possui validade jurídica oficial em todo o território nacional conforme a <strong>Lei Federal nº 14.063/2020</strong> e <strong>Decreto nº 10.543/2020</strong>. Siga os 3 passos simples abaixo:
        </p>
      </div>

      <div class="gov-steps-list" style="display: flex; flex-direction: column; gap: 12px; margin: 20px 0;">
        
        <!-- Passo 1 -->
        <div class="gov-step-item" style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px;">
          <div style="font-weight: 800; font-size: 0.98rem; color: #fff; display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="background: var(--yellow); color: #000; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 900; flex-shrink: 0;">1</span>
            Baixar Documento Oficial em PDF
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 12px 34px; line-height: 1.4;">
            Gere o arquivo PDF oficial do seu contrato / nota promissória para enviar ao site do Gov.br.
          </p>
          <div style="margin-left: 34px;">
            <button type="button" class="btn btn-secondary" id="btn-gov-download-pdf" style="font-weight: 700; padding: 10px 18px; border-radius: 8px;">
              ${icon('download', 16)} Baixar / Salvar Contrato em PDF
            </button>
          </div>
        </div>

        <!-- Passo 2 -->
        <div class="gov-step-item" style="background: rgba(19, 81, 180, 0.08); border: 1.5px solid rgba(96, 165, 250, 0.4); border-radius: 12px; padding: 16px;">
          <div style="font-weight: 800; font-size: 0.98rem; color: #93c5fd; display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="background: #1d4ed8; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 900; flex-shrink: 0;">2</span>
            Acessar o Assinador Eletrônico Oficial Gov.br (Gratuito)
          </div>
          <p style="font-size: 0.82rem; color: #cbd5e1; margin: 0 0 12px 34px; line-height: 1.45;">
            Entre no site oficial do Governo (<strong>assinador.iti.br</strong>) com sua conta Gov.br (nível Prata ou Ouro). Carregue o PDF baixado no Passo 1, posicione a assinatura na área indicada e confirme com o código SMS/Gov.
          </p>
          <div style="margin-left: 34px;">
            <a href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer" class="btn btn-primary" id="btn-gov-open-portal" style="background: #1351b4; border-color: #1d4ed8; color: #fff; font-weight: 800; padding: 11px 20px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
              ${icon('externalLink', 16)} Abrir Assinador Gov.br (assinador.iti.br) ↗
            </a>
          </div>
        </div>

        <!-- Passo 3 -->
        <div class="gov-step-item" style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px;">
          <div style="font-weight: 800; font-size: 0.98rem; color: #fff; display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="background: #10b981; color: #000; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 900; flex-shrink: 0;">3</span>
            Devolver o Documento Assinado no WhatsApp
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 12px 34px; line-height: 1.4;">
            Ao concluir no Gov.br, baixe o PDF assinado (ele conterá o selo oficial e código de autenticidade) e envie de volta para a Vando Motos para liberação imediata.
          </p>
          <div style="margin-left: 34px;">
            <button type="button" class="btn btn-whatsapp" id="btn-gov-send-wpp" style="background: #25d366; color: #fff; font-weight: 800; padding: 11px 20px; border-radius: 8px; border: none; display: inline-flex; align-items: center; gap: 8px;">
              ${icon('whatsapp', 16)} Devolver Contrato Assinado via WhatsApp
            </button>
          </div>
        </div>

      </div>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--border-soft); border-radius: 8px; padding: 12px 16px; font-size: 0.78rem; color: var(--text-400); line-height: 1.45; display: flex; align-items: center; gap: 10px;">
        ${icon('info', 18)}
        <span><strong>Dúvidas sobre como assinar?</strong> Nossa equipe está disponível no WhatsApp para auxiliar em caso de qualquer dúvida sobre o login Gov.br!</span>
      </div>
    </div>
  `;
}

/**
 * Configura as ações dos botões do fluxo de assinatura Gov.br
 */
function setupGovSigningActions(container, data) {
  const downloadBtn = container.querySelector('#btn-gov-download-pdf');
  const wppBtn = container.querySelector('#btn-gov-send-wpp');

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (wppBtn) {
    wppBtn.addEventListener('click', () => {
      const vandoPhone = data.creditorPhone || '69992323382';
      const msg = `Olá, Vando Motos! Eu, *${data.clientName}*, já realizei a assinatura do meu contrato pelo *Gov.br*.\n\n` +
        `📄 *Documento:* Contrato / Nota Promissória\n` +
        `💰 *Valor:* ${formatBRL(data.amount)}\n` +
        `📅 *Vencimento:* ${formatDate(data.dueDate)}\n` +
        `👤 *CPF:* ${data.clientCpf || 'Registrado'}\n\n` +
        `Estou anexando o arquivo PDF assinado com o carimbo oficial do Governo Federal aqui nesta conversa para validação!`;

      const url = createWhatsAppUrl(vandoPhone, msg);
      window.open(url, '_blank');
    });
  }
}
