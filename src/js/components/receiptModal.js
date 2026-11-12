// src/js/components/receiptModal.js
// Visualização, Impressão e Envio de Recibos e Notas Promissórias Oficiais - Vando Motos Locadora LTDA
// Validade Jurídica: MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateExtenso, numeroParaExtenso, createWhatsAppUrl, showToast, escapeHtml } from '../utils.js';
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

  const emitenteNome = client.name || 'Cliente';
  const emitenteDoc = client.cpf || 'Não informado';
  const emitenteEnd = client.address || 'Endereço não informado';
  const avalista = loan && loan.guarantor && loan.guarantor.name ? loan.guarantor : null;

  // Número formatado com zero à esquerda
  const numFormatado = String(currentIndex).padStart(2, '0');
  const totalFormatado = String(totalCount).padStart(2, '0');

  // Verifica se há assinatura eletrônica salva (no installment, no loan ou no localStorage)
  let sig = (installment && installment.signature) || (loan && loan.signature) || null;
  if (!sig && loan && loan.id) {
    try {
      const raw = localStorage.getItem(`vando_signed_${loan.id}`);
      if (raw) sig = JSON.parse(raw);
    } catch (e) {}
  }
  let signatureAreaHtml = `
    <div class="paw-line"></div>
    <div class="paw-name" style="color: #000000 !important;">${escapeHtml(emitenteNome)}</div>
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
      <div class="paw-name" style="color: #000000 !important;">${escapeHtml(emitenteNome)}</div>
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
              <span class="pbs-field pbs-field-beneficiario" style="color: #000000 !important;">${escapeHtml(beneficiario)}</span>
            </div>

            <div class="pbs-line pbs-line-3" style="color: #000000 !important;">
              <span style="color: #000000 !important;">CNPJ</span>
              <span class="pbs-field pbs-field-cnpj" style="color: #000000 !important;">${escapeHtml(cnpjBeneficiario)}</span>
            </div>

            <div class="pbs-line pbs-line-4" style="color: #000000 !important;">
              <span class="pbs-ordem-label" style="color: #000000 !important;">ou à sua ordem a quantia de</span>
              <div class="pbs-extenso-box" style="background: #f1f5f9 !important; color: #000000 !important;">
                <strong style="color: #000000 !important;">${extensoTexto}</strong>
              </div>
            </div>

            <div class="pbs-line pbs-line-5" style="color: #000000 !important;">
              Em moeda corrente deste país, pagável na praça de ${escapeHtml(praca)}
            </div>
          </div>

          <!-- Seção do Emitente e Assinatura -->
          <div class="promissoria-footer-section">
            <div class="promissoria-emitente-box" style="background: #ffffff !important; color: #000000 !important;">
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">Emitente :</span>
                <strong class="peb-val" style="color: #000000 !important;">${escapeHtml(emitenteNome)}</strong>
              </div>
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">CNPJ/CPF:</span>
                <span class="peb-val" style="color: #000000 !important;">${escapeHtml(emitenteDoc)}</span>
              </div>
              <div class="peb-row">
                <span class="peb-label" style="color: #000000 !important;">Endereço:</span>
                <span class="peb-val" style="color: #000000 !important;">${escapeHtml(emitenteEnd)}</span>
              </div>
              ${avalista ? `
                <div class="peb-row" style="border-top: 1px dashed #cbd5e1; margin-top: 2px; padding-top: 2px;">
                  <span class="peb-label" style="color: #000000 !important;">Avalista :</span>
                  <span class="peb-val" style="color: #000000 !important;">${escapeHtml(avalista.name)}${avalista.cpf ? ` (${escapeHtml(avalista.cpf)})` : ''}</span>
                </div>
              ` : ''}
            </div>

            <div class="promissoria-assinatura-wrap">
              <div class="paw-data" style="color: #000000 !important;">
                ${escapeHtml(praca)}, ${acordo.dia} de ${acordoMesCap} de ${acordo.ano}
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

/**
 * Renderiza o Instrumento Particular de Confissão de Dívida e Mútuo Financeiro (Padrão A4 Formal)
 */
export function renderDebtConfessionContract(loan, client, loanInsts = [], settings = {}) {
  const praca = settings.creditorCity || 'PORTO VELHO RONDONIA';
  const beneficiario = settings.businessName || 'Vando motos locadora LTDA';
  const cnpjBeneficiario = settings.creditorCpfCnpj || '28.623.431-0001-23';
  const acordo = formatDateExtenso(loan.startDate || new Date());

  const totalPayable = Number(loan.totalPayable || loan.principal || 0);
  const principal = Number(loan.principal || 0);
  const interestRate = Number(loan.interestRate || 0);
  const instsList = (loanInsts && loanInsts.length > 0)
    ? loanInsts
    : [{ number: 1, dueDate: loan.startDate, installmentAmount: totalPayable }];

  const g = loan.guarantee && (loan.guarantee.type || loan.guarantee.description || loan.guarantee.plateRenavam) ? loan.guarantee : null;
  const av = loan.guarantor && loan.guarantor.name ? loan.guarantor : null;

  let sig = loan.signature || null;
  if (!sig && loan && loan.id) {
    try {
      const raw = localStorage.getItem(`vando_signed_${loan.id}`);
      if (raw) sig = JSON.parse(raw);
    } catch (e) {}
  }

  let debtorSigHtml = `
    <div style="border-top: 1px solid #0f172a; margin-top: 38px; padding-top: 5px; font-weight: 700; font-size: 9pt;">
      ${escapeHtml(client.name || 'Devedor')}<br>
      <span style="font-weight: 400; font-size: 8pt;">DEVEDOR(A) • CPF/CNPJ: ${escapeHtml(client.cpf || 'N/I')}</span>
    </div>
  `;

  if (sig) {
    const sigImg = typeof sig === 'string' ? sig : (sig.dataUrl || '');
    const sigDate = sig.dateFormatted || (sig.timestamp ? formatDate(sig.timestamp) : '');
    const sigProto = sig.protocol || '';
    debtorSigHtml = `
      <div style="margin-bottom: 2px;">
        <img src="${sigImg}" style="max-height: 46px; max-width: 210px; display: inline-block;" alt="Assinatura Digital">
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 700; font-size: 9pt;">
        ${escapeHtml(client.name || 'Devedor')}<br>
        <span style="font-weight: 400; font-size: 8pt;">DEVEDOR(A) • CPF/CNPJ: ${escapeHtml(client.cpf || 'N/I')}</span>
      </div>
      <div style="font-size: 7pt; color: #166534; font-family: monospace; font-weight: 700; margin-top: 2px;">
        ✓ Assinado eletronicamente ${sigDate ? `em ${sigDate}` : ''}${sigProto ? ` • Protocolo: ${sigProto}` : ''}
      </div>
    `;
  }

  return `
    <div class="contract-a4-sheet printable-document" style="background: #ffffff !important; color: #0f172a !important;">
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
        <div style="font-size: 13pt; font-weight: 900; letter-spacing: 0.4px;">${escapeHtml(beneficiario.toUpperCase())}</div>
        <div style="font-size: 8.5pt; color: #334155;">CNPJ/CPF: ${escapeHtml(cnpjBeneficiario)} • Praça: ${escapeHtml(praca)}</div>
        <h2 style="font-size: 11.5pt; font-weight: 800; margin: 10px 0 2px; text-transform: uppercase;">
          Instrumento Particular de Confissão de Dívida e Mútuo Financeiro
        </h2>
        <div style="font-size: 8pt; color: #475569;">Contrato nº ${escapeHtml((loan.id || '').slice(-8).toUpperCase())} • Emitido em ${formatDate(loan.startDate)}</div>
      </div>

      <p style="font-size: 9pt; line-height: 1.5; margin-bottom: 10px; text-align: justify;">
        Pelo presente instrumento particular de Confissão de Dívida (Art. 784, inciso III, do Código de Processo Civil), de um lado como <strong>CREDOR(A)</strong> <strong>${escapeHtml(beneficiario)}</strong>, inscrito(a) no CPF/CNPJ sob nº <strong>${escapeHtml(cnpjBeneficiario)}</strong>, com domicílio na praça de <strong>${escapeHtml(praca)}</strong>, e de outro lado como <strong>DEVEDOR(A)</strong> <strong>${escapeHtml(client.name || 'Cliente')}</strong>, inscrito(a) no CPF/CNPJ nº <strong>${escapeHtml(client.cpf || 'Não informado')}</strong>, telefone <strong>${escapeHtml(client.phone || 'Não informado')}</strong>, residente/domiciliado em <strong>${escapeHtml(client.address || 'Endereço não informado')}</strong>${av ? `, e ainda como <strong>AVALISTA / DEVEDOR SOLIDÁRIO</strong> <strong>${escapeHtml(av.name)}</strong>, CPF nº <strong>${escapeHtml(av.cpf || 'N/I')}</strong>${av.address ? `, residente em ${escapeHtml(av.address)}` : ''}` : ''}, têm entre si justo e contratado o seguinte:
      </p>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 9.2pt; font-weight: 800; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #0f172a; margin-bottom: 6px;">
          CLÁUSULA 1ª — DO RECONHECIMENTO DA DÍVIDA E CONDIÇÕES
        </div>
        <p style="font-size: 8.8pt; line-height: 1.48; text-align: justify; margin: 0 0 8px;">
          O(A) DEVEDOR(A) confessa e reconhece dever ao(à) CREDOR(A) a quantia líquida, certa e exigível total de <strong>${formatBRL(totalPayable)}</strong> (<em>${numeroParaExtenso(totalPayable)}</em>), originária de mútuo financeiro no capital principal de <strong>${formatBRL(principal)}</strong> acrescido de juros pactuados de <strong>${interestRate}%</strong> (${loan.installmentsCount === 1 ? 'pagamento único' : `parcelado em ${loan.installmentsCount}x`}), com vencimento(s) conforme discriminado abaixo:
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 6px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left;">Parcela</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left;">Vencimento</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">Valor da Prestação</th>
            </tr>
          </thead>
          <tbody>
            ${instsList.map(i => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${loan.installmentsCount === 1 ? 'Parcela Única' : `Parcela ${String(i.number).padStart(2, '0')}/${String(instsList.length).padStart(2, '0')}`}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${formatDate(i.dueDate)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: right; font-weight: 700;">${formatBRL(i.installmentAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${g ? `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 9.2pt; font-weight: 800; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #0f172a; margin-bottom: 6px;">
            CLÁUSULA 2ª — DA GARANTIA CONTRATUAL VINCULADA
          </div>
          <p style="font-size: 8.8pt; line-height: 1.48; text-align: justify; margin: 0;">
            Como garantia adicional ao fiel cumprimento desta obrigação, fica vinculado ao presente instrumento o seguinte bem: <strong>${escapeHtml(g.type || 'Bem')}</strong>${g.description ? ` — <strong>${escapeHtml(g.description)}</strong>` : ''}${g.plateRenavam ? `, identificação/placa/série <strong>${escapeHtml(g.plateRenavam)}</strong>` : ''}${g.estimatedValue ? `, avaliado em <strong>${formatBRL(g.estimatedValue)}</strong>` : ''}, obrigando-se o DEVEDOR a mantê-lo livre e desembaraçado até a integral quitação do débito.
          </p>
        </div>
      ` : ''}

      <div style="margin-bottom: 10px;">
        <div style="font-size: 9.2pt; font-weight: 800; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #0f172a; margin-bottom: 6px;">
          CLÁUSULA ${g ? '3ª' : '2ª'} — DOS ENCARGOS DE MORA E VENCIMENTO ANTECIPADO
        </div>
        <p style="font-size: 8.7pt; line-height: 1.45; text-align: justify; margin: 0;">
          O atraso no pagamento de qualquer prestação acarretará automaticamente multa moratória de <strong>${loan.penaltyRate ?? 2}%</strong> sobre o saldo em atraso e juros diários de <strong>${loan.dailyInterestRate ?? 0.1}% ao dia</strong>, além de facultar ao CREDOR declarar o vencimento antecipado de toda a dívida remanescente, independentemente de notificação judicial, podendo executar o saldo total acrescido de despesas de cobrança e honorários advocatícios.
        </p>
      </div>

      <div style="margin-bottom: 14px;">
        <div style="font-size: 9.2pt; font-weight: 800; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #0f172a; margin-bottom: 6px;">
          CLÁUSULA ${g ? '4ª' : '3ª'} — VALIDADE DIGITAL E FORO DA COMARCA
        </div>
        <p style="font-size: 8.7pt; line-height: 1.45; text-align: justify; margin: 0;">
          As partes reconhecem expressamente a validade jurídica deste contrato e de eventual assinatura eletrônica aposta em meio digital (MP nº 2.200-2/2001 e Lei nº 14.063/2020), elegendo o foro da Comarca de <strong>${escapeHtml(praca)}</strong> para dirimir quaisquer questões oriundas deste instrumento. ${loan.notes ? `<em>Obs.: ${escapeHtml(loan.notes)}.</em>` : ''}
        </p>
      </div>

      <div style="text-align: right; font-size: 9pt; margin: 14px 0 18px;">
        ${escapeHtml(praca)}, ${acordo.dia} de ${getMesCapitalizado(loan.startDate || new Date())} de ${acordo.ano}.
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; text-align: center; margin-bottom: 22px;">
        <div class="paw-signature-area">
          ${debtorSigHtml}
        </div>
        <div>
          <div style="border-top: 1px solid #0f172a; margin-top: 38px; padding-top: 5px; font-weight: 700; font-size: 9pt;">
            ${escapeHtml(beneficiario)}<br>
            <span style="font-weight: 400; font-size: 8pt;">CREDOR(A) • CNPJ/CPF: ${escapeHtml(cnpjBeneficiario)}</span>
          </div>
        </div>
      </div>

      ${av ? `
        <div style="max-width: 300px; margin: 0 auto 20px; text-align: center;">
          <div style="border-top: 1px solid #0f172a; margin-top: 24px; padding-top: 5px; font-weight: 700; font-size: 8.5pt;">
            ${escapeHtml(av.name)}<br>
            <span style="font-weight: 400; font-size: 7.8pt;">AVALISTA / FIADOR • CPF: ${escapeHtml(av.cpf || 'N/I')}</span>
          </div>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; font-size: 8pt; color: #334155; margin-top: 10px;">
        <div style="border-top: 1px dashed #94a3b8; padding-top: 4px;">
          <strong>Testemunha 1:</strong><br>Nome / CPF: _______________________________
        </div>
        <div style="border-top: 1px dashed #94a3b8; padding-top: 4px;">
          <strong>Testemunha 2:</strong><br>Nome / CPF: _______________________________
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza comprovante / promissória para Impressora Térmica (58mm ou 80mm)
 */
export function renderThermalDocument({ mode, loan, client, installment, loanInsts = [], settings = {}, widthMM = 80 }) {
  const praca = settings.creditorCity || 'PORTO VELHO RO';
  const beneficiario = settings.businessName || 'Vando motos locadora LTDA';
  const cnpjBeneficiario = settings.creditorCpfCnpj || '28.623.431-0001-23';
  const clsWidth = widthMM === 58 ? 'thermal-58mm' : 'thermal-80mm';

  if (mode === 'receipt' && installment) {
    const lastPayment = (installment.paymentHistory && installment.paymentHistory.length > 0)
      ? installment.paymentHistory[installment.paymentHistory.length - 1]
      : { amount: installment.paidAmount || installment.installmentAmount, date: installment.paidDate || new Date(), method: 'PIX' };

    return `
      <div class="thermal-ticket ${clsWidth} printable-document">
        <div class="tt-center tt-bold tt-lg">${escapeHtml(beneficiario.toUpperCase())}</div>
        <div class="tt-center tt-sm">CNPJ: ${escapeHtml(cnpjBeneficiario)}</div>
        <div class="tt-center tt-sm">${escapeHtml(praca)}</div>
        <div class="tt-sep">--------------------------------</div>
        <div class="tt-center tt-bold">RECIBO DE PAGAMENTO</div>
        <div class="tt-center tt-sm">REC Nº ${escapeHtml((installment.id || '').slice(-6).toUpperCase())}</div>
        <div class="tt-sep">--------------------------------</div>
        <div><strong>CLIENTE:</strong> ${escapeHtml(client.name || 'Cliente')}</div>
        ${client.cpf ? `<div><strong>CPF/CNPJ:</strong> ${escapeHtml(client.cpf)}</div>` : ''}
        <div><strong>PARCELA:</strong> Nº ${installment.number}${loan?.installmentsCount ? `/${loan.installmentsCount}` : ''}</div>
        <div><strong>VENC. ORIG:</strong> ${formatDate(installment.dueDate)}</div>
        <div><strong>DATA BAIXA:</strong> ${formatDate(lastPayment.date)}</div>
        <div><strong>FORMA:</strong> ${escapeHtml(lastPayment.method || 'PIX')}</div>
        ${lastPayment.discount > 0 ? `<div><strong>DESCONTO:</strong> -${formatBRL(lastPayment.discount)}</div>` : ''}
        ${lastPayment.lateChargesPaid > 0 ? `<div><strong>MULTA/MORA:</strong> +${formatBRL(lastPayment.lateChargesPaid)}</div>` : ''}
        <div class="tt-sep">--------------------------------</div>
        <div class="tt-row tt-bold tt-lg">
          <span>VALOR PAGO:</span>
          <span>${formatBRL(lastPayment.amount)}</span>
        </div>
        <div class="tt-sep">--------------------------------</div>
        <div class="tt-center tt-sm" style="margin-top: 10px;">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
        <div class="tt-center tt-sm" style="margin-top: 18px;">__________________________<br>Assinatura / Visto Credor</div>
        <div class="tt-center tt-sm" style="margin-top: 8px;">Obrigado pela preferência!</div>
      </div>
    `;
  }

  // Cupom Térmico de Contrato / Promissória
  let sig = loan?.signature || null;
  if (!sig && loan && loan.id) {
    try {
      const raw = localStorage.getItem(`vando_signed_${loan.id}`);
      if (raw) sig = JSON.parse(raw);
    } catch (e) {}
  }

  const instsList = (loanInsts && loanInsts.length > 0) ? loanInsts : [];
  return `
    <div class="thermal-ticket ${clsWidth} printable-document">
      <div class="tt-center tt-bold tt-lg">${escapeHtml(beneficiario.toUpperCase())}</div>
      <div class="tt-center tt-sm">CNPJ: ${escapeHtml(cnpjBeneficiario)}</div>
      <div class="tt-sep">--------------------------------</div>
      <div class="tt-center tt-bold">COMPROVANTE DE PROMISSÓRIA</div>
      <div class="tt-center tt-sm">CONT Nº ${escapeHtml((loan?.id || '').slice(-6).toUpperCase())}</div>
      <div class="tt-sep">--------------------------------</div>
      <div><strong>DEVEDOR:</strong> ${escapeHtml(client.name || 'Cliente')}</div>
      ${client.cpf ? `<div><strong>CPF/CNPJ:</strong> ${escapeHtml(client.cpf)}</div>` : ''}
      ${client.phone ? `<div><strong>TEL:</strong> ${escapeHtml(client.phone)}</div>` : ''}
      <div><strong>DATA:</strong> ${formatDate(loan?.startDate)}</div>
      <div><strong>CAPITAL:</strong> ${formatBRL(loan?.principal)}</div>
      <div><strong>TAXA:</strong> ${loan?.interestRate || 0}%</div>
      <div class="tt-row tt-bold"><span>TOTAL PACTUADO:</span><span>${formatBRL(loan?.totalPayable)}</span></div>
      ${loan?.guarantee?.description ? `<div><strong>GARANTIA:</strong> ${escapeHtml(loan.guarantee.description)} ${escapeHtml(loan.guarantee.plateRenavam || '')}</div>` : ''}
      ${loan?.guarantor?.name ? `<div><strong>AVALISTA:</strong> ${escapeHtml(loan.guarantor.name)}</div>` : ''}
      <div class="tt-sep">--------------------------------</div>
      <div class="tt-bold">VENCIMENTOS:</div>
      ${instsList.map(i => `
        <div class="tt-row tt-sm">
          <span>#${String(i.number).padStart(2, '0')} ${formatDate(i.dueDate)}</span>
          <span>${formatBRL(i.installmentAmount)}</span>
        </div>
      `).join('')}
      <div class="tt-sep">--------------------------------</div>
      <div class="tt-sm">Comprometo-me a pagar a quantia acima na praça de ${escapeHtml(praca)}.</div>
      ${sig ? `
        <div class="tt-center" style="margin-top: 8px;">
          <img src="${typeof sig === 'string' ? sig : (sig.dataUrl || '')}" style="max-height: 36px; max-width: 140px;" alt="Assinatura">
          <div class="tt-sm">✓ Assinado Digitalmente${sig.protocol ? `<br>${sig.protocol}` : ''}</div>
        </div>
      ` : `
        <div class="tt-center tt-sm" style="margin-top: 22px;">__________________________<br>${escapeHtml(client.name || 'Devedor')}<br>Assinatura do Emitente</div>
      `}
      <div class="tt-center tt-sm" style="margin-top: 8px;">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
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
        <!-- Seletor de Tipo de Documento (A4 / Contrato / Térmico 58mm / 80mm) -->
        <div id="doc-view-tabs" class="doc-view-tabs" style="display: flex; flex-wrap: wrap; gap: 6px; width: 100%;"></div>
        <!-- Seletor de Modo / Carnê quando for Nota Promissória -->
        <div id="doc-modal-controls" style="display: none; width: 100%; margin-top: 2px;">
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
  const viewTabs = modal.querySelector('#doc-view-tabs');
  const selectView = modal.querySelector('#select-promissory-view');

  let currentMode = 'promissory'; // 'receipt' ou 'promissory'
  let currentDocTab = 'promissory'; // 'promissory' | 'contract' | 'receipt' | 'thermal58' | 'thermal80'
  let currentDebtorName = 'Devedor';
  let currentLoan = null;
  let currentClient = null;
  let currentInstallment = null;
  let currentInstallments = [];
  let renderCurrentDocFn = null;

  function clearThermalPrintClasses() {
    document.body.classList.remove('printing-thermal-58', 'printing-thermal-80');
  }

  function closeModal() {
    clearThermalPrintClasses();
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  printBtn.addEventListener('click', () => {
    clearThermalPrintClasses();
    if (currentDocTab === 'thermal58') {
      document.body.classList.add('printing-thermal-58');
    } else if (currentDocTab === 'thermal80') {
      document.body.classList.add('printing-thermal-80');
    }
    const cleanup = () => clearThermalPrintClasses();
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 3500);
    window.print();
  });

  function renderTabsBar() {
    const tabs = currentMode === 'promissory'
      ? [
          { id: 'promissory', label: 'Nota Promissória A4' },
          { id: 'contract', label: 'Contrato Confissão Dívida' },
          { id: 'thermal58', label: 'Cupom 58mm' },
          { id: 'thermal80', label: 'Cupom 80mm' }
        ]
      : [
          { id: 'receipt', label: 'Recibo A4' },
          { id: 'thermal58', label: 'Cupom 58mm' },
          { id: 'thermal80', label: 'Cupom 80mm' }
        ];

    viewTabs.innerHTML = tabs.map(t => `
      <button type="button" class="doc-tab-btn ${currentDocTab === t.id ? 'active' : ''}" data-doc-tab="${t.id}">
        ${t.label}
      </button>
    `).join('');

    viewTabs.querySelectorAll('.doc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentDocTab = btn.dataset.docTab;
        renderTabsBar();
        if (renderCurrentDocFn) renderCurrentDocFn();
      });
    });
  }

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
        state.logAudit('DOCUMENT_SIGNED_ONSITE', `Assinatura presencial coletada para ${currentDebtorName} (${protocol})`, 'loan', currentLoan.id);
        localStorage.setItem(`vando_signed_${currentLoan.id}`, JSON.stringify(sigData));
      }

      if (renderCurrentDocFn) {
        renderCurrentDocFn();
      } else {
        const sigAreas = body.querySelectorAll('.paw-signature-area, .recibo-assinatura-box');
        sigAreas.forEach(area => {
          area.innerHTML = `
            <div style="text-align: center; margin-bottom: 2px;">
              <img src="${signature.dataUrl}" style="max-height: 48px; max-width: 200px; display: inline-block;" alt="Assinatura Digital">
            </div>
            <div class="paw-line" style="border-top: 1.5px solid #000; width: 220px; margin: 0 auto 3px;"></div>
            <div class="paw-name" style="font-weight: 800; font-size: 8pt; color: #000;">${escapeHtml(currentDebtorName)}</div>
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
    currentDocTab = 'receipt';
    currentLoan = loan;
    currentClient = client;
    currentInstallment = inst;
    currentInstallments = [];
    currentDebtorName = client.name;

    controls.style.display = 'none';
    copyLinkBtn.style.display = 'none';
    wppBtn.style.display = 'none';
    signBtn.style.display = 'none';
    modal.querySelector('#doc-modal-title').innerHTML = `${icon('fileText', 18)} Recibo de Pagamento`;

    const lastPayment = (inst.paymentHistory && inst.paymentHistory.length > 0)
      ? inst.paymentHistory[inst.paymentHistory.length - 1]
      : { amount: inst.paidAmount || inst.installmentAmount, date: inst.paidDate || new Date(), method: 'PIX' };

    function renderReceiptDoc() {
      if (currentDocTab === 'thermal58' || currentDocTab === 'thermal80') {
        const widthMM = currentDocTab === 'thermal58' ? 58 : 80;
        body.innerHTML = renderThermalDocument({
          mode: 'receipt',
          loan,
          client,
          installment: inst,
          settings,
          widthMM
        });
        return;
      }

      body.innerHTML = `
        <div class="printable-document" style="background: #fff; color: #0f172a; padding: 28px; border-radius: var(--radius-md); font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0; color: #0f172a;">${escapeHtml(settings.businessName)}</h2>
              <div style="font-size: 0.85rem; color: #64748b;">Comprovante de Quitação de Parcela</div>
            </div>
            <div style="text-align: right; font-size: 0.85rem; font-weight: 700; color: #059669;">
              RECIBO Nº ${inst.id.substring(inst.id.length - 6).toUpperCase()}
            </div>
          </div>

          <div style="font-size: 1rem; line-height: 1.8; color: #334155; margin-bottom: 24px;">
            Recebemos de <strong>${escapeHtml(client.name)}</strong>${client.cpf ? ` (CPF/CNPJ: ${escapeHtml(client.cpf)})` : ''},
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
              <strong>${escapeHtml(lastPayment.method || 'PIX')}</strong>
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
                ${escapeHtml(settings.businessName)}
              </div>
              <div style="font-size: 0.75rem; color: #64748b;">Credor / Emitente</div>
            </div>
          </div>
        </div>
      `;
    }

    renderCurrentDocFn = renderReceiptDoc;
    renderTabsBar();
    renderReceiptDoc();
    modal.classList.add('active');
  };

  // --- 2. NOTA PROMISSÓRIA / CONTRATO DE CONFISSÃO / CUPOM ---
  window.openPromissoryModal = function(loanId, specificInstallmentNumber = null, initialTab = 'promissory') {
    const loan = state.getLoanById(loanId);
    if (!loan) return;

    const client = state.getClientById(loan.clientId) || { name: 'Cliente' };
    const loanInsts = state.getInstallments({ loanId });
    const settings = state.getSettings();
    const totalCount = loanInsts.length;

    currentMode = 'promissory';
    currentDocTab = ['promissory', 'contract', 'thermal58', 'thermal80'].includes(initialTab) ? initialTab : 'promissory';
    currentLoan = loan;
    currentClient = client;
    currentInstallment = null;
    currentInstallments = loanInsts;
    currentDebtorName = client.name;

    modal.querySelector('#doc-modal-title').innerHTML = `${icon('fileText', 18)} Documentos do Contrato`;
    copyLinkBtn.style.display = 'inline-flex';
    wppBtn.style.display = 'inline-flex';
    signBtn.style.display = 'inline-flex';

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
      const latestLoan = state.getLoanById(loan.id) || loan;
      currentLoan = latestLoan;

      controls.style.display = (currentDocTab === 'contract') ? 'none' : 'block';

      if (currentDocTab === 'contract') {
        body.innerHTML = `
          <div class="promissoria-print-sheet">
            ${renderDebtConfessionContract(latestLoan, client, loanInsts, settings)}
          </div>
        `;
        return;
      }

      if (currentDocTab === 'thermal58' || currentDocTab === 'thermal80') {
        const widthMM = currentDocTab === 'thermal58' ? 58 : 80;
        const targetInst = selected === 'all'
          ? loanInsts[0]
          : (loanInsts.find(i => i.number === parseInt(selected, 10)) || loanInsts[0]);
        body.innerHTML = renderThermalDocument({
          mode: 'promissory',
          loan: latestLoan,
          client,
          installment: targetInst,
          loanInsts,
          settings,
          widthMM
        });
        return;
      }

      if (selected === 'all') {
        let htmlCarnet = '';
        loanInsts.forEach((inst, idx) => {
          htmlCarnet += renderSinglePromissoryCard(inst, latestLoan, client, settings, inst.number, totalCount);

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
            ${renderSinglePromissoryCard(inst, latestLoan, client, settings, inst.number, totalCount)}
          </div>
        `;
      }
    }

    renderCurrentDocFn = renderView;
    selectView.onchange = renderView;
    renderTabsBar();
    renderView();

    modal.classList.add('active');
  };
}
