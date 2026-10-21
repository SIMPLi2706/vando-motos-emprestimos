// src/js/components/pdfExport.js
// Exportação de Relatórios Oficiais em PDF - Vando Motos Locadora LTDA
// Implementação em Vanilla JS puro via Iframe Imprimível (sem bibliotecas externas)

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, getDaysDiff, showToast } from '../utils.js';
import { icon } from '../icons.js';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Utilitário de Impressão via Iframe Invisível
 * Escreve HTML estilizado dentro do iframe e aciona window.print() sem interferir na UI principal
 */
function printIframe(htmlContent) {
  // Remove eventuais iframes anteriores
  const existingFrame = document.getElementById('pdf-export-hidden-frame');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'pdf-export-hidden-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Falha ao acionar impressão no iframe:', err);
      // Fallback seguro em nova janela caso o iframe seja bloqueado
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      } else {
        showToast('Permita popups ou impressão no navegador.', 'error');
      }
    } finally {
      // Remove o iframe após a conclusão da fila de impressão
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 6000);
    }
  };

  // Aguarda carregamento de imagens para evitar impressão com logos quebrados
  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    setTimeout(triggerPrint, 250);
  } else {
    let pending = images.length;
    let fallbackTimer = setTimeout(triggerPrint, 1500);

    const checkComplete = () => {
      pending--;
      if (pending <= 0) {
        clearTimeout(fallbackTimer);
        setTimeout(triggerPrint, 200);
      }
    };

    images.forEach(img => {
      if (img.complete) {
        checkComplete();
      } else {
        img.addEventListener('load', checkComplete);
        img.addEventListener('error', checkComplete);
      }
    });
  }
}

/**
 * Retorna os estilos CSS profissionais de impressão para os relatórios
 */
function getPrintStyles() {
  return `
    @page {
      size: A4;
      margin: 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-wrap {
      width: 100%;
    }
    /* Cabeçalho Principal */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-logo {
      height: 48px;
      max-width: 130px;
      object-fit: contain;
    }
    .header-text h1 {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.3px;
      margin: 0 0 2px 0;
    }
    .header-text p {
      font-size: 8.5pt;
      color: #475569;
      margin: 0;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      color: #64748b;
      line-height: 1.4;
    }
    .header-meta strong {
      color: #0f172a;
    }
    /* Barra de Título do Relatório */
    .title-banner {
      background-color: #f1f5f9;
      border-left: 5px solid #0f172a;
      padding: 8px 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title-banner h2 {
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .title-banner .period-tag {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
    }
    /* Grade de Estatísticas / Resumo */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .stat-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 12px;
      background: #f8fafc;
    }
    .stat-label {
      font-size: 7pt;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .stat-val {
      font-size: 12.5pt;
      font-weight: 800;
      color: #0f172a;
    }
    .stat-val.val-green { color: #047857; }
    .stat-val.val-blue { color: #1d4ed8; }
    .stat-val.val-red { color: #b91c1c; }
    .stat-sub {
      font-size: 7pt;
      color: #64748b;
      margin-top: 2px;
    }
    /* Caixas de Detalhes */
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      background: #fafafa;
      margin-bottom: 16px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 8.5pt;
    }
    .info-field label {
      display: block;
      font-size: 7pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }
    .info-field span {
      font-weight: 600;
      color: #0f172a;
    }
    /* Seções e Tabelas */
    .section-block {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 10pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #1e293b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-count {
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
    }
    .table-report {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .table-report th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 7.5pt;
    }
    .table-report td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: middle;
    }
    .table-report tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .table-report tfoot td {
      background-color: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #0f172a;
      border-bottom: 1px solid #cbd5e1;
      font-size: 8pt;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    /* Badges de Status */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 6.8pt;
      font-weight: 700;
      text-transform: uppercase;
      border-radius: 3px;
      border: 1px solid transparent;
      letter-spacing: 0.3px;
    }
    .badge-paid {
      background-color: #ecfdf5;
      color: #065f46;
      border-color: #a7f3d0;
    }
    .badge-overdue {
      background-color: #fef2f2;
      color: #991b1b;
      border-color: #fecaca;
    }
    .badge-pending {
      background-color: #eff6ff;
      color: #1e40af;
      border-color: #bfdbfe;
    }
    .badge-partial {
      background-color: #fff7ed;
      color: #9a3412;
      border-color: #fed7aa;
    }
    .badge-reneg {
      background-color: #fefce8;
      color: #854d0e;
      border-color: #fef08a;
    }
    /* Estado Vazio */
    .empty-row {
      text-align: center;
      padding: 14px !important;
      color: #64748b;
      font-style: italic;
    }
    /* Quebras de Página */
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    /* Rodapé do Documento */
    .report-footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #64748b;
    }
    .footer-stamp {
      font-weight: 600;
      color: #0f172a;
    }
  `;
}

