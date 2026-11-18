// src/js/components/pdfExport.js
// Exportação de Relatórios Oficiais em PDF - Vando Motos Locadora LTDA
// Implementação em Vanilla JS puro via Iframe Imprimível (sem bibliotecas externas)

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, getDaysDiff, showToast, escapeHtml, maskCPF } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
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
    .stats-grid-6 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .filter-pills-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .filter-pill {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 7.5pt;
      font-weight: 500;
      color: #334155;
    }
    .filter-pill strong {
      color: #0f172a;
    }
    .score-tag {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 999px;
      font-size: 6.5pt;
      font-weight: 800;
    }
    .score-tag-a { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .score-tag-b { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .score-tag-c { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .score-tag-d { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .compliance-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0f172a;
      padding: 10px 14px;
      font-size: 7.5pt;
      color: #475569;
      margin-top: 22px;
      line-height: 1.45;
    }
    .compliance-box strong {
      color: #0f172a;
      text-transform: uppercase;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 32px;
      padding-top: 8px;
    }
    .signature-card {
      text-align: center;
      font-size: 8pt;
      color: #475569;
    }
    .signature-card-line {
      border-top: 1.5px solid #0f172a;
      margin-bottom: 5px;
    }
    .signature-card strong {
      color: #0f172a;
      font-size: 8.5pt;
      display: block;
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
 * 1. RELATÓRIO EXECUTIVO COMPLETO EM PDF
 * Exporta generateExecutiveReportPDF(options)
 * Permite múltiplos filtros (datas, cliente, status, meio) e seções configuráveis.
 */
export function generateExecutiveReportPDF(options = {}) {
  const now = new Date();
  const settings = state.getSettings();
  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();
  const cashFlows = state.getCashFlows ? state.getCashFlows() : (state.data.cashFlows || []);
  const todayStr = formatDateForInput(now);

  const startDate = options.startDate || null;
  const endDate = options.endDate || null;
  const clientId = options.clientId || 'all';
  const statusFilter = options.status || 'all';
  const methodFilter = options.method || 'all';

  const includeKPIs = options.includeKPIs !== false;
  const includeLoans = options.includeLoans !== false;
  const includePayments = options.includePayments !== false;
  const includeOverdue = options.includeOverdue !== false;
  const includeUpcoming = options.includeUpcoming !== false;
  const includeCashFlow = options.includeCashFlow !== false;
  const includeSignatures = options.includeSignatures !== false;

  const targetClient = clientId !== 'all' ? clients.find(c => c.id === clientId) : null;

  let periodTitle = options.periodTitle || '';
  if (!periodTitle) {
    if (startDate && endDate) {
      if (startDate === endDate) {
        periodTitle = `Data: ${formatDate(startDate)}`;
      } else {
        periodTitle = `Período: ${formatDate(startDate)} até ${formatDate(endDate)}`;
      }
    } else if (startDate) {
      periodTitle = `A partir de: ${formatDate(startDate)}`;
    } else if (endDate) {
      periodTitle = `Até: ${formatDate(endDate)}`;
    } else {
      periodTitle = 'Histórico Geral Consolidado';
    }
  }

  // 1. Filtrar Novos Empréstimos (Concessões de Crédito / Saídas)
  const filteredLoans = [];
  loans.forEach(loan => {
    if (clientId !== 'all' && loan.clientId !== clientId) return;
    const loanDate = String(loan.startDate || loan.createdAt || '').split('T')[0];
    if (startDate && loanDate < startDate) return;
    if (endDate && loanDate > endDate) return;
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid' && loan.status !== 'paid') return;
      if (statusFilter === 'active' && loan.status !== 'active') return;
    }
    if (methodFilter !== 'all') {
      const m = String(loan.disbursementMethod || '').toUpperCase();
      if (!m.includes(methodFilter.toUpperCase())) return;
    }

    const client = clients.find(c => c.id === loan.clientId) || { name: 'Cliente', cpf: '', phone: '' };
    filteredLoans.push({
      ...loan,
      clientName: client.name,
      clientCpf: client.cpf,
      clientPhone: client.phone,
      formattedDate: formatDate(loanDate),
      rawDate: loanDate
    });
  });
  filteredLoans.sort((a, b) => (b.rawDate > a.rawDate ? 1 : -1));

  // 2. Filtrar Pagamentos Recebidos (Entradas de Parcelas e Juros)
  const filteredPayments = [];
  installments.forEach(inst => {
    if (clientId !== 'all' && inst.clientId !== clientId) return;
    const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente', phone: '' };
    const loan = loans.find(l => l.id === inst.loanId) || { installmentsCount: 1 };

    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        const payDate = String(rec.date || inst.paidDate || '').split('T')[0];
        if (startDate && payDate < startDate) return;
        if (endDate && payDate > endDate) return;
        if (methodFilter !== 'all') {
          const m = String(rec.method || inst.paidMethod || '').toUpperCase();
          if (!m.includes(methodFilter.toUpperCase())) return;
        }

        const amt = Number(rec.amount || 0);
        const amort = Number(inst.amortizationAmount || 0);
        const interest = Math.max(0, amt - amort);
        const late = Number(rec.lateChargesPaid || 0);
        const desc = Number(rec.discount || 0);

        filteredPayments.push({
          date: payDate,
          formattedDate: formatDate(payDate),
          clientName: client.name,
          clientPhone: client.phone,
          installmentNumber: inst.number,
          totalInstallments: loan.installmentsCount || 1,
          method: rec.method || inst.paidMethod || 'PIX',
          principal: amort,
          interest: interest,
          lateCharges: late,
          discount: desc,
          total: amt,
          loanId: inst.loanId,
          operatorName: rec.operatorName || ''
        });
      });
    } else if (inst.status === 'paid' && inst.paidDate) {
      const payDate = String(inst.paidDate).split('T')[0];
      if (startDate && payDate < startDate) return;
      if (endDate && payDate > endDate) return;
      if (methodFilter !== 'all') {
        const m = String(inst.paidMethod || '').toUpperCase();
        if (!m.includes(methodFilter.toUpperCase())) return;
      }

      const amt = Number(inst.paidAmount || inst.installmentAmount || 0);
      const amort = Number(inst.amortizationAmount || amt);
      const interest = Math.max(0, amt - amort);

      filteredPayments.push({
        date: payDate,
        formattedDate: formatDate(payDate),
        clientName: client.name,
        clientPhone: client.phone,
        installmentNumber: inst.number,
        totalInstallments: loan.installmentsCount || 1,
        method: inst.paidMethod || 'PIX',
        principal: amort,
        interest: interest,
        lateCharges: 0,
        discount: 0,
        total: amt,
        loanId: inst.loanId,
        operatorName: ''
      });
    }
  });
  filteredPayments.sort((a, b) => (b.date > a.date ? 1 : -1));

  // 3. Filtrar Inadimplência / Parcelas em Atraso
  const filteredOverdue = [];
  installments.forEach(inst => {
    if (inst.status === 'paid' || inst.status === 'renegotiated') return;
    if (clientId !== 'all' && inst.clientId !== clientId) return;

    const dueNorm = String(inst.dueDate || '').split('T')[0];
    const isOverdue = dueNorm < todayStr;
    if (!isOverdue) return;

    if (startDate && dueNorm < startDate) return;
    if (endDate && dueNorm > endDate) return;

    const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente', phone: '' };
    const loan = loans.find(l => l.id === inst.loanId) || { installmentsCount: 1, penaltyRate: 2, dailyInterestRate: 0.1 };
    const score = state.getClientScore(client.id);

    const pendingVal = Number(inst.installmentAmount || 0) - Number(inst.paidAmount || 0);
    let totalUpdated = pendingVal;
    let daysLate = Math.max(1, getDaysDiff(dueNorm, todayStr));
    let penaltyVal = 0;
    let dailyVal = 0;

    try {
      const charges = calculateLateCharges(
        inst,
        now,
        loan.penaltyRate || settings.defaultPenaltyRate || 2,
        loan.dailyInterestRate || settings.defaultDailyRate || 0.1
      );
      totalUpdated = charges.totalUpdatedAmount;
      daysLate = charges.daysOverdue;
      penaltyVal = charges.penaltyAmount;
      dailyVal = charges.dailyInterestAmount;
    } catch (e) {
      totalUpdated = pendingVal;
    }

    filteredOverdue.push({
      clientName: client.name,
      clientPhone: client.phone,
      clientScore: score.grade,
      loanId: inst.loanId,
      installmentNumber: inst.number,
      totalInstallments: loan.installmentsCount || 1,
      dueDate: dueNorm,
      formattedDueDate: formatDate(dueNorm),
      originalAmount: pendingVal,
      penalty: penaltyVal,
      dailyInterest: dailyVal,
      totalUpdated: totalUpdated,
      daysLate: daysLate,
      promisedDate: inst.promisedDate ? formatDate(inst.promisedDate) : null,
      notes: inst.promiseNote || inst.notes || ''
    });
  });
  filteredOverdue.sort((a, b) => b.daysLate - a.daysLate);

  // 4. Filtrar Parcelas a Vencer (Previsão Futura)
  const filteredUpcoming = [];
  installments.forEach(inst => {
    if (inst.status === 'paid' || inst.status === 'renegotiated') return;
    if (clientId !== 'all' && inst.clientId !== clientId) return;

    const dueNorm = String(inst.dueDate || '').split('T')[0];
    const isUpcoming = dueNorm >= todayStr;
    if (!isUpcoming) return;

    if (startDate && dueNorm < startDate) return;
    if (endDate && dueNorm > endDate) return;

    const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente', phone: '' };
    const loan = loans.find(l => l.id === inst.loanId) || { installmentsCount: 1 };
    const pendingVal = Number(inst.installmentAmount || 0) - Number(inst.paidAmount || 0);
    const amort = Number(inst.amortizationAmount || pendingVal);
    const interest = Number(inst.interestAmount || 0);
    const daysUntil = Math.max(0, getDaysDiff(todayStr, dueNorm));

    filteredUpcoming.push({
      clientName: client.name,
      clientPhone: client.phone,
      loanId: inst.loanId,
      installmentNumber: inst.number,
      totalInstallments: loan.installmentsCount || 1,
      dueDate: dueNorm,
      formattedDueDate: formatDate(dueNorm),
      principal: amort,
      interest: interest,
      total: pendingVal,
      daysUntil: daysUntil
    });
  });
  filteredUpcoming.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

  // 5. Filtrar Movimentações Manuais de Caixa
  const filteredCash = [];
  cashFlows.forEach(cf => {
    const cfDate = String(cf.date || cf.createdAt || '').split('T')[0];
    if (startDate && cfDate < startDate) return;
    if (endDate && cfDate > endDate) return;
    filteredCash.push({
      ...cf,
      formattedDate: formatDate(cfDate)
    });
  });
  filteredCash.sort((a, b) => (b.date > a.date ? 1 : -1));

  // Totais
  const totalLoansDisbursed = filteredLoans.reduce((acc, l) => acc + Number(l.principal || 0), 0);
  const totalLoansContracted = filteredLoans.reduce((acc, l) => acc + Number(l.totalPayable || 0), 0);

  const totalPaymentsReceived = filteredPayments.reduce((acc, p) => acc + p.total, 0);
  const totalPrincipalAmortized = filteredPayments.reduce((acc, p) => acc + p.principal, 0);
  const totalInterestProfit = filteredPayments.reduce((acc, p) => acc + (p.interest + p.lateCharges), 0);

  const totalOverdueBalance = filteredOverdue.reduce((acc, o) => acc + o.totalUpdated, 0);
  const totalOverdueOriginal = filteredOverdue.reduce((acc, o) => acc + o.originalAmount, 0);

  const totalUpcomingBalance = filteredUpcoming.reduce((acc, u) => acc + u.total, 0);

  const totalCashIn = filteredCash.filter(c => c.type === 'inflow').reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const totalCashOut = filteredCash.filter(c => c.type === 'outflow').reduce((acc, c) => acc + Number(c.amount || 0), 0);

  const grandTotalIn = totalPaymentsReceived + totalCashIn;
  const grandTotalOut = totalLoansDisbursed + totalCashOut;
  const netOperatingResult = grandTotalIn - grandTotalOut;

  const totalActiveInsts = filteredPayments.length + filteredOverdue.length;
  const inadimplenciaRate = totalActiveInsts > 0 ? ((filteredOverdue.length / totalActiveInsts) * 100).toFixed(1) : '0.0';

  const generationTimestamp = now.toLocaleString('pt-BR');
  const reportCode = `VM-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`;
  const origin = window.location.origin || '';
  const logoUrl = `${origin}/logo-vandomotos.png`;

  let statusLabel = 'Todas as Situações';
  if (statusFilter === 'paid') statusLabel = 'Somente Pagas / Baixadas';
  else if (statusFilter === 'overdue') statusLabel = 'Somente em Atraso (Cobrança)';
  else if (statusFilter === 'pending') statusLabel = 'Somente a Vencer / No Prazo';

  let methodLabel = methodFilter === 'all' ? 'Todos os Meios' : methodFilter;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Financeiro Oficial — ${escapeHtml(settings.businessName || 'Vando Motos')}</title>
      <style>${getPrintStyles()}</style>
    </head>
    <body>
      <div class="report-wrap">

        <!-- CABEÇALHO CORPORATIVO -->
        <header class="report-header">
          <div class="header-brand">
            <img src="${logoUrl}" class="header-logo" alt="Vando Motos" onerror="this.style.display='none'; document.getElementById('logo-fallback-exec').style.display='block';">
            <div id="logo-fallback-exec" style="display:none; font-weight: 800; font-size: 16pt; color: #0f172a; border: 2px solid #ca8a04; padding: 4px 10px; border-radius: 4px; background: #fefce8;">VM</div>
            <div class="header-text">
              <h1>${escapeHtml(settings.businessName || 'VANDO MOTOS LOCADORA LTDA')}</h1>
              <p>CNPJ: <strong>${escapeHtml(settings.creditorCpfCnpj || '28.623.431-0001-23')}</strong> • ${escapeHtml(settings.creditorCity || 'PORTO VELHO - RO')}</p>
            </div>
          </div>
          <div class="header-meta">
            <div><strong>DEMONSTRATIVO FINANCEIRO OFICIAL</strong></div>
            <div>Código: <code>${reportCode}</code></div>
            <div>Emitido em: <strong>${generationTimestamp}</strong></div>
          </div>
        </header>

        <!-- BANNER DE TÍTULO & ESCOPO -->
        <div class="title-banner">
          <div>
            <h2>RELATÓRIO FINANCEIRO CONSOLIDADO & GESTÃO DE CARTEIRA</h2>
            <div class="period-tag">${escapeHtml(periodTitle)}</div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 7.5pt; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 4px;">AUDITADO</span>
          </div>
        </div>

        <!-- TAGS DE FILTROS APLICADOS -->
        <div class="filter-pills-row">
          <div class="filter-pill">Período: <strong>${escapeHtml(periodTitle)}</strong></div>
          <div class="filter-pill">Cliente: <strong>${targetClient ? escapeHtml(targetClient.name) : 'Todos os Clientes'}</strong></div>
          <div class="filter-pill">Situação: <strong>${escapeHtml(statusLabel)}</strong></div>
          <div class="filter-pill">Meio de Pagamento: <strong>${escapeHtml(methodLabel)}</strong></div>
        </div>

        <!-- RESUMO EXECUTIVO (KPIS) -->
        ${includeKPIs ? `
        <div class="stats-grid-6 avoid-break">
          <div class="stat-card">
            <div class="stat-label">Total Recebido (Entradas)</div>
            <div class="stat-val val-green">${formatBRL(grandTotalIn)}</div>
            <div class="stat-sub">${filteredPayments.length} parcela(s) quitada(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Capital Emprestado (Saídas)</div>
            <div class="stat-val" style="color: #ca8a04;">${formatBRL(grandTotalOut)}</div>
            <div class="stat-sub">${filteredLoans.length} contrato(s) concedido(s)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Lucro / Juros Realizados</div>
            <div class="stat-val val-green">${formatBRL(totalInterestProfit)}</div>
            <div class="stat-sub">Juros e encargos pagos</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Inadimplência em Aberto</div>
            <div class="stat-val val-red">${formatBRL(totalOverdueBalance)}</div>
            <div class="stat-sub">${filteredOverdue.length} parcela(s) em atraso (${inadimplenciaRate}%)</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Carteira a Vencer (Fluxo)</div>
            <div class="stat-val val-blue">${formatBRL(totalUpcomingBalance)}</div>
            <div class="stat-sub">${filteredUpcoming.length} parcela(s) no prazo</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Resultado Operacional</div>
            <div class="stat-val ${netOperatingResult >= 0 ? 'val-green' : 'val-red'}">${formatBRL(netOperatingResult)}</div>
            <div class="stat-sub">${netOperatingResult >= 0 ? 'Superávit líquido no período' : 'Defasagem operacional'}</div>
          </div>
        </div>
        ` : ''}

        <!-- SEÇÃO 1: NOVOS EMPRÉSTIMOS CONCEDIDOS (SAÍDAS DE CAPITAL) -->
        ${includeLoans ? `
        <div class="section-block avoid-break" style="margin-top: 14px;">
          <div class="section-title">
            <span>1. Novos Empréstimos & Contratos Concedidos (Saídas de Capital)</span>
            <span class="section-count">${filteredLoans.length} contrato(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 10%;">Data</th>
                <th style="width: 12%;">Contrato</th>
                <th style="width: 25%;">Cliente</th>
                <th style="width: 13%;">Telefone</th>
                <th style="width: 12%; text-align: right;">Principal Liberado</th>
                <th style="width: 10%; text-align: center;">Taxa / Parc.</th>
                <th style="width: 12%; text-align: right;">Total Contratado</th>
                <th style="width: 6%;">Meio</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLoans.length > 0 ? filteredLoans.map(l => {
                const shortId = l.id.substring(l.id.length - 8).toUpperCase();
                return `
                  <tr>
                    <td>${l.formattedDate}</td>
                    <td><strong>#${shortId}</strong></td>
                    <td>
                      <strong>${escapeHtml(l.clientName)}</strong>
                      ${l.clientCpf ? `<div style="font-size: 6.8pt; color: #64748b;">CPF: ${maskCPF(l.clientCpf)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(l.clientPhone || '-')}</td>
                    <td class="text-right" style="font-weight: 700; color: #0f172a;">${formatBRL(l.principal)}</td>
                    <td class="text-center">${l.interestRate}% (${l.installmentsCount}x)</td>
                    <td class="text-right" style="font-weight: 700; color: #047857;">${formatBRL(l.totalPayable)}</td>
                    <td>${escapeHtml(l.disbursementMethod || 'PIX')}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="empty-row">Nenhum novo empréstimo concedido no período selecionado.</td>
                </tr>
              `}
            </tbody>
            ${filteredLoans.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right">SUBTOTAL CONCEDIDO NO PERÍODO:</td>
                  <td class="text-right">${formatBRL(totalLoansDisbursed)}</td>
                  <td></td>
                  <td class="text-right">${formatBRL(totalLoansContracted)}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- SEÇÃO 2: RECEBIMENTOS E BAIXAS DE PARCELAS (ENTRADAS DE CAPITAL E JUROS) -->
        ${includePayments ? `
        <div class="section-block avoid-break" style="margin-top: 14px;">
          <div class="section-title">
            <span>2. Recebimentos, Baixas de Parcelas & Juros Lucrados (Entradas)</span>
            <span class="section-count">${filteredPayments.length} baixa(s) efetuada(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 10%;">Data</th>
                <th style="width: 25%;">Cliente</th>
                <th style="width: 13%;">Contrato / Parc.</th>
                <th style="width: 10%;">Forma</th>
                <th style="width: 12%; text-align: right;">Principal Amortizado</th>
                <th style="width: 12%; text-align: right;">Juros / Multas Lucrados</th>
                <th style="width: 12%; text-align: right;">Total Recebido</th>
                <th style="width: 6%;">Op.</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.length > 0 ? filteredPayments.map(p => {
                const shortId = p.loanId ? p.loanId.substring(p.loanId.length - 8).toUpperCase() : '-';
                const totalInterest = p.interest + p.lateCharges;
                return `
                  <tr>
                    <td>${p.formattedDate}</td>
                    <td>
                      <strong>${escapeHtml(p.clientName)}</strong>
                      ${p.clientPhone ? `<span style="font-size: 6.8pt; color: #64748b; margin-left: 4px;">(${escapeHtml(p.clientPhone)})</span>` : ''}
                    </td>
                    <td>#${shortId} (${p.installmentNumber}/${p.totalInstallments})</td>
                    <td>${escapeHtml(p.method)}</td>
                    <td class="text-right">${formatBRL(p.principal)}</td>
                    <td class="text-right" style="color: #b45309; font-weight: 600;">+${formatBRL(totalInterest)}</td>
                    <td class="text-right" style="font-weight: 800; color: #047857;">${formatBRL(p.total)}</td>
                    <td>${escapeHtml(p.operatorName ? p.operatorName.substring(0, 8) : 'Admin')}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="empty-row">Nenhum pagamento registrado no período selecionado.</td>
                </tr>
              `}
            </tbody>
            ${filteredPayments.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right">SUBTOTAL RECEBIDO NO PERÍODO:</td>
                  <td class="text-right">${formatBRL(totalPrincipalAmortized)}</td>
                  <td class="text-right" style="color: #b45309;">${formatBRL(totalInterestProfit)}</td>
                  <td class="text-right" style="color: #047857;">${formatBRL(totalPaymentsReceived)}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- SEÇÃO 3: PARCELAS EM ATRASO & INADIMPLÊNCIA -->
        ${includeOverdue ? `
        <div class="section-block avoid-break" style="margin-top: 14px;">
          <div class="section-title">
            <span>3. Dossiê de Inadimplência & Parcelas em Atraso (Cobrança Ativa)</span>
            <span class="section-count" style="color: #b91c1c;">${filteredOverdue.length} inadimplência(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 25%;">Cliente</th>
                <th style="width: 12%;">Telefone</th>
                <th style="width: 12%;">Contrato / Parc.</th>
                <th style="width: 10%;">Vencimento</th>
                <th style="width: 9%; text-align: center;">Dias Atraso</th>
                <th style="width: 10%; text-align: right;">Valor Original</th>
                <th style="width: 10%; text-align: right;">Encargos / Mora</th>
                <th style="width: 12%; text-align: right;">Saldo Atualizado</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOverdue.length > 0 ? filteredOverdue.map(o => {
                const shortId = o.loanId ? o.loanId.substring(o.loanId.length - 8).toUpperCase() : '-';
                const totalEncargos = o.penalty + o.dailyInterest;
                return `
                  <tr>
                    <td>
                      <strong>${escapeHtml(o.clientName)}</strong>
                      <span class="score-tag score-tag-${o.clientScore ? o.clientScore.toLowerCase() : 'b'}">Score ${o.clientScore || 'B'}</span>
                    </td>
                    <td>${escapeHtml(o.clientPhone || '-')}</td>
                    <td>#${shortId} (${o.installmentNumber}/${o.totalInstallments})</td>
                    <td>${o.formattedDueDate}</td>
                    <td class="text-center"><span class="badge badge-overdue">${o.daysLate}d</span></td>
                    <td class="text-right">${formatBRL(o.originalAmount)}</td>
                    <td class="text-right" style="color: #b45309;">+${formatBRL(totalEncargos)}</td>
                    <td class="text-right" style="font-weight: 800; color: #b91c1c;">${formatBRL(o.totalUpdated)}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="empty-row" style="color: #047857;">Nenhuma parcela em atraso registrada para este critério. Carteira 100% adimplente!</td>
                </tr>
              `}
            </tbody>
            ${filteredOverdue.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="5" class="text-right">TOTAL INADIMPLENTE ATUALIZADO:</td>
                  <td class="text-right">${formatBRL(totalOverdueOriginal)}</td>
                  <td class="text-right" style="color: #b45309;">+${formatBRL(filteredOverdue.reduce((acc, o) => acc + (o.penalty + o.dailyInterest), 0))}</td>
                  <td class="text-right" style="color: #b91c1c;">${formatBRL(totalOverdueBalance)}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- SEÇÃO 4: PREVISÃO DE RECEBÍVEIS (A VENCER) -->
        ${includeUpcoming ? `
        <div class="section-block avoid-break" style="margin-top: 14px;">
          <div class="section-title">
            <span>4. Previsão de Recebíveis & Parcelas a Vencer (Fluxo Futuro)</span>
            <span class="section-count">${filteredUpcoming.length} parcela(s) no prazo</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 10%;">Vencimento</th>
                <th style="width: 25%;">Cliente</th>
                <th style="width: 13%;">Telefone</th>
                <th style="width: 14%;">Contrato / Parc.</th>
                <th style="width: 12%; text-align: right;">Principal</th>
                <th style="width: 12%; text-align: right;">Juros Projetados</th>
                <th style="width: 14%; text-align: right;">Valor da Parcela</th>
              </tr>
            </thead>
            <tbody>
              ${filteredUpcoming.length > 0 ? filteredUpcoming.map(u => {
                const shortId = u.loanId ? u.loanId.substring(u.loanId.length - 8).toUpperCase() : '-';
                return `
                  <tr>
                    <td>${u.formattedDueDate}</td>
                    <td><strong>${escapeHtml(u.clientName)}</strong></td>
                    <td>${escapeHtml(u.clientPhone || '-')}</td>
                    <td>#${shortId} (${u.installmentNumber}/${u.totalInstallments})</td>
                    <td class="text-right">${formatBRL(u.principal)}</td>
                    <td class="text-right" style="color: #b45309;">${formatBRL(u.interest)}</td>
                    <td class="text-right" style="font-weight: 700; color: #1d4ed8;">${formatBRL(u.total)}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" class="empty-row">Nenhuma parcela futura a vencer no período selecionado.</td>
                </tr>
              `}
            </tbody>
            ${filteredUpcoming.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="6" class="text-right">TOTAL PREVISTO A RECEBER:</td>
                  <td class="text-right" style="color: #1d4ed8;">${formatBRL(totalUpcomingBalance)}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- SEÇÃO 5: MOVIMENTAÇÕES DE CAIXA & DESPESAS (SE HOUVER) -->
        ${includeCashFlow && filteredCash.length > 0 ? `
        <div class="section-block avoid-break" style="margin-top: 14px;">
          <div class="section-title">
            <span>5. Movimentações de Caixa & Despesas Operacionais</span>
            <span class="section-count">${filteredCash.length} lançamento(s)</span>
          </div>
          <table class="table-report">
            <thead>
              <tr>
                <th style="width: 12%;">Data</th>
                <th style="width: 38%;">Descrição / Categoria</th>
                <th style="width: 12%; text-align: center;">Tipo</th>
                <th style="width: 14%;">Meio</th>
                <th style="width: 14%; text-align: right;">Valor</th>
                <th style="width: 10%;">Operador</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCash.map(c => `
                <tr>
                  <td>${c.formattedDate}</td>
                  <td><strong>${escapeHtml(c.category || c.description || 'Lançamento')}</strong></td>
                  <td class="text-center">
                    <span class="badge ${c.type === 'inflow' ? 'badge-paid' : 'badge-overdue'}">
                      ${c.type === 'inflow' ? 'Entrada (+)' : 'Saída (-)'}
                    </span>
                  </td>
                  <td>${escapeHtml(c.method || 'Dinheiro')}</td>
                  <td class="text-right" style="font-weight: 700; color: ${c.type === 'inflow' ? '#047857' : '#b91c1c'};">
                    ${c.type === 'inflow' ? '+' : '-'}${formatBRL(c.amount)}
                  </td>
                  <td>${escapeHtml(c.operatorName ? c.operatorName.substring(0, 8) : 'Admin')}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right">TOTAIS DE CAIXA: Entradas: ${formatBRL(totalCashIn)} | Saídas: ${formatBRL(totalCashOut)} | SALDO LÍQUIDO:</td>
                <td class="text-right" style="color: ${totalCashIn >= totalCashOut ? '#047857' : '#b91c1c'};">
                  ${formatBRL(totalCashIn - totalCashOut)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        <!-- DECLARAÇÃO DE CONFORMIDADE FINANCEIRA & ASSINATURA -->
        ${includeSignatures ? `
        <div class="compliance-box avoid-break">
          <strong>Declaração de Conformidade e Autenticidade Contábil</strong><br>
          Certifico para os devidos fins legais e gerenciais que o presente Demonstrativo Financeiro foi consolidado eletronicamente a partir dos registros de operações de crédito, recebimentos, baixas e contratos da <strong>${escapeHtml(settings.businessName || 'Vando motos locadora LTDA')}</strong>. As métricas e saldos apresentados espelham fielmente a situação contábil da carteira no período auditado.
        </div>

        <div class="signatures-grid avoid-break">
          <div class="signature-card">
            <div class="signature-card-line"></div>
            <strong>${escapeHtml(settings.businessName || 'VANDO MOTOS LOCADORA LTDA')}</strong>
            <div>Responsável Financeiro / Administrador</div>
            <div>CNPJ: ${escapeHtml(settings.creditorCpfCnpj || '28.623.431-0001-23')}</div>
          </div>
          <div class="signature-card">
            <div class="signature-card-line"></div>
            <strong>CONFERÊNCIA INTERNA & AUDITORIA</strong>
            <div>Controle de Crédito e Cobrança</div>
            <div>Praça: ${escapeHtml(settings.creditorCity || 'PORTO VELHO - RO')}</div>
          </div>
        </div>
        ` : ''}

        <!-- RODAPÉ INSTITUCIONAL -->
        <footer class="report-footer avoid-break">
          <div class="footer-stamp">${escapeHtml(settings.businessName || 'Vando motos locadora LTDA')} • CNPJ: ${escapeHtml(settings.creditorCpfCnpj || '28.623.431-0001-23')} • Praça: ${escapeHtml(settings.creditorCity || 'Porto Velho - RO')}</div>
          <div>Autenticação: <code>${reportCode}</code> • Emitido em ${generationTimestamp}</div>
        </footer>

      </div>
    </body>
    </html>
  `;

  showToast(`Gerando Relatório Executivo em PDF...`, 'info');
  printIframe(html);
}

/**
 * 2. COMPATIBILIDADE: RELATÓRIO MENSAL EM PDF
 * Exporta generateMonthlyReportPDF(month, year) direcionando para o motor executivo completo
 */
export function generateMonthlyReportPDF(month, year) {
  const now = new Date();
  const targetYear = parseInt(year, 10) || now.getFullYear();
  let targetMonth = parseInt(month, 10);
  if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    targetMonth = now.getMonth() + 1;
  }
  const lastDayDate = new Date(targetYear, targetMonth, 0);
  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
  const monthName = MESES[targetMonth - 1] || `Mês ${targetMonth}`;

  return generateExecutiveReportPDF({
    startDate,
    endDate,
    periodTitle: `Relatório Mensal — ${monthName}/${targetYear}`
  });
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
 * 3. MODAL AVANÇADO DE CONFIGURAÇÃO DO RELATÓRIO EXECUTIVO EM PDF
 * Cria e exibe um modal completo com múltiplos filtros (período, datas, cliente, status, meio)
 * e seleção de quais seções incluir no documento final.
 */
export function openAdvancedReportPdfModal(presetFilters = {}) {
  let modal = document.getElementById('modal-advanced-pdf-picker');
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = formatDateForInput(now);
  const firstDayStr = formatDateForInput(firstDay);

  const initStart = presetFilters.startDate || firstDayStr;
  const initEnd = presetFilters.endDate || todayStr;
  const initClient = presetFilters.clientId || 'all';
  const initStatus = presetFilters.status || 'all';
  const initMethod = presetFilters.method || 'all';
  const clients = state.getClients();

  if (modal) {
    modal.remove();
  }

  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-advanced-pdf-picker';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 620px; max-height: 94vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-soft); padding: 16px 20px;">
        <div>
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            ${icon('fileText', 18)} Emissão de Relatório Executivo em PDF
          </h3>
          <p class="modal-subtitle">Configure o período, filtros e seções detalhadas do documento oficial</p>
        </div>
        <button class="modal-close-btn" id="btn-close-adv-pdf-modal">${icon('x', 16)}</button>
      </div>

      <div class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Atalhos rápidos de período -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Atalhos Rápidos de Período</label>
          <div class="filter-periods-wrap" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="today">Hoje</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="yesterday">Ontem</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="7d">7 dias</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="15d">15 dias</button>
            <button type="button" class="btn btn-primary btn-sm adv-pdf-chip active" data-period="month">Este Mês</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="lastMonth">Mês Passado</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="year">Ano Atual</button>
            <button type="button" class="btn btn-secondary btn-sm adv-pdf-chip" data-period="all">Todo o Histórico</button>
          </div>
        </div>

        <!-- Intervalo de Datas -->
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Data Inicial</label>
            <input type="date" class="form-control" id="adv-pdf-start" value="${initStart}">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Data Final</label>
            <input type="date" class="form-control" id="adv-pdf-end" value="${initEnd}">
          </div>
        </div>

        <!-- Filtros de Cliente, Status e Meio -->
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cliente</label>
            <select class="form-control" id="adv-pdf-client">
              <option value="all">Todos os Clientes (${clients.length})</option>
              ${clients.map(c => `
                <option value="${c.id}" ${c.id === initClient ? 'selected' : ''}>${escapeHtml(c.name)}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Situação / Status</label>
            <select class="form-control" id="adv-pdf-status">
              <option value="all" ${initStatus === 'all' ? 'selected' : ''}>Todas as Situações</option>
              <option value="paid" ${initStatus === 'paid' ? 'selected' : ''}>Somente Pagos / Baixados</option>
              <option value="overdue" ${initStatus === 'overdue' ? 'selected' : ''}>Somente em Atraso (Cobrança)</option>
              <option value="pending" ${initStatus === 'pending' ? 'selected' : ''}>Somente a Vencer / No Prazo</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Meio de Pagamento</label>
            <select class="form-control" id="adv-pdf-method">
              <option value="all" ${initMethod === 'all' ? 'selected' : ''}>Todos os Meios</option>
              <option value="PIX" ${initMethod === 'PIX' ? 'selected' : ''}>PIX</option>
              <option value="Dinheiro" ${initMethod === 'Dinheiro' ? 'selected' : ''}>Dinheiro / Espécie</option>
              <option value="Transferência" ${initMethod === 'Transferência' ? 'selected' : ''}>Transferência / TED</option>
            </select>
          </div>
        </div>

        <!-- Seções a Incluir -->
        <div style="background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 12px 14px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: #fff; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            ${icon('checkCircle', 14)} Seções a Incluir no Documento PDF
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 0.82rem;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-kpis" checked style="accent-color: var(--yellow);">
              <span>Resumo Executivo & KPIs</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-loans" checked style="accent-color: var(--yellow);">
              <span>Novos Contratos Concedidos (Saídas)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-payments" checked style="accent-color: var(--yellow);">
              <span>Recebimentos & Lucro em Juros (Entradas)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-overdue" checked style="accent-color: var(--yellow);">
              <span>Inadimplência & Cobrança (Atrasos)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-upcoming" checked style="accent-color: var(--yellow);">
              <span>Carteira a Vencer (Fluxo Futuro)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="chk-pdf-cash" checked style="accent-color: var(--yellow);">
              <span>Movimentações de Caixa & Despesas</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; grid-column: span 2;">
              <input type="checkbox" id="chk-pdf-signatures" checked style="accent-color: var(--yellow);">
              <span>Declaração de Conformidade & Assinaturas</span>
            </label>
          </div>
        </div>

      </div>

      <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--border-soft); display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-adv-pdf">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-generate-adv-pdf" style="font-weight: 700;">
          ${icon('print', 15)} Gerar & Imprimir Relatório PDF
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#btn-close-adv-pdf-modal');
  const cancelBtn = modal.querySelector('#btn-cancel-adv-pdf');
  const generateBtn = modal.querySelector('#btn-generate-adv-pdf');
  const startInput = modal.querySelector('#adv-pdf-start');
  const endInput = modal.querySelector('#adv-pdf-end');
  const clientSelect = modal.querySelector('#adv-pdf-client');
  const statusSelect = modal.querySelector('#adv-pdf-status');
  const methodSelect = modal.querySelector('#adv-pdf-method');

  function closeModal() {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 250);
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Chips de atalho de período
  modal.querySelectorAll('.adv-pdf-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.adv-pdf-chip').forEach(b => {
        b.className = 'btn btn-secondary btn-sm adv-pdf-chip';
      });
      btn.className = 'btn btn-primary btn-sm adv-pdf-chip active';
      const p = btn.dataset.period;
      const curr = new Date();

      if (p === 'today') {
        startInput.value = todayStr;
        endInput.value = todayStr;
      } else if (p === 'yesterday') {
        const y = new Date(curr);
        y.setDate(y.getDate() - 1);
        startInput.value = formatDateForInput(y);
        endInput.value = formatDateForInput(y);
      } else if (p === '7d') {
        const d7 = new Date(curr);
        d7.setDate(d7.getDate() - 7);
        startInput.value = formatDateForInput(d7);
        endInput.value = todayStr;
      } else if (p === '15d') {
        const d15 = new Date(curr);
        d15.setDate(d15.getDate() - 15);
        startInput.value = formatDateForInput(d15);
        endInput.value = todayStr;
      } else if (p === 'month') {
        const f = new Date(curr.getFullYear(), curr.getMonth(), 1);
        startInput.value = formatDateForInput(f);
        endInput.value = todayStr;
      } else if (p === 'lastMonth') {
        const f = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
        const l = new Date(curr.getFullYear(), curr.getMonth(), 0);
        startInput.value = formatDateForInput(f);
        endInput.value = formatDateForInput(l);
      } else if (p === 'year') {
        startInput.value = `${curr.getFullYear()}-01-01`;
        endInput.value = todayStr;
      } else if (p === 'all') {
        startInput.value = '';
        endInput.value = '';
      }
    });
  });

  // Ação de Gerar PDF
  generateBtn.addEventListener('click', () => {
    const sDate = startInput.value || null;
    const eDate = endInput.value || null;

    closeModal();

    generateExecutiveReportPDF({
      startDate: sDate,
      endDate: eDate,
      clientId: clientSelect.value,
      status: statusSelect.value,
      method: methodSelect.value,
      includeKPIs: modal.querySelector('#chk-pdf-kpis').checked,
      includeLoans: modal.querySelector('#chk-pdf-loans').checked,
      includePayments: modal.querySelector('#chk-pdf-payments').checked,
      includeOverdue: modal.querySelector('#chk-pdf-overdue').checked,
      includeUpcoming: modal.querySelector('#chk-pdf-upcoming').checked,
      includeCashFlow: modal.querySelector('#chk-pdf-cash').checked,
      includeSignatures: modal.querySelector('#chk-pdf-signatures').checked
    });
  });

  modal.classList.add('active');
}

/**
 * 4. ALIAS DE COMPATIBILIDADE PARA O MODAL DE RELATÓRIO MENSAL
 */
export function openMonthlyReportModal(presetFilters = {}) {
  return openAdvancedReportPdfModal(presetFilters);
}
