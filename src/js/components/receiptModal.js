// src/js/components/receiptModal.js
// Visualização, Impressão e Envio de Recibos e Notas Promissórias Oficiais - Vando Motos Locadora LTDA
// Validade Jurídica: MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateExtenso, numeroParaExtenso, createWhatsAppUrl, showToast } from '../utils.js';
import { BRASAO_BRASIL_B64 } from '../brasaoBase64.js';
import { openSignaturePad } from './signaturePad.js';
import { getPromissorySigningUrl } from './publicSignPortal.js';
import { icon } from '../icons.js';

export const MESES_CAP = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function getMesCapitalizado(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    const mesIdx = parseInt(parts[1], 10) - 1;
    return MESES_CAP[mesIdx] || '';
  }
  const d = new Date(dateStr);
  return MESES_CAP[d.getMonth()] || '';
}

/**
 * Renderiza o cartão da Nota Promissória no padrão oficial brasileiro
 */
export function renderSinglePromissoryCard(installment, loan, client, settings, currentIndex, totalCount) {
  const venc = formatDateExtenso(installment.dueDate);
  const mesCap = getMesCapitalizado(installment.dueDate);
  const acordo = formatDateExtenso(loan.startDate || new Date());
  const acordoMesCap = getMesCapitalizado(loan.startDate || new Date());

  // Converte valor por extenso
  const valorOriginal = Number(installment.installmentAmount) || 0;
  const extensoTexto = numeroParaExtenso(valorOriginal).toUpperCase();

  const praca = settings.creditorCity || 'PORTO VELHO RONDONIA';
  const beneficiario = settings.businessName || 'Vando motos locadora LTDA';
  const cnpjBeneficiario = settings.creditorCpfCnpj || '28.623.431-0001-23';

  const emitenteNome = client.name || 'BRUNO VASQUEZ CASTRO';
  const emitenteDoc = client.cpf || '025.653.052-14';
  const emitenteEnd = client.address || 'RUA DAS CRIANÇAS N:4516 B:FLRESTA';

  // Número formatado com zero à esquerda
  const numFormatado = String(currentIndex).padStart(2, '0');
  const totalFormatado = String(totalCount).padStart(2, '0');

  // Verifica se há assinatura eletrônica salva (no installment ou no loan)
  const sig = (installment && installment.signature) || (loan && loan.signature) || null;
  let signatureAreaHtml = `
    <div class="paw-line"></div>
    <div class="paw-name" style="color: #000000 !important;">${emitenteNome}</div>
  `;

  if (sig) {
    const sigImg = typeof sig === 'string' ? sig : (sig.dataUrl || '');
    const sigDate = sig.dateFormatted || (sig.timestamp ? formatDate(sig.timestamp) : '');
    const sigProto = sig.protocol || '';

    signatureAreaHtml = `
      <div style="text-align: center; margin-bottom: 2px;">
        <img src="${sigImg}" style="max-height: 48px; max-width: 210px; display: inline-block;" alt="Assinatura Digital">
      </div>
      <div class="paw-line"></div>
      <div class="paw-name" style="color: #000000 !important;">${emitenteNome}</div>
      <div style="font-size: 6.5pt; color: #166534; font-weight: 700; font-family: monospace; margin-top: 2px; line-height: 1.2;">
        ✓ ASSINADO DIGITALMENTE ${sigDate ? `EM ${sigDate}` : ''}
        ${sigProto ? `<br>Protocolo: ${sigProto}` : ''}
      </div>
    `;
  }

  return `
    <div class="promissoria-frame" style="background: #ffffff !important; color: #000000 !important;">
      <div class="promissoria-inner" style="background: #ffffff !important; color: #000000 !important;">
        
        <!-- Faixa Lateral Vertical Esquerda -->
        <div class="promissoria-sidebar" style="background: #ffffff !important;">
          <div class="promissoria-vertical-text" style="color: #000000 !important;">República Federativa do Brasil</div>
          <img src="${BRASAO_BRASIL_B64}" class="promissoria-brasao-img" alt="Brasão da República" />
        </div>

        <!-- Conteúdo Principal -->
        <div class="promissoria-main" style="background: #ffffff !important; color: #000000 !important;">
          
          <!-- Linha Superior: Título + Parcela + Tabela de Vencimento e Valor -->
          <div class="promissoria-header-line">
            <div class="promissoria-title-wrap">
              <span class="promissoria-title" style="color: #000000 !important;">NOTA PROMISSÓRIA</span>
              <span class="promissoria-parcela-num" style="color: #000000 !important;">${totalCount === 1 ? 'ÚNICA' : `${numFormatado} &nbsp;&nbsp;/&nbsp;&nbsp; ${totalFormatado}`}</span>
            </div>

            <table class="promissoria-venc-box" style="background: #ffffff !important; color: #000000 !important;">
              <tr>
                <td class="pvb-label" style="color: #000000 !important;">Vencimento</td>
                <td class="pvb-val" style="color: #000000 !important;">${venc.dia} de ${mesCap} de ${venc.ano}</td>
              </tr>
              <tr>
                <td class="pvb-label" style="color: #000000 !important;">Valor</td>
                <td class="pvb-val pvb-val-highlight" style="color: #000000 !important;">${formatBRL(valorOriginal)}</td>
              </tr>
            </table>
          </div>

          <!-- Corpo Legal -->
          <div class="promissoria-body-section" style="color: #000000 !important;">
            <div class="pbs-line pbs-line-1" style="color: #000000 !important;">
              <span style="color: #000000 !important;">Ao(s)</span>
              <span class="pbs-field pbs-field-date" style="color: #000000 !important;">${venc.dia} dia(s) do mês de ${venc.mes} do ano de ${venc.ano}</span>
              <span class="pbs-pagar-via" style="color: #000000 !important;">pagar por esta via de</span>
            </div>

            <div class="pbs-line pbs-line-2" style="color: #000000 !important;">
              <span style="color: #000000 !important;">NOTA PROMISSÓRIA à</span>
              <span class="pbs-field pbs-field-beneficiario" style="color: #000000 !important;">${beneficiario}</span>
            </div>

            <div class="pbs-line pbs-line-3" style="color: #000000 !important;">
              <span style="color: #000000 !important;">CNPJ</span>
              <span class="pbs-field pbs-field-cnpj" style="color: #000000 !important;">${cnpjBeneficiario}</span>
            </div>

            <div class="pbs-line pbs-line-4" style="color: #000000 !important;">
              <span class="pbs-ordem-label" style="color: #000000 !important;">ou à sua ordem a quantia de</span>
              <div class="pbs-extenso-box" style="background: #f1f5f9 !important; color: #000000 !important;">
                <strong style="color: #000000 !important;">${extensoTexto}</strong>
              </div>
            </div>

            <div class="pbs-line pbs-line-5" style="color: #000000 !important;">
              Em moeda corrente deste país, pagável na praça de ${praca}
            </div>
          </div>

          <!-- Seção do Emitente e Assinatura -->
          <div class="promissoria-footer-section">
            <div class="promissoria-emitente-box" style="background: #ffffff !important; color: #000000 !important;">
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">Emitente :</span>
                <strong class="peb-val" style="color: #000000 !important;">${emitenteNome}</strong>
              </div>
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">CNPJ/CPF:</span>
                <span class="peb-val" style="color: #000000 !important;">${emitenteDoc}</span>
              </div>
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">Endereço:</span>
                <span class="peb-val" style="color: #000000 !important;">${emitenteEnd}</span>
              </div>
            </div>

            <div class="promissoria-assinatura-wrap">
              <div class="paw-data" style="color: #000000 !important;">
                ${praca}, ${acordo.dia} de ${acordoMesCap} de ${acordo.ano}
              </div>
              <div class="paw-signature-area">
                ${signatureAreaHtml}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

export function createReceiptModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-recibo-impressao';

  modal.innerHTML = `
    <div class="modal-card doc-modal-card" style="max-width: 880px;">
      <div class="modal-header" style="flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <h3 class="modal-title" id="doc-modal-title">${icon('fileText', 18)} Nota Promissória Oficial</h3>
          <button class="modal-close-btn" id="doc-modal-close" title="Fechar">${icon('x', 16)}</button>
        </div>
        <!-- Seletor de Modo / Carnê quando for Nota Promissória -->
        <div id="doc-modal-controls" style="display: none; width: 100%; margin-top: 4px;">
          <select class="form-control" id="select-promissory-view" style="padding: 8px 12px; font-size: 0.88rem; min-height: 40px; background: var(--bg-3); color: #fff; border: 1px solid var(--border-soft); border-radius: var(--r-sm); width: 100%;">
            <!-- Opções dinâmicas -->
          </select>
        </div>
      </div>

      <div class="modal-body doc-modal-body" id="doc-modal-body" style="background: #cbd5e1; padding: 16px; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <!-- Conteúdo do Documento formatado -->
      </div>

      <div class="modal-footer" style="flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary" id="doc-modal-close-btn">Fechar</button>
        <button type="button" class="btn btn-secondary" id="doc-modal-copy-link-btn" title="Copiar link de assinatura para enviar ao cliente">${icon('link', 14)} Copiar Link</button>
        <button type="button" class="btn btn-secondary" id="doc-modal-sign-btn">${icon('pen', 14)} Assinar na Tela</button>
        <button type="button" class="btn btn-whatsapp" id="doc-modal-wpp-btn" style="background: #25d366; color: #fff; font-weight: 700; border: none;">${icon('whatsapp', 14)} Enviar WhatsApp c/ Link</button>
        <button type="button" class="btn btn-primary" id="doc-modal-print-btn">${icon('print', 14)} Imprimir / Salvar PDF</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#doc-modal-close');
  const closeBtn2 = modal.querySelector('#doc-modal-close-btn');
  const printBtn = modal.querySelector('#doc-modal-print-btn');
  const signBtn = modal.querySelector('#doc-modal-sign-btn');
  const wppBtn = modal.querySelector('#doc-modal-wpp-btn');
  const copyLinkBtn = modal.querySelector('#doc-modal-copy-link-btn');
  const body = modal.querySelector('#doc-modal-body');
  const controls = modal.querySelector('#doc-modal-controls');
  const selectView = modal.querySelector('#select-promissory-view');

  let currentMode = 'promissory'; // 'receipt' ou 'promissory'
  let currentDebtorName = 'Devedor';
  let currentLoan = null;
  let currentClient = null;
  let currentInstallments = [];
  let renderCurrentPromissoryFn = null;

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  // Assinatura na tela (quando o cliente assina presencialmente com o operador)
  signBtn.addEventListener('click', async () => {
    const signature = await openSignaturePad({
      title: 'Assinatura Digital do Cliente',
      signerName: currentDebtorName
    });

    if (signature) {
      const now = new Date();
      const protocol = `VM-NP-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const sigData = {
        dataUrl: signature.dataUrl,
        timestamp: signature.timestamp || now.toISOString(),
        dateFormatted: signature.dateFormatted || formatDate(now),
        protocol,
        signer: currentDebtorName
      };

      if (currentLoan) {
        currentLoan.signature = sigData;
        state.updateLoan(currentLoan.id, {
          signature: sigData,
          signedAt: sigData.timestamp,
          signProtocol: protocol
        });
        localStorage.setItem(`vando_signed_${currentLoan.id}`, JSON.stringify(sigData));
      }

      if (currentMode === 'promissory' && renderCurrentPromissoryFn) {
        renderCurrentPromissoryFn();
      } else {
        const sigAreas = body.querySelectorAll('.paw-signature-area, .recibo-assinatura-box');
        sigAreas.forEach(area => {
          area.innerHTML = `
            <div style="text-align: center; margin-bottom: 2px;">
              <img src="${signature.dataUrl}" style="max-height: 48px; max-width: 200px; display: inline-block;" alt="Assinatura Digital">
            </div>
            <div class="paw-line" style="border-top: 1.5px solid #000; width: 220px; margin: 0 auto 3px;"></div>
            <div class="paw-name" style="font-weight: 800; font-size: 8pt; color: #000;">${currentDebtorName}</div>
            <div style="font-size: 6pt; color: #166534; font-family: monospace; margin-top: 2px; font-weight: 700;">✓ Assinado digitalmente em ${signature.dateFormatted} • Protocolo: ${protocol}</div>
          `;
        });
      }
      showToast('Assinatura digital gravada e vinculada ao contrato com sucesso!', 'success');
    }
  });

  // Envio de WhatsApp com Promissória e Link de Assinatura
  wppBtn.addEventListener('click', () => {
    if (!currentLoan || !currentClient) {
      showToast('Nenhum empréstimo selecionado.', 'error');
      return;
    }

    const settings = state.getSettings();
    const selected = selectView ? selectView.value : 'all';
    const isSingle = (currentInstallments.length === 1);

    const inst = (selected !== 'all')
      ? currentInstallments.find(i => i.number === parseInt(selected, 10))
      : currentInstallments[0];

    const signingUrl = getPromissorySigningUrl(currentLoan, currentClient, inst, settings);
    const amountVal = isSingle ? currentLoan.totalPayable : (inst ? inst.installmentAmount : currentLoan.totalPayable);
    const dueVal = inst ? inst.dueDate : currentLoan.startDate;
    const numDesc = isSingle ? 'Única' : (inst ? `#${String(inst.number).padStart(2, '0')}/${String(currentInstallments.length).padStart(2, '0')}` : 'Carnê');

    const msg = `🏍️ *VANDO MOTOS LOCADORA - NOTA PROMISSÓRIA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOlá, *${currentClient.name}*!\n\nSegue o resumo da sua Nota Promissória referente ao seu empréstimo:\n\n📄 *Título:* Nota Promissória Oficial ${numDesc}\n💰 *Valor do Título:* ${formatBRL(amountVal)}\n📅 *Vencimento:* ${formatDate(dueVal)}\n🏛️ *Credor:* ${settings.businessName}\n📍 *Praça de Pagamento:* ${settings.creditorCity || 'PORTO VELHO RONDONIA'}\n\n✍️ *ASSINE SUA NOTA PROMISSÓRIA ONLINE:*\nAcesse o link seguro abaixo para visualizar o documento oficial e assinar com o dedo na tela do seu celular:\n👉 ${signingUrl}\n\n_Documento com validade jurídica integral (MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020)._\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    if (currentClient.phone) {
      const url = createWhatsAppUrl(currentClient.phone, msg);
      window.open(url, '_blank');
    } else {
      const inputPhone = prompt('O cliente não possui telefone cadastrado. Digite o número com DDD para abrir o WhatsApp (ex: 69999999999):');
      if (inputPhone) {
        const url = createWhatsAppUrl(inputPhone, msg);
        window.open(url, '_blank');
      } else {
        navigator.clipboard.writeText(msg).then(() => {
          showToast('Mensagem com link copiada para a área de transferência!');
        });
      }
    }
  });

  // Copiar Link de Assinatura Digital
  copyLinkBtn.addEventListener('click', () => {
    if (!currentLoan || !currentClient) return;

    const settings = state.getSettings();
    const selected = selectView ? selectView.value : 'all';
    const inst = (selected !== 'all')
      ? currentInstallments.find(i => i.number === parseInt(selected, 10))
      : currentInstallments[0];

    const signingUrl = getPromissorySigningUrl(currentLoan, currentClient, inst, settings);
    navigator.clipboard.writeText(signingUrl).then(() => {
      showToast('Link de assinatura digital copiado para a área de transferência!');
    });
  });

  // --- 1. RECIBO DE QUITAÇÃO DE PARCELA ---
  window.openReceiptModal = function(installmentId) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;

    const client = state.getClientById(inst.clientId) || { name: 'Cliente' };
    const loan = state.getLoanById(inst.loanId) || {};
    const settings = state.getSettings();

    currentMode = 'receipt';
    currentLoan = loan;
    currentClient = client;
    currentDebtorName = client.name;
    renderCurrentPromissoryFn = null;

    controls.style.display = 'none';
    copyLinkBtn.style.display = 'none';
    wppBtn.style.display = 'none';
    modal.querySelector('#doc-modal-title').innerHTML = `${icon('fileText', 18)} Recibo de Pagamento`;

    const lastPayment = (inst.paymentHistory && inst.paymentHistory.length > 0)
      ? inst.paymentHistory[inst.paymentHistory.length - 1]
      : { amount: inst.paidAmount || inst.installmentAmount, date: inst.paidDate || new Date(), method: 'PIX' };

    body.innerHTML = `
      <div class="printable-document" style="background: #fff; color: #0f172a; padding: 28px; border-radius: var(--radius-md); font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0; color: #0f172a;">${settings.businessName}</h2>
            <div style="font-size: 0.85rem; color: #64748b;">Comprovante de Quitação de Parcela</div>
          </div>
          <div style="text-align: right; font-size: 0.85rem; font-weight: 700; color: #059669;">
            RECIBO Nº ${inst.id.substring(inst.id.length - 6).toUpperCase()}
          </div>
        </div>

        <div style="font-size: 1rem; line-height: 1.8; color: #334155; margin-bottom: 24px;">
          Recebemos de <strong>${client.name}</strong>${client.cpf ? ` (CPF/CNPJ: ${client.cpf})` : ''},
          a quantia de <strong style="font-size: 1.15rem; color: #0f172a;">${formatBRL(lastPayment.amount)}</strong>,
          referente à quitação da <strong>Parcela nº ${inst.number}</strong> do contrato de empréstimo realizado em ${formatDate(loan.startDate || inst.dueDate)}.
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 0.9rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Vencimento Original:</span>
            <strong>${formatDate(inst.dueDate)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Data da Baixa:</span>
            <strong>${formatDate(lastPayment.date)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Forma de Pagamento:</span>
            <strong>${lastPayment.method || 'PIX'}</strong>
          </div>
          ${lastPayment.discount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #059669;">
              <span>Desconto Concedido:</span>
              <strong>- ${formatBRL(lastPayment.discount)}</strong>
            </div>
          ` : ''}
          ${lastPayment.lateChargesPaid > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #dc2626;">
              <span>Encargos / Mora Pagos:</span>
              <strong>+ ${formatBRL(lastPayment.lateChargesPaid)}</strong>
            </div>
          ` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px;">
          <div>
            <div style="font-size: 0.82rem; color: #64748b;">Data de emissão: ${formatDate(new Date())}</div>
          </div>
          <div style="text-align: center; width: 220px;">
            <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-size: 0.85rem; font-weight: 700;">
              ${settings.businessName}
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">Credor / Emitente</div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
  };

  // --- 2. NOTA PROMISSÓRIA (MODELO EXATO DO DOCUMENTO EXCEL / PDF) ---
  window.openPromissoryModal = function(loanId, specificInstallmentNumber = null) {
    const loan = state.getLoanById(loanId);
    if (!loan) return;

    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    const loanInsts = state.getInstallments({ loanId });
    const settings = state.getSettings();
    const totalCount = loanInsts.length;

    currentMode = 'promissory';
    currentLoan = loan;
    currentClient = client;
    currentInstallments = loanInsts;
    currentDebtorName = client.name;

    modal.querySelector('#doc-modal-title').innerHTML = `${icon('fileText', 18)} Nota Promissória (Modelo Oficial)`;
    controls.style.display = 'block';
    copyLinkBtn.style.display = 'inline-flex';
    wppBtn.style.display = 'inline-flex';

    // Monta as opções do seletor
    selectView.innerHTML = `
      <option value="all">${totalCount === 1 ? 'Nota Promissória Única' : `Todas as ${totalCount} Notas Promissórias (Carnê Completo)`}</option>
      ${loanInsts.map(inst => `
        <option value="${inst.number}">Nota nº ${String(inst.number).padStart(2, '0')} de ${String(totalCount).padStart(2, '0')} - Venc. ${formatDate(inst.dueDate)} (${formatBRL(inst.installmentAmount)})</option>
      `).join('')}
    `;

    if (specificInstallmentNumber) {
      selectView.value = String(specificInstallmentNumber);
    } else {
      selectView.value = 'all';
    }

    function renderView() {
      const selected = selectView.value;
      if (selected === 'all') {
        let htmlCarnet = '';
        loanInsts.forEach((inst, idx) => {
          htmlCarnet += renderSinglePromissoryCard(inst, loan, client, settings, inst.number, totalCount);

          // Adiciona divisória de corte ou quebra de folha
          if (idx < loanInsts.length - 1) {
            const isEndOfPage = ((idx + 1) % 3 === 0);
            htmlCarnet += `
              <div class="promissoria-cut-divider ${isEndOfPage ? 'page-break-divider' : ''}">
                <div class="cut-line-dash">
                  <span class="cut-icon">${icon('scissors', 13)}</span>
                </div>
              </div>
            `;
          }
        });
        body.innerHTML = `<div class="promissoria-print-sheet">${htmlCarnet}</div>`;
      } else {
        const instNum = parseInt(selected, 10);
        const inst = loanInsts.find(i => i.number === instNum) || loanInsts[0];
        body.innerHTML = `
          <div class="promissoria-print-sheet">
            ${renderSinglePromissoryCard(inst, loan, client, settings, inst.number, totalCount)}
          </div>
        `;
      }
    }

    renderCurrentPromissoryFn = renderView;
    selectView.onchange = renderView;
    renderView();

    modal.classList.add('active');
  };
}
