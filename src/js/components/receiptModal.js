// src/js/components/receiptModal.js
// Visualização e Impressão de Recibos e Notas Promissórias Oficiais

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateExtenso, numeroParaExtenso, showToast } from '../utils.js';
import { BRASAO_BRASIL_B64 } from '../brasaoBase64.js';

export function createReceiptModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-recibo-impressao';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 860px; max-height: 94vh;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; flex-wrap: wrap;">
          <h3 class="modal-title" id="doc-modal-title">📄 Nota Promissória Oficial</h3>
          <!-- Seletor de Modo / Carnê quando for Nota Promissória -->
          <div id="doc-modal-controls" style="display: none; margin-left: auto; margin-right: 12px;">
            <select class="form-control" id="select-promissory-view" style="padding: 4px 10px; font-size: 0.82rem; min-height: 32px; background: var(--bg-card); color: var(--text-main);">
              <!-- Opções dinâmicas -->
            </select>
          </div>
        </div>
        <button class="modal-close-btn" id="doc-modal-close">✕</button>
      </div>

      <div class="modal-body" id="doc-modal-body" style="background: #e2e8f0; padding: 20px; overflow-y: auto;">
        <!-- Conteúdo do Documento formatado -->
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="doc-modal-close-btn">Fechar</button>
        <button type="button" class="btn btn-secondary" id="doc-modal-copy-btn">📋 Copiar Dados</button>
        <button type="button" class="btn btn-primary" id="doc-modal-print-btn">🖨️ Imprimir / Salvar PDF</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#doc-modal-close');
  const closeBtn2 = modal.querySelector('#doc-modal-close-btn');
  const printBtn = modal.querySelector('#doc-modal-print-btn');
  const copyBtn = modal.querySelector('#doc-modal-copy-btn');
  const body = modal.querySelector('#doc-modal-body');
  const controls = modal.querySelector('#doc-modal-controls');
  const selectView = modal.querySelector('#select-promissory-view');

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

  copyBtn.addEventListener('click', () => {
    const text = body.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Dados copiados para a área de transferência!');
    });
  });

  // --- 1. RECIBO DE QUITAÇÃO DE PARCELA ---
  window.openReceiptModal = function(installmentId) {
    const inst = state.getInstallmentById(installmentId);
    if (!inst) return;

    const client = state.getClientById(inst.clientId) || { name: 'Cliente' };
    const loan = state.getLoanById(inst.loanId) || {};
    const settings = state.getSettings();

    controls.style.display = 'none';
    modal.querySelector('#doc-modal-title').textContent = '📄 Recibo de Pagamento';

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

  const MESES_CAP = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  function getMesCapitalizado(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const mesIdx = parseInt(parts[1], 10) - 1;
      return MESES_CAP[mesIdx] || '';
    }
    const d = new Date(dateStr);
    return MESES_CAP[d.getMonth()] || '';
  }

  function renderSinglePromissoryCard(installment, loan, client, settings, currentIndex, totalCount) {
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

    return `
      <div class="promissoria-frame">
        <div class="promissoria-inner">
          
          <!-- Faixa Lateral Vertical Esquerda -->
          <div class="promissoria-sidebar">
            <div class="promissoria-vertical-text">República Federativa do Brasil</div>
            <img src="${BRASAO_BRASIL_B64}" class="promissoria-brasao-img" alt="Brasão da República" />
          </div>

          <!-- Conteúdo Principal -->
          <div class="promissoria-main">
            
            <!-- Linha Superior: Título + Parcela + Tabela de Vencimento e Valor -->
            <div class="promissoria-header-line">
              <div class="promissoria-title-wrap">
                <span class="promissoria-title">NOTA PROMISSÓRIA</span>
                <span class="promissoria-parcela-num">${numFormatado} &nbsp;&nbsp;/&nbsp;&nbsp; ${totalFormatado}</span>
              </div>

              <table class="promissoria-venc-box">
                <tr>
                  <td class="pvb-label">Vencimento</td>
                  <td class="pvb-val">${venc.dia} de ${mesCap} de ${venc.ano}</td>
                </tr>
                <tr>
                  <td class="pvb-label">Valor</td>
                  <td class="pvb-val pvb-val-highlight">${formatBRL(valorOriginal)}</td>
                </tr>
              </table>
            </div>

            <!-- Corpo Legal -->
            <div class="promissoria-body-section">
              <div class="pbs-line pbs-line-1">
                <span>Ao(s)</span>
                <span class="pbs-field pbs-field-date">${venc.dia} dia(s) do mês de ${venc.mes} do ano de ${venc.ano}</span>
                <span class="pbs-pagar-via">pagar por esta via de</span>
              </div>

              <div class="pbs-line pbs-line-2">
                <span>NOTA PROMISSÓRIA à</span>
                <span class="pbs-field pbs-field-beneficiario">${beneficiario}</span>
              </div>

              <div class="pbs-line pbs-line-3">
                <span>CNPJ</span>
                <span class="pbs-field pbs-field-cnpj">${cnpjBeneficiario}</span>
              </div>

              <div class="pbs-line pbs-line-4">
                <span class="pbs-ordem-label">ou à sua ordem a quantia de</span>
                <div class="pbs-extenso-box">
                  <strong>${extensoTexto}</strong>
                </div>
              </div>

              <div class="pbs-line pbs-line-5">
                Em moeda corrente deste país, pagável na praça de ${praca}
              </div>
            </div>

            <!-- Seção do Emitente e Assinatura -->
            <div class="promissoria-footer-section">
              <div class="promissoria-emitente-box">
                <div class="peb-row">
                  <span class="peb-label">Emitente :</span>
                  <strong class="peb-val">${emitenteNome}</strong>
                </div>
                <div class="peb-row">
                  <span class="peb-label">CNPJ/CPF:</span>
                  <span class="peb-val">${emitenteDoc}</span>
                </div>
                <div class="peb-row">
                  <span class="peb-label">Endereço:</span>
                  <span class="peb-val">${emitenteEnd}</span>
                </div>
              </div>

              <div class="promissoria-assinatura-wrap">
                <div class="paw-data">
                  ${praca}, ${acordo.dia} de ${acordoMesCap} de ${acordo.ano}
                </div>
                <div class="paw-signature-area">
                  <div class="paw-line"></div>
                  <div class="paw-name">${emitenteNome}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  window.openPromissoryModal = function(loanId, specificInstallmentNumber = null) {
    const loan = state.getLoanById(loanId);
    if (!loan) return;

    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    const loanInsts = state.getInstallments({ loanId });
    const settings = state.getSettings();
    const totalCount = loanInsts.length;

    modal.querySelector('#doc-modal-title').textContent = '📄 Nota Promissória (Modelo Oficial)';
    controls.style.display = 'block';

    // Monta as opções do seletor
    selectView.innerHTML = `
      <option value="all">Todas as ${totalCount} Notas Promissórias (Carnê Completo)</option>
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
                  <span class="cut-icon">✂</span>
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

    selectView.onchange = renderView;
    renderView();

    modal.classList.add('active');
  };
}