/**
 * Função Auxiliar: Converte data para partes { year, month, day }
 */
function parseDateParts(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10)
      };
    }
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate()
  };
}

/**
 * 1. RELATÓRIO MENSAL EM PDF
 * Exporta generateMonthlyReportPDF(month, year)
 * 
 * @param {number|string} month - Mês de referência (1 a 12)
 * @param {number|string} year - Ano de referência (ex: 2026)
 */
export function generateMonthlyReportPDF(month, year) {
  const now = new Date();
  const targetYear = parseInt(year, 10) || now.getFullYear();
  let targetMonth = parseInt(month, 10);
  if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    targetMonth = now.getMonth() + 1;
  }

  const monthName = MESES[targetMonth - 1] || `Mês ${targetMonth}`;
  const reportTitle = `Relatório Mensal — ${monthName}/${targetYear}`;
  const settings = state.getSettings();
  const loans = state.getLoans();
  const installments = state.getInstallments();

  // Datas de referência
  const todayStr = formatDateForInput(now);
  const lastDayDate = new Date(targetYear, targetMonth, 0);
  const lastDayNum = lastDayDate.getDate();
  const lastDayStr = formatDateForInput(lastDayDate);

  // 1. Total Recebido no mês & Lista de pagamentos recebidos
  let totalReceived = 0;
  const receivedPayments = [];

  installments.forEach(inst => {
    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido', phone: '' };

    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        const parts = parseDateParts(rec.date);
        if (parts && parts.year === targetYear && parts.month === targetMonth) {
          const amt = Number(rec.amount || 0);
          totalReceived += amt;
          receivedPayments.push({
            date: rec.date,
            clientName: client.name,
            clientPhone: client.phone,
            amount: amt,
            installmentNumber: inst.number,
            method: rec.method || 'PIX',
            loanId: inst.loanId,
            receiptId: rec.id
          });
        }
      });
    } else if (inst.status === 'paid' && inst.paidDate) {
      // Fallback para parcelas marcadas como pagas sem array paymentHistory
      const parts = parseDateParts(inst.paidDate);
      if (parts && parts.year === targetYear && parts.month === targetMonth) {
        const amt = Number(inst.paidAmount || inst.installmentAmount || 0);
        totalReceived += amt;
        receivedPayments.push({
          date: inst.paidDate,
          clientName: client.name,
          clientPhone: client.phone,
          amount: amt,
          installmentNumber: inst.number,
          method: 'PIX',
          loanId: inst.loanId,
          receiptId: inst.id
        });
      }
    }
  });

  // Ordena pagamentos por data (crescente)
  receivedPayments.sort((a, b) => (String(a.date) > String(b.date) ? 1 : -1));

  // 2. Total Pendente do mês
  // Parcelas com vencimento no mês selecionado que ainda não foram totalmente pagas
  let totalPending = 0;
  installments.forEach(inst => {
    if (inst.status !== 'paid' && inst.status !== 'renegotiated') {
      const parts = parseDateParts(inst.dueDate);
      if (parts && parts.year === targetYear && parts.month === targetMonth) {
        const unpaidBalance = Math.max(0, Number(inst.installmentAmount || 0) - Number(inst.paidAmount || 0));
        totalPending += unpaidBalance;
      }
    }
  });

  // 3. Total em Atraso & Tabela de Parcelas Vencidas
  // Parcelas com vencimento anterior à data de corte que permanecem em aberto
  const isCurrentOrFuture = (targetYear > now.getFullYear()) ||
    (targetYear === now.getFullYear() && targetMonth >= (now.getMonth() + 1));
  const cutoffDateStr = isCurrentOrFuture ? todayStr : lastDayStr;

  let totalOverdue = 0;
  const overdueInstallments = [];

  installments.forEach(inst => {
    if (inst.status !== 'paid' && inst.status !== 'renegotiated') {
      if (inst.dueDate < cutoffDateStr) {
        const unpaidBalance = Math.max(0, Number(inst.installmentAmount || 0) - Number(inst.paidAmount || 0));
        if (unpaidBalance > 0) {
          const daysLate = Math.max(1, getDaysDiff(inst.dueDate, cutoffDateStr));
          totalOverdue += unpaidBalance;
          const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido', phone: '' };

          overdueInstallments.push({
            clientName: client.name,
            clientPhone: client.phone,
            loanId: inst.loanId,
            installmentNumber: inst.number,
            dueDate: inst.dueDate,
            amount: unpaidBalance,
            daysLate
          });
        }
      }
    }
  });

  // Ordena parcelas em atraso pelas mais atrasadas primeiro
  overdueInstallments.sort((a, b) => b.daysLate - a.daysLate);

  // 4. Número de empréstimos ativos
  const activeLoansCount = loans.filter(l => l.status === 'active').length;

  const generationTimestamp = new Date().toLocaleString('pt-BR');
  const origin = window.location.origin || '';
  const logoUrl = `${origin}/logo-vandomotos.png`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${reportTitle} — ${settings.businessName}</title>
      <style>${getPrintStyles()}</style>
    </head>
    <body>
      <div class="report-wrap">

        <!-- CABEÇALHO -->
        <header class="report-header">
          <div class="header-brand">
            <img src="${logoUrl}" class="header-logo" alt="Vando Motos" onerror="this.style.display='none'; document.getElementById('logo-fallback-m').style.display='block';">
            <div id="logo-fallback-m" style="display:none; font-weight: 800; font-size: 16pt; color: #0f172a; border: 2px solid #0f172a; padding: 3px 8px; border-radius: 4px;">VM</div>
            <div class="header-text">
              <h1>${settings.businessName || 'Vando motos locadora LTDA'}</h1>
              <p>CNPJ: <strong>${settings.creditorCpfCnpj || '28.623.431-0001-23'}</strong> • ${settings.creditorCity || 'PORTO VELHO RONDONIA'}</p>
            </div>
          </div>
          <div class="header-meta">
            <div>Documento Oficial</div>
            <div>Emitido em: <strong>${generationTimestamp}</strong></div>
          </div>
        </header>

        <!-- BANNER DE TÍTULO -->
        <div class="title-banner">
          <h2>${reportTitle}</h2>
          <div class="period-tag">Período: 01/${String(targetMonth).padStart(2, '0')}/${targetYear} até ${lastDayNum}/${String(targetMonth).padStart(2, '0')}/${targetYear}</div>
        </div>

        <!-- RESUMO FINANCEIRO (KPIs) -->
        <div class="stats-grid avoid-break">
          <div class="stat-card">
            <div class="stat-label">Total Recebido</div>
            <div class="stat-val val-green">${formatBRL(totalReceived)}</div>
            <div class="stat-sub">${receivedPayments.length} baixa(s) efetuada(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total Pendente (Mês)</div>
            <div class="stat-val val-blue">${formatBRL(totalPending)}</div>
            <div class="stat-sub">Vencimentos neste mês</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total em Atraso</div>
            <div class="stat-val val-red">${formatBRL(totalOverdue)}</div>
            <div class="stat-sub">${overdueInstallments.length} parcela(s) vencida(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Empréstimos Ativos</div>
            <div class="stat-val">${activeLoansCount}</div>
            <div class="stat-sub">Contratos em andamento</div>
          </div>
        </div>

        <!-- TABELA 1: PAGAMENTOS RECEBIDOS NO MÊS -->
        <div class="section-block avoid-break">
          <div class="section-title">
            <span>Pagamentos Recebidos no Mês</span>
            <span class="section-count">${receivedPayments.length} lançamento(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 15%;">Data</th>
                <th style="width: 40%;">Cliente</th>
                <th style="width: 15%; text-align: center;">Parcela</th>
                <th style="width: 15%;">Forma</th>
                <th style="width: 15%; text-align: right;">Valor Recebido</th>
              </tr>
            </thead>
            <tbody>
              ${receivedPayments.length > 0 ? receivedPayments.map(p => `
                <tr>
                  <td>${formatDate(p.date)}</td>
                  <td>
                    <strong>${p.clientName}</strong>
                    ${p.clientPhone ? `<span style="color: #64748b; font-size: 7pt; margin-left: 4px;">(${p.clientPhone})</span>` : ''}
                  </td>
                  <td class="text-center">Parc. ${p.installmentNumber}</td>
                  <td>${p.method || 'PIX'}</td>
                  <td class="text-right" style="font-weight: 700; color: #047857;">${formatBRL(p.amount)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" class="empty-row">Nenhum pagamento registrado no mês de ${monthName}/${targetYear}.</td>
                </tr>
              `}
            </tbody>
            ${receivedPayments.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right">SUBTOTAL RECEBIDO NO MÊS:</td>
                  <td class="text-right" style="color: #047857;">${formatBRL(totalReceived)}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- TABELA 2: PARCELAS EM ATRASO -->
        <div class="section-block avoid-break" style="margin-top: 20px;">
          <div class="section-title">
            <span>Parcelas Vencidas / Em Atraso</span>
            <span class="section-count">${overdueInstallments.length} inadimplência(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 40%;">Cliente</th>
                <th style="width: 15%; text-align: center;">Parcela</th>
                <th style="width: 15%;">Vencimento</th>
                <th style="width: 15%; text-align: center;">Dias de Atraso</th>
                <th style="width: 15%; text-align: right;">Valor em Aberto</th>
              </tr>
            </thead>
            <tbody>
              ${overdueInstallments.length > 0 ? overdueInstallments.map(o => `
                <tr>
                  <td>
                    <strong>${o.clientName}</strong>
                    ${o.clientPhone ? `<span style="color: #64748b; font-size: 7pt; margin-left: 4px;">(${o.clientPhone})</span>` : ''}
                  </td>
                  <td class="text-center">Parc. ${o.installmentNumber}</td>
                  <td>${formatDate(o.dueDate)}</td>
                  <td class="text-center">
                    <span class="badge badge-overdue">${o.daysLate} dia(s)</span>
                  </td>
                  <td class="text-right" style="font-weight: 700; color: #b91c1c;">${formatBRL(o.amount)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" class="empty-row" style="color: #047857;">Nenhuma parcela em atraso registrada até o momento. Situação regularizada!</td>
                </tr>
              `}
            </tbody>
            ${overdueInstallments.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right">TOTAL INADIMPLENTE EM ABERTO:</td>
                  <td class="text-right" style="color: #b91c1c;">${formatBRL(totalOverdue)}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- RODAPÉ -->
        <footer class="report-footer avoid-break">
          <div class="footer-stamp">${settings.businessName || 'Vando motos locadora LTDA'} • CNPJ: ${settings.creditorCpfCnpj || '28.623.431-0001-23'}</div>
          <div>Gerado em ${generationTimestamp} • Página 1/1</div>
        </footer>

      </div>
    </body>
    </html>
  `;

  showToast(`Gerando ${reportTitle} em PDF...`, 'info');
  printIframe(html);
}

/**
 * 2. RELATÓRIO DO CLIENTE EM PDF (DOSSIÊ COMPLETO)
 * Exporta generateClientReportPDF(clientId)
 * 
 * @param {string} clientId - ID do cliente cadastrado
 */
export function generateClientReportPDF(clientId) {
  if (!clientId) {
    showToast('Cliente não informado.', 'error');
    return;
  }

  const client = state.getClientById(clientId);
  if (!client) {
    showToast('Cliente não encontrado.', 'error');
    return;
  }

  const settings = state.getSettings();
  const allLoans = state.getLoans();
  const allInstallments = state.getInstallments();

  // Contratos e parcelas deste cliente
  const clientLoans = allLoans.filter(l => l.clientId === clientId);
  const clientInstallments = allInstallments.filter(i => i.clientId === clientId);

  // Ordena parcelas por vencimento
  clientInstallments.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

  // Histórico de pagamentos deste cliente
  const paymentHistory = [];
  clientInstallments.forEach(inst => {
    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        paymentHistory.push({
          date: rec.date,
          installmentNumber: inst.number,
          loanId: inst.loanId,
          amount: Number(rec.amount || 0),
          method: rec.method || 'PIX',
          discount: rec.discount || 0,
          lateChargesPaid: rec.lateChargesPaid || 0,
          notes: rec.notes || ''
        });
      });
    } else if (inst.status === 'paid' && inst.paidDate) {
      paymentHistory.push({
        date: inst.paidDate,
        installmentNumber: inst.number,
        loanId: inst.loanId,
        amount: Number(inst.paidAmount || inst.installmentAmount || 0),
        method: 'PIX',
        discount: 0,
        lateChargesPaid: 0,
        notes: ''
      });
    }
  });

  // Ordena pagamentos por data (mais recente primeiro)
  paymentHistory.sort((a, b) => (String(b.date) > String(a.date) ? 1 : -1));

  // Totais do Cliente
  const todayStr = formatDateForInput(new Date());
  let totalContracted = 0;
  let totalPayableSum = 0;
  let totalPaid = 0;
  let totalPendingBalance = 0;
  let totalOverdueBalance = 0;
  let overdueCount = 0;

  clientLoans.forEach(l => {
    totalContracted += Number(l.principal || 0);
    totalPayableSum += Number(l.totalPayable || 0);
  });

  clientInstallments.forEach(inst => {
    const paid = Number(inst.paidAmount || 0);
    const balance = Math.max(0, Number(inst.installmentAmount || 0) - paid);
    totalPaid += paid;

    if (inst.status !== 'paid' && inst.status !== 'renegotiated') {
      totalPendingBalance += balance;
      if (inst.dueDate < todayStr && balance > 0) {
        totalOverdueBalance += balance;
        overdueCount++;
      }
    }
  });

  let situationBadge = '<span class="badge badge-paid">Bom Pagador / Em Dia</span>';
  if (overdueCount > 0) {
    situationBadge = `<span class="badge badge-overdue">Inadimplente (${overdueCount} atraso${overdueCount > 1 ? 's' : ''})</span>`;
  } else if (clientLoans.length > 0 && totalPendingBalance === 0) {
    situationBadge = '<span class="badge badge-paid">Contratos Quitados</span>';
  } else if (clientLoans.length === 0) {
    situationBadge = '<span class="badge badge-pending">Sem Contratos Ativos</span>';
  }

  const generationTimestamp = new Date().toLocaleString('pt-BR');
  const origin = window.location.origin || '';
  const logoUrl = `${origin}/logo-vandomotos.png`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Dossiê do Cliente — ${client.name} — ${settings.businessName}</title>
      <style>${getPrintStyles()}</style>
    </head>
    <body>
      <div class="report-wrap">

        <!-- CABEÇALHO -->
        <header class="report-header">
          <div class="header-brand">
            <img src="${logoUrl}" class="header-logo" alt="Vando Motos" onerror="this.style.display='none'; document.getElementById('logo-fallback-c').style.display='block';">
            <div id="logo-fallback-c" style="display:none; font-weight: 800; font-size: 16pt; color: #0f172a; border: 2px solid #0f172a; padding: 3px 8px; border-radius: 4px;">VM</div>
            <div class="header-text">
              <h1>${settings.businessName || 'Vando motos locadora LTDA'}</h1>
              <p>CNPJ: <strong>${settings.creditorCpfCnpj || '28.623.431-0001-23'}</strong> • ${settings.creditorCity || 'PORTO VELHO RONDONIA'}</p>
            </div>
          </div>
          <div class="header-meta">
            <div>Dossiê Cadastral & Financeiro</div>
            <div>Emitido em: <strong>${generationTimestamp}</strong></div>
          </div>
        </header>

        <!-- BANNER DE TÍTULO -->
        <div class="title-banner">
          <h2>Ficha Financeira do Cliente — ${client.name}</h2>
          <div class="period-tag">${situationBadge}</div>
        </div>

        <!-- DADOS CADASTRAIS DO CLIENTE -->
        <div class="info-card avoid-break">
          <div class="info-grid">
            <div class="info-field">
              <label>Nome Completo</label>
              <span style="font-size: 10pt;">${client.name}</span>
            </div>
            <div class="info-field">
              <label>CPF / CNPJ</label>
              <span>${client.cpf || 'Não informado'}</span>
            </div>
            <div class="info-field">
              <label>Telefone / WhatsApp</label>
              <span>${client.phone || 'Não informado'}</span>
            </div>
            <div class="info-field" style="grid-column: span 2;">
              <label>Endereço Residencial / Comercial</label>
              <span>${client.address || 'Não cadastrado'}</span>
            </div>
            <div class="info-field">
              <label>Limite de Crédito Aprovado</label>
              <span style="color: #047857; font-weight: 800;">${formatBRL(client.creditLimit || 0)}</span>
            </div>
            ${client.notes ? `
              <div class="info-field" style="grid-column: span 3; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px;">
                <label>Observações Internas</label>
                <span style="color: #475569; font-weight: normal;">${client.notes}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- RESUMO FINANCEIRO DO CLIENTE -->
        <div class="stats-grid avoid-break">
          <div class="stat-card">
            <div class="stat-label">Total Financiado</div>
            <div class="stat-val">${formatBRL(totalContracted)}</div>
            <div class="stat-sub">${clientLoans.length} contrato(s) emitido(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total Quitado</div>
            <div class="stat-val val-green">${formatBRL(totalPaid)}</div>
            <div class="stat-sub">${paymentHistory.length} pagamento(s) realizado(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Saldo em Aberto</div>
            <div class="stat-val val-blue">${formatBRL(totalPendingBalance)}</div>
            <div class="stat-sub">A vencer / pendente</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Saldo em Atraso</div>
            <div class="stat-val val-red">${formatBRL(totalOverdueBalance)}</div>
            <div class="stat-sub">${overdueCount} parcela(s) vencida(s)</div>
          </div>
        </div>

        <!-- SEÇÃO 1: CONTRATOS DO CLIENTE -->
        <div class="section-block avoid-break">
          <div class="section-title">
            <span>Contratos de Empréstimo</span>
            <span class="section-count">${clientLoans.length} registro(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 14%;">Contrato ID</th>
                <th style="width: 13%;">Data Início</th>
                <th style="width: 15%; text-align: right;">Principal</th>
                <th style="width: 16%;">Juros / Modelo</th>
                <th style="width: 12%; text-align: center;">Parcelas</th>
                <th style="width: 15%; text-align: right;">Total Contrato</th>
                <th style="width: 15%; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${clientLoans.length > 0 ? clientLoans.map(l => {
                let statusLabel = 'Ativo';
                let statusClass = 'badge-pending';
                if (l.status === 'paid') {
                  statusLabel = 'Quitado';
                  statusClass = 'badge-paid';
                } else if (l.status === 'renegotiated') {
                  statusLabel = 'Renegociado';
                  statusClass = 'badge-reneg';
                }
                const shortId = l.id.substring(l.id.length - 8).toUpperCase();
                return `
                  <tr>
                    <td><strong>#${shortId}</strong></td>
                    <td>${formatDate(l.startDate || l.createdAt)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatBRL(l.principal)}</td>
                    <td>${l.interestRate}% ao mês (${l.interestType || 'simples'})</td>
                    <td class="text-center">${l.installmentsCount}x</td>
                    <td class="text-right" style="font-weight: 700;">${formatBRL(l.totalPayable)}</td>
                    <td class="text-center"><span class="badge ${statusClass}">${statusLabel}</span></td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" class="empty-row">Nenhum contrato formal registrado para este cliente.</td>
                </tr>
              `}
            </tbody>
            ${clientLoans.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right">TOTAIS CONTRATADOS:</td>
                  <td class="text-right">${formatBRL(totalContracted)}</td>
                  <td colspan="2"></td>
                  <td class="text-right">${formatBRL(totalPayableSum)}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- SEÇÃO 2: CRONOGRAMA DE TODAS AS PARCELAS -->
        <div class="section-block avoid-break" style="margin-top: 16px;">
          <div class="section-title">
            <span>Cronograma Geral de Parcelas</span>
            <span class="section-count">${clientInstallments.length} parcela(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 12%; text-align: center;">Parcela</th>
                <th style="width: 14%;">Vencimento</th>
                <th style="width: 16%; text-align: right;">Valor Parcela</th>
                <th style="width: 16%; text-align: right;">Valor Pago</th>
                <th style="width: 16%; text-align: right;">Saldo Restante</th>
                <th style="width: 14%;">Data Baixa</th>
                <th style="width: 12%; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${clientInstallments.length > 0 ? clientInstallments.map(inst => {
                const paid = Number(inst.paidAmount || 0);
                const remaining = Math.max(0, Number(inst.installmentAmount || 0) - paid);
                const isOverdue = inst.status !== 'paid' && inst.status !== 'renegotiated' && inst.dueDate < todayStr;

                let stBadge = '<span class="badge badge-pending">Pendente</span>';
                if (inst.status === 'paid') {
                  stBadge = '<span class="badge badge-paid">Paga</span>';
                } else if (inst.status === 'partial') {
                  stBadge = '<span class="badge badge-partial">Parcial</span>';
                } else if (inst.status === 'renegotiated') {
                  stBadge = '<span class="badge badge-reneg">Renegociada</span>';
                } else if (isOverdue) {
                  stBadge = '<span class="badge badge-overdue">Vencida</span>';
                }

                return `
                  <tr>
                    <td class="text-center"><strong>${inst.number}ª Parc.</strong></td>
                    <td>${formatDate(inst.dueDate)}</td>
                    <td class="text-right">${formatBRL(inst.installmentAmount)}</td>
                    <td class="text-right" style="color: #047857;">${paid > 0 ? formatBRL(paid) : '-'}</td>
                    <td class="text-right" style="font-weight: 700; color: ${isOverdue ? '#b91c1c' : '#0f172a'};">${remaining > 0 ? formatBRL(remaining) : 'R$ 0,00'}</td>
                    <td>${inst.paidDate ? formatDate(inst.paidDate) : '-'}</td>
                    <td class="text-center">${stBadge}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" class="empty-row">Nenhuma parcela cadastrada para este cliente.</td>
                </tr>
              `}
            </tbody>
            ${clientInstallments.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right">SUBTOTAIS:</td>
                  <td class="text-right">${formatBRL(clientInstallments.reduce((sum, i) => sum + Number(i.installmentAmount || 0), 0))}</td>
                  <td class="text-right" style="color: #047857;">${formatBRL(totalPaid)}</td>
                  <td class="text-right" style="color: #b91c1c;">${formatBRL(totalPendingBalance)}</td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- SEÇÃO 3: HISTÓRICO DE PAGAMENTOS REALIZADOS -->
        <div class="section-block avoid-break" style="margin-top: 16px;">
          <div class="section-title">
            <span>Histórico de Pagamentos Efetuados</span>
            <span class="section-count">${paymentHistory.length} lançamento(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 15%;">Data</th>
                <th style="width: 15%; text-align: center;">Parcela</th>
                <th style="width: 18%; text-align: right;">Valor Pago</th>
                <th style="width: 15%;">Forma</th>
                <th style="width: 17%; text-align: right;">Descontos / Encargos</th>
                <th style="width: 20%;">Observações</th>
              </tr>
            </thead>
            <tbody>
              ${paymentHistory.length > 0 ? paymentHistory.map(p => `
                <tr>
                  <td>${formatDate(p.date)}</td>
                  <td class="text-center">Parc. ${p.installmentNumber}</td>
                  <td class="text-right" style="font-weight: 700; color: #047857;">${formatBRL(p.amount)}</td>
                  <td>${p.method || 'PIX'}</td>
                  <td class="text-right">
                    ${p.discount > 0 ? `<span style="color: #047857;">Desc: -${formatBRL(p.discount)}</span> ` : ''}
                    ${p.lateChargesPaid > 0 ? `<span style="color: #b91c1c;">Mora: +${formatBRL(p.lateChargesPaid)}</span>` : ''}
                    ${!p.discount && !p.lateChargesPaid ? '-' : ''}
                  </td>
                  <td>${p.notes || '-'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" class="empty-row">Nenhum pagamento efetuado até o momento.</td>
                </tr>
              `}
            </tbody>
            ${paymentHistory.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right">TOTAL PAGO PELO CLIENTE:</td>
                  <td class="text-right" style="color: #047857;">${formatBRL(totalPaid)}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- RODAPÉ -->
        <footer class="report-footer avoid-break">
          <div class="footer-stamp">${settings.businessName || 'Vando motos locadora LTDA'} • CNPJ: ${settings.creditorCpfCnpj || '28.623.431-0001-23'}</div>
          <div>Gerado em ${generationTimestamp} • Dossiê Confidencial</div>
        </footer>

      </div>
    </body>
    </html>
  `;

  showToast(`Gerando Dossiê em PDF de ${client.name}...`, 'info');
  printIframe(html);
}

/**
 * 3. MODAL DE SELEÇÃO DE MÊS / ANO PARA O RELATÓRIO MENSAL
 * Cria e exibe um modal padrão para o usuário escolher o mês desejado
 */
export function openMonthlyReportModal() {
  let modal = document.getElementById('modal-monthly-report-picker');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const defaultVal = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-monthly-report-picker';

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">${icon('fileText', 18)} Relatório Mensal em PDF</h3>
          <button class="modal-close-btn" id="btn-close-month-modal">${icon('x', 16)}</button>
        </div>

        <div class="modal-body">
          <p style="font-size: 0.88rem; color: var(--text-dim); margin-bottom: 16px;">
            Selecione o mês e o ano para gerar o demonstrativo financeiro consolidado de recebimentos e parcelas em atraso da <strong>Vando Motos Locadora LTDA</strong>.
          </p>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="report-month-select">Mês de Referência</label>
            <input type="month" class="form-control" id="report-month-select" value="${defaultVal}" style="font-size: 1rem; font-weight: 600;">
          </div>

          <!-- Atalhos rápidos -->
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-cur-month" style="flex: 1;">
              Mês Atual
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-prev-month" style="flex: 1;">
              Mês Anterior
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-month-modal">Cancelar</button>
          <button type="button" class="btn btn-primary" id="btn-generate-month-pdf">
            ${icon('print', 14)} Gerar Relatório PDF
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btn-close-month-modal');
    const cancelBtn = modal.querySelector('#btn-cancel-month-modal');
    const generateBtn = modal.querySelector('#btn-generate-month-pdf');
    const monthInput = modal.querySelector('#report-month-select');
    const quickCurBtn = modal.querySelector('#btn-quick-cur-month');
    const quickPrevBtn = modal.querySelector('#btn-quick-prev-month');

    function closeModal() {
      modal.classList.remove('active');
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    quickCurBtn.addEventListener('click', () => {
      const d = new Date();
      monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    quickPrevBtn.addEventListener('click', () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    generateBtn.addEventListener('click', () => {
      const val = monthInput.value;
      if (!val) {
        showToast('Selecione um mês e ano válidos.', 'error');
        return;
      }
      const [y, m] = val.split('-');
      closeModal();
      generateMonthlyReportPDF(parseInt(m, 10), parseInt(y, 10));
    });
  }

  // Define valor inicial e abre modal
  const input = modal.querySelector('#report-month-select');
  if (input) input.value = defaultVal;
  modal.classList.add('active');
}
