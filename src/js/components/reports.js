// src/js/components/reports.js
// Relatórios Financeiros com Gráficos em HTML5 Canvas (Sem Dependências Externas)
// Gráfico 1: Barra - Receita mensal (últimos 6 meses)
// Gráfico 2: Donut - Status das parcelas (Pagas vs Pendentes vs Atrasadas)
// Gráfico 3: Linha - Capital na rua ao longo do tempo

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput } from '../utils.js';
import { openMonthlyReportModal } from './pdfExport.js';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cores do Design System da Vando Motos
const THEME = {
  yellow: '#f5c518',
  yellowLight: '#fde047',
  yellowDark: '#ca8a04',
  yellowGlow: 'rgba(245, 197, 24, 0.35)',
  green: '#10b981',
  greenLight: '#34d399',
  greenGlow: 'rgba(16, 185, 129, 0.25)',
  red: '#f43f5e',
  redLight: '#fb7185',
  redGlow: 'rgba(244, 63, 94, 0.25)',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  bg0: '#020304',
  bg1: '#080a0f',
  bg2: '#0f1117',
  bg3: '#181a22',
  text100: '#ffffff',
  text200: '#e2e8f0',
  text300: '#94a3b8',
  text400: '#64748b',
  borderSoft: 'rgba(255, 255, 255, 0.07)',
  borderMid: 'rgba(245, 197, 24, 0.16)'
};

/**
 * Renderiza a página completa de Relatórios
 */
export function renderReports() {
  const container = document.createElement('div');
  container.className = 'reports-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();
  const todayStr = formatDateForInput(new Date());

  // 1. Cálculos de Indicadores Globais para os Cards de Topo
  let totalRecebidoHistorico = 0;
  let capitalNaRua = 0;
  let lucroTotalContratado = 0;

  loans.forEach(l => {
    lucroTotalContratado += Number(l.totalInterest || 0);
  });

  let countPaid = 0;
  let countPending = 0;
  let countOverdue = 0;
  let totalOverdueAmount = 0;
  let totalPendingAmount = 0;

  installments.forEach(inst => {
    // Total recebido em histórico
    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        totalRecebidoHistorico += Number(rec.amount || 0);
      });
    } else if (inst.status === 'paid') {
      totalRecebidoHistorico += Number(inst.paidAmount || inst.installmentAmount || 0);
    }

    // Status das parcelas
    if (inst.status === 'paid') {
      countPaid++;
    } else if (inst.status === 'renegotiated') {
      // Ignora para contagem de cobrança ativa ou trata como histórico
    } else if (inst.dueDate < todayStr) {
      countOverdue++;
      totalOverdueAmount += Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
      capitalNaRua += Number(inst.amortizationAmount || inst.installmentAmount);
    } else {
      countPending++;
      totalPendingAmount += Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
      capitalNaRua += Number(inst.amortizationAmount || inst.installmentAmount);
    }
  });

  const totalAtivas = countPaid + countPending + countOverdue;
  const taxaInadimplencia = totalAtivas > 0 ? ((countOverdue / totalAtivas) * 100).toFixed(1) : '0.0';

  container.innerHTML = `
    <!-- Topo de Ações do Relatório -->
    <div class="reports-header-bar">
      <div>
        <h2 class="reports-page-title">Relatórios Financeiros</h2>
      </div>
      <div class="reports-actions">
        <button class="btn btn-secondary btn-sm" id="btn-export-csv" title="Exportar dados em formato CSV">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Exportar CSV
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-print-reports" title="Imprimir Visão Atual">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir
        </button>
        <button class="btn btn-primary btn-sm" id="btn-generate-pdf-report" title="Gerar Relatório Oficial Mensal em PDF">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          Relatório PDF
        </button>
      </div>
    </div>

    <!-- Grade de KPIs Resumidos -->
    <div class="kpi-grid" style="margin-bottom: 20px;">
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Receita Realizada</span>
          <div class="kpi-icon-wrap kpi-icon-emerald">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line></svg>
          </div>
        </div>
        <div class="kpi-value" style="color: var(--green);">${formatBRL(totalRecebidoHistorico)}</div>
        <div class="kpi-footer">
          <span>Total acumulado baixado em caixa</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Capital na Rua</span>
          <div class="kpi-icon-wrap kpi-icon-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
        <div class="kpi-value text-yellow">${formatBRL(capitalNaRua)}</div>
        <div class="kpi-footer">
          <span>Principal ainda não amortizado</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Inadimplência</span>
          <div class="kpi-icon-wrap kpi-icon-rose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
        </div>
        <div class="kpi-value" style="color: ${countOverdue > 0 ? 'var(--red)' : 'var(--green)'};">${taxaInadimplencia}%</div>
        <div class="kpi-footer">
          <span>${countOverdue} parcela(s) vencida(s) em aberto</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Contratos Ativos</span>
          <div class="kpi-icon-wrap kpi-icon-indigo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          </div>
        </div>
        <div class="kpi-value">${loans.filter(l => l.status === 'active').length}</div>
        <div class="kpi-footer">
          <span>De um total de ${loans.length} empréstimo(s)</span>
        </div>
      </div>
    </div>

    <!-- Grade Principal de Gráficos -->
    <div class="reports-charts-grid">
      
      <!-- CARD 1: GRÁFICO DE BARRAS - RECEITA MENSAL (ÚLTIMOS 6 MESES) -->
      <div class="card chart-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">📊 Receita Mensal Realizada</h3>
            <p class="card-subtitle">Soma das parcelas quitadas mês a mês (últimos 6 meses)</p>
          </div>
          <span class="chart-badge">Últimos 6 meses</span>
        </div>
        <div class="chart-canvas-wrapper" id="bar-chart-container">
          <canvas id="canvas-receita-mensal" class="responsive-canvas"></canvas>
          <div class="canvas-tooltip" id="tooltip-receita-mensal"></div>
        </div>
        <div class="chart-card-footer" id="bar-chart-summary">
          <!-- Preenchido via script -->
        </div>
      </div>

      <!-- CARD 2: GRÁFICO DE DONUT - STATUS DAS PARCELAS -->
      <div class="card chart-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">🍩 Distribuição das Parcelas</h3>
            <p class="card-subtitle">Proporção de parcelas pagas, pendentes e em atraso</p>
          </div>
          <span class="chart-badge">${totalAtivas} parcelas</span>
        </div>
        <div class="donut-card-layout" id="donut-chart-container">
          <div class="donut-canvas-box">
            <canvas id="canvas-status-parcelas" class="responsive-canvas"></canvas>
          </div>
          <div class="donut-chart-legend" id="donut-legend-container">
            <!-- Legenda com cores e valores -->
          </div>
        </div>
      </div>

      <!-- CARD 3: GRÁFICO DE LINHA - CAPITAL NA RUA AO LONGO DO TEMPO -->
      <div class="card chart-card chart-card--full-width">
        <div class="card-header">
          <div>
            <h3 class="card-title">📈 Evolução do Capital na Rua</h3>
            <p class="card-subtitle">Volume de capital financiado ativo no mercado ao longo do tempo</p>
          </div>
          <span class="chart-badge" style="color: var(--yellow);">Saldo em Aberto</span>
        </div>
        <div class="chart-canvas-wrapper" id="line-chart-container">
          <canvas id="canvas-capital-rua" class="responsive-canvas"></canvas>
          <div class="canvas-tooltip" id="tooltip-capital-rua"></div>
        </div>
        <div class="chart-card-footer" id="line-chart-summary">
          <!-- Preenchido via script -->
        </div>
      </div>

    </div>
  `;

  // Inicializa os gráficos após inserção no DOM
  setTimeout(() => {
    initCharts(container);
    attachReportActions(container);
  }, 50);

  return container;
}

/**
 * Inicializa os 3 gráficos Canvas e configura redimensionamento responsivo
 */
function initCharts(container) {
  const resizeObservers = [];

  // 1. Gráfico de Barras: Receita Mensal
  const barCanvas = container.querySelector('#canvas-receita-mensal');
  const barContainer = container.querySelector('#bar-chart-container');
  const barTooltip = container.querySelector('#tooltip-receita-mensal');
  const barSummary = container.querySelector('#bar-chart-summary');

  if (barCanvas && barContainer) {
    const drawBar = () => {
      renderBarChartReceita(barCanvas, barTooltip, barSummary);
    };
    drawBar();

    const roBar = new ResizeObserver(() => drawBar());
    roBar.observe(barContainer);
    resizeObservers.push(roBar);
  }

  // 2. Gráfico Donut: Status das Parcelas
  const donutCanvas = container.querySelector('#canvas-status-parcelas');
  const donutContainer = container.querySelector('#donut-chart-container');
  const donutLegend = container.querySelector('#donut-legend-container');

  if (donutCanvas && donutContainer) {
    const drawDonut = () => {
      renderDonutChartStatus(donutCanvas, donutLegend);
    };
    drawDonut();

    const roDonut = new ResizeObserver(() => drawDonut());
    roDonut.observe(donutContainer);
    resizeObservers.push(roDonut);
  }

  // 3. Gráfico de Linha: Capital na Rua
  const lineCanvas = container.querySelector('#canvas-capital-rua');
  const lineContainer = container.querySelector('#line-chart-container');
  const lineTooltip = container.querySelector('#tooltip-capital-rua');
  const lineSummary = container.querySelector('#line-chart-summary');

  if (lineCanvas && lineContainer) {
    const drawLine = () => {
      renderLineChartCapital(lineCanvas, lineTooltip, lineSummary);
    };
    drawLine();

    const roLine = new ResizeObserver(() => drawLine());
    roLine.observe(lineContainer);
    resizeObservers.push(roLine);
  }
}

/**
 * Configura DPI do canvas para nitidez em telas Retina / High-DPI
 */
function setupCanvasDPI(canvas, targetHeight = 240) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement.clientWidth || 300;
  const height = targetHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height, dpr };
}

/**
 * ============================================================
 * 1. GRÁFICO DE BARRAS: RECEITA MENSAL (ÚLTIMOS 6 MESES)
 * ============================================================
 */
function renderBarChartReceita(canvas, tooltipEl, summaryEl) {
  const { ctx, width, height } = setupCanvasDPI(canvas, 240);

  // Calcula os últimos 6 meses
  const now = new Date();
  const monthsData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${MESES_ABREV[month]}/${String(year).slice(-2)}`;

    monthsData.push({
      yearMonth,
      label,
      total: 0,
      count: 0
    });
  }

  // Agrega pagamentos realizados por mês
  const installments = state.getInstallments();

  installments.forEach(inst => {
    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        const ym = String(rec.date).slice(0, 7);
        const match = monthsData.find(m => m.yearMonth === ym);
        if (match) {
          match.total += Number(rec.amount || 0);
          match.count++;
        }
      });
    } else if (inst.status === 'paid' && inst.paidDate) {
      const ym = String(inst.paidDate).slice(0, 7);
      const match = monthsData.find(m => m.yearMonth === ym);
      if (match) {
        match.total += Number(inst.paidAmount || inst.installmentAmount || 0);
        match.count++;
      }
    }
  });

  const totalPeriodo = monthsData.reduce((acc, m) => acc + m.total, 0);
  const mediaMensal = totalPeriodo / 6;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Total Realizado no Período:</span>
        <strong style="color: var(--emerald-400);">${formatBRL(totalPeriodo)}</strong>
      </div>
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Média Mensal:</span>
        <strong style="color: var(--yellow);">${formatBRL(mediaMensal)}</strong>
      </div>
    `;
  }

  // Margens de desenho
  const paddingLeft = 58;
  const paddingRight = 20;
  const paddingTop = 32;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Valor máximo para escala Y
  const maxVal = Math.max(...monthsData.map(m => m.total), 1000);
  // Arredonda para múltiplo visual limpo
  const niceMax = Math.ceil(maxVal / 500) * 500 * 1.25;

  // Limpa tela
  ctx.clearRect(0, 0, width, height);

  // 1. Linhas de grade horizontais e valores Y
  const gridLines = 4;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';

  for (let i = 0; i <= gridLines; i++) {
    const val = (niceMax / gridLines) * i;
    const y = paddingTop + chartHeight - (chartHeight * (val / niceMax));

    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = THEME.text400;
    const formattedY = val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${Math.round(val)}`;
    ctx.fillText(formattedY, paddingLeft - 8, y);
  }

  // 2. Desenho das Barras
  const slotWidth = chartWidth / monthsData.length;
  const barWidth = Math.min(48, Math.max(20, slotWidth * 0.55));
  const barsCoords = [];

  monthsData.forEach((m, idx) => {
    const x = paddingLeft + (idx * slotWidth) + (slotWidth / 2) - (barWidth / 2);
    const barH = (m.total / niceMax) * chartHeight;
    const y = paddingTop + chartHeight - barH;

    barsCoords.push({
      x,
      y,
      w: barWidth,
      h: barH,
      data: m
    });

    // Fundo da barra (guia sutil)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    drawRoundedRect(ctx, x, paddingTop, barWidth, chartHeight, 6);
    ctx.fill();

    // Barra com gradiente vertical amarelo
    if (m.total > 0) {
      const grad = ctx.createLinearGradient(x, y, x, paddingTop + chartHeight);
      grad.addColorStop(0, THEME.yellowLight);
      grad.addColorStop(0.5, THEME.yellow);
      grad.addColorStop(1, THEME.yellowDark);

      ctx.fillStyle = grad;
      ctx.shadowColor = THEME.yellowGlow;
      ctx.shadowBlur = 8;
      drawRoundedRect(ctx, x, y, barWidth, barH, 5);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Valor no topo da barra (se houver espaço)
      ctx.fillStyle = THEME.text100;
      ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const labelText = m.total >= 1000 ? `R$ ${(m.total / 1000).toFixed(1)}k` : `R$ ${Math.round(m.total)}`;
      ctx.fillText(labelText, x + barWidth / 2, Math.max(12, y - 8));
    } else {
      // Indicador sutil de zero
      ctx.fillStyle = THEME.text400;
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('-', x + barWidth / 2, paddingTop + chartHeight - 8);
    }

    // Label do mês no eixo X
    ctx.fillStyle = idx === monthsData.length - 1 ? THEME.yellow : THEME.text300;
    ctx.font = idx === monthsData.length - 1 ? '700 11px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, x + barWidth / 2, paddingTop + chartHeight + 20);
  });

  // Linha de base do eixo X
  ctx.strokeStyle = THEME.borderMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
  ctx.stroke();

  // Interatividade com Tooltip
  setupCanvasHover(canvas, tooltipEl, (mouseX, mouseY) => {
    const found = barsCoords.find(b => mouseX >= b.x - 4 && mouseX <= b.x + b.w + 4);
    if (found) {
      return {
        x: found.x + found.w / 2,
        y: found.y,
        html: `
          <div class="tooltip-title">📅 ${found.data.label}</div>
          <div class="tooltip-row">
            <span>Receita:</span>
            <strong style="color: var(--yellow);">${formatBRL(found.data.total)}</strong>
          </div>
          <div class="tooltip-sub">${found.data.count} pagamento(s) recebido(s)</div>
        `
      };
    }
    return null;
  });
}

/**
 * ============================================================
 * 2. GRÁFICO DONUT / PIE: STATUS DAS PARCELAS
 * ============================================================
 */
function renderDonutChartStatus(canvas, legendEl) {
  const box = canvas.parentElement;
  const boxW = (box ? box.clientWidth : 0) || 190;
  const boxH = (box ? box.clientHeight : 0) || 190;
  const size = Math.min(boxW, boxH, 200) || 180;
  const { ctx, width, height } = setupCanvasDPI(canvas, size);

  const installments = state.getInstallments();
  const todayStr = formatDateForInput(new Date());

  let paidCount = 0;
  let paidAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;

  installments.forEach(i => {
    if (i.status === 'paid') {
      paidCount++;
      paidAmount += Number(i.paidAmount || i.installmentAmount);
    } else if (i.status === 'renegotiated') {
      // Ignorado
    } else if (i.dueDate < todayStr) {
      overdueCount++;
      overdueAmount += Number(i.installmentAmount) - Number(i.paidAmount || 0);
    } else {
      pendingCount++;
      pendingAmount += Number(i.installmentAmount) - Number(i.paidAmount || 0);
    }
  });

  const totalCount = paidCount + overdueCount + pendingCount;
  const totalAmount = paidAmount + overdueAmount + pendingAmount;

  const slices = [
    {
      label: 'Pagas',
      count: paidCount,
      amount: paidAmount,
      color: THEME.green,
      lightColor: THEME.greenLight,
      icon: '✓'
    },
    {
      label: 'Atrasadas',
      count: overdueCount,
      amount: overdueAmount,
      color: THEME.red,
      lightColor: THEME.redLight,
      icon: '🚨'
    },
    {
      label: 'Pendentes',
      count: pendingCount,
      amount: pendingAmount,
      color: THEME.yellow,
      lightColor: THEME.yellowLight,
      icon: '⏳'
    }
  ];

  // Renderiza Legenda HTML
  if (legendEl) {
    legendEl.innerHTML = `
      <div class="donut-stats-list">
        ${slices.map(s => {
          const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : '0.0';
          return `
            <div class="donut-legend-item">
              <div class="donut-legend-header">
                <div class="donut-legend-title-wrap">
                  <span class="donut-legend-bullet" style="background: ${s.color};"></span>
                  <span class="donut-legend-name">${s.label}</span>
                </div>
                <span class="donut-legend-pct" style="color: ${s.color}; border: 1px solid ${s.color}33;">${pct}%</span>
              </div>
              <div class="donut-legend-detail">
                <span class="donut-legend-count"><strong>${s.count}</strong> parcela${s.count !== 1 ? 's' : ''}</span>
                <span class="donut-legend-amount" style="color: ${s.color};">${formatBRL(s.amount)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(cx, cy) - 14;
  const innerRadius = outerRadius * 0.62;

  if (totalCount === 0) {
    // Vazio
    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerRadius + innerRadius) / 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = THEME.text400;
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma parcela', cx, cy);
    return;
  }

  let startAngle = -Math.PI / 2;
  const sliceGap = 0.035; // Espaçamento entre fatias

  slices.forEach(slice => {
    const sliceAngle = (slice.count / totalCount) * 2 * Math.PI;
    if (sliceAngle <= 0) return;

    const actualStart = startAngle + (sliceGap / 2);
    const actualEnd = startAngle + sliceAngle - (sliceGap / 2);

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, actualStart, actualEnd, false);
    ctx.arc(cx, cy, innerRadius, actualEnd, actualStart, true);
    ctx.closePath();

    ctx.fillStyle = slice.color;
    ctx.shadowColor = slice.color;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    startAngle += sliceAngle;
  });

  // Centro do Donut
  ctx.fillStyle = THEME.bg2;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius - 2, 0, 2 * Math.PI);
  ctx.fill();

  // Texto central
  ctx.fillStyle = THEME.text100;
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(totalCount, cx, cy - 8);

  ctx.fillStyle = THEME.text400;
  ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TOTAL PARCELAS', cx, cy + 14);
}

/**
 * ============================================================
 * 3. GRÁFICO DE LINHA: CAPITAL NA RUA AO LONGO DO TEMPO
 * ============================================================
 */
function renderLineChartCapital(canvas, tooltipEl, summaryEl) {
  const { ctx, width, height } = setupCanvasDPI(canvas, 260);

  const now = new Date();
  const timelinePoints = [];

  // Gera pontos para os últimos 6 meses até o mês atual
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    // Último dia do mês
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const endOfMonthStr = formatDateForInput(endOfMonth);
    const label = `${MESES_ABREV[month]}/${String(year).slice(-2)}`;

    timelinePoints.push({
      date: endOfMonth,
      dateStr: endOfMonthStr,
      label,
      capitalNaRua: 0
    });
  }

  const loans = state.getLoans();
  const installments = state.getInstallments();

  // Para cada mês no histórico, calcula o saldo devedor pendente naquele momento
  timelinePoints.forEach(point => {
    let monthCapital = 0;

    loans.forEach(loan => {
      // Se o empréstimo já havia sido concedido até o final deste mês
      const loanStart = new Date(loan.startDate || loan.createdAt);
      if (loanStart <= point.date) {
        const loanInsts = installments.filter(i => i.loanId === loan.id);

        loanInsts.forEach(inst => {
          // Verifica se a parcela foi paga até o final deste mês
          let wasPaid = false;
          if (inst.status === 'paid' && inst.paidDate) {
            const paidD = new Date(inst.paidDate);
            if (paidD <= point.date) {
              wasPaid = true;
            }
          }

          if (!wasPaid) {
            monthCapital += Number(inst.amortizationAmount || inst.installmentAmount);
          }
        });
      }
    });

    point.capitalNaRua = monthCapital;
  });

  const currentCapital = timelinePoints[timelinePoints.length - 1].capitalNaRua;
  const initialCapital = timelinePoints[0].capitalNaRua;
  const delta = currentCapital - initialCapital;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Capital Atual em Aberto:</span>
        <strong style="color: var(--yellow);">${formatBRL(currentCapital)}</strong>
      </div>
      <div class="chart-summary-stat">
        <span class="chart-summary-label">Variação nos 6 Meses:</span>
        <strong style="color: ${delta >= 0 ? 'var(--emerald-400)' : 'var(--text-300)'};">
          ${delta >= 0 ? '+' : ''}${formatBRL(delta)}
        </strong>
      </div>
    `;
  }

  // Margens
  const paddingLeft = 68;
  const paddingRight = 24;
  const paddingTop = 32;
  const paddingBottom = 42;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...timelinePoints.map(p => p.capitalNaRua), 1000);
  const niceMax = Math.ceil(maxVal / 2000) * 2000 * 1.25;

  ctx.clearRect(0, 0, width, height);

  // 1. Linhas de grade e valores no eixo Y
  const gridLines = 4;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';

  for (let i = 0; i <= gridLines; i++) {
    const val = (niceMax / gridLines) * i;
    const y = paddingTop + chartHeight - (chartHeight * (val / niceMax));

    ctx.strokeStyle = THEME.borderSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = THEME.text400;
    const formattedY = val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${Math.round(val)}`;
    ctx.fillText(formattedY, paddingLeft - 8, y);
  }

  // Calcula coordenadas dos pontos (x, y)
  const slotWidth = chartWidth / (timelinePoints.length - 1);
  const coords = timelinePoints.map((p, idx) => {
    const x = paddingLeft + (idx * slotWidth);
    const y = paddingTop + chartHeight - (chartHeight * (p.capitalNaRua / niceMax));
    return { x, y, data: p };
  });

  // 2. Área Preenchida com Gradiente Ambar / Amarelo
  const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  fillGrad.addColorStop(0, 'rgba(245, 197, 24, 0.32)');
  fillGrad.addColorStop(0.7, 'rgba(245, 197, 24, 0.08)');
  fillGrad.addColorStop(1, 'rgba(245, 197, 24, 0.00)');

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, paddingTop + chartHeight);
  ctx.lineTo(coords[0].x, coords[0].y);

  // Curva suave com Bezier
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
  }

  ctx.lineTo(coords[coords.length - 1].x, paddingTop + chartHeight);
  ctx.closePath();
  ctx.fill();

  // 3. Linha de Traçado Principal
  ctx.strokeStyle = THEME.yellow;
  ctx.lineWidth = 3;
  ctx.shadowColor = THEME.yellowGlow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Pontos / Marcadores Circulares e Labels no Eixo X
  coords.forEach((coord, idx) => {
    // Marcador externo
    ctx.fillStyle = THEME.bg1;
    ctx.strokeStyle = THEME.yellow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Centro do ponto
    ctx.fillStyle = idx === coords.length - 1 ? THEME.yellowLight : THEME.yellow;
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Rótulo de mês no eixo X
    ctx.fillStyle = idx === coords.length - 1 ? THEME.yellow : THEME.text300;
    ctx.font = idx === coords.length - 1 ? '700 11px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(coord.data.label, coord.x, paddingTop + chartHeight + 20);
  });

  // Linha de base X
  ctx.strokeStyle = THEME.borderMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
  ctx.stroke();

  // Interatividade com Tooltip
  setupCanvasHover(canvas, tooltipEl, (mouseX, mouseY) => {
    const hitRadius = 24;
    const found = coords.find(c => Math.abs(mouseX - c.x) <= hitRadius);
    if (found) {
      return {
        x: found.x,
        y: found.y,
        html: `
          <div class="tooltip-title">📈 ${found.data.label}</div>
          <div class="tooltip-row">
            <span>Capital na Rua:</span>
            <strong style="color: var(--yellow);">${formatBRL(found.data.capitalNaRua)}</strong>
          </div>
          <div class="tooltip-sub">Posição em ${formatDate(found.data.dateStr)}</div>
        `
      };
    }
    return null;
  });
}

/**
 * Utilitário para retângulos com cantos arredondados no Canvas
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Utilitário de Hover e Tooltips nos Canvas
 */
function setupCanvasHover(canvas, tooltipEl, hitTestFn) {
  if (!canvas || !tooltipEl) return;

  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = hitTestFn(mouseX, mouseY);
    if (hit) {
      tooltipEl.innerHTML = hit.html;
      tooltipEl.style.display = 'block';

      // Posiciona tooltip sem vazar do container
      const containerRect = canvas.parentElement.getBoundingClientRect();
      let left = hit.x;
      let top = hit.y - 10;

      if (left > containerRect.width - 150) {
        left = containerRect.width - 150;
      }
      if (left < 70) {
        left = 70;
      }

      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    } else {
      tooltipEl.style.display = 'none';
    }
  };

  const onMouseLeave = () => {
    tooltipEl.style.display = 'none';
  };

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
}

/**
 * Ações de exportação e impressão de relatórios
 */
function attachReportActions(container) {
  // Exportar CSV
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    exportFinancialCSV();
  });

  // Imprimir Relatório
  container.querySelector('#btn-print-reports')?.addEventListener('click', () => {
    window.print();
  });

  // Gerar Relatório Oficial em PDF (abre modal de seleção do mês)
  container.querySelector('#btn-generate-pdf-report')?.addEventListener('click', () => {
    openMonthlyReportModal();
  });
}

/**
 * Gera arquivo CSV com extrato financeiro para download
 */
function exportFinancialCSV() {
  const installments = state.getInstallments();
  const clients = state.getClients();
  const loans = state.getLoans();

  const headers = ['ID Parcela', 'ID Contrato', 'Cliente', 'CPF', 'Nº Parcela', 'Vencimento', 'Valor Parcela (R$)', 'Valor Pago (R$)', 'Data Pagamento', 'Status'];

  const rows = installments.map(inst => {
    const client = clients.find(c => c.id === inst.clientId) || { name: 'Desconhecido', cpf: '' };
    return [
      `"${inst.id}"`,
      `"${inst.loanId}"`,
      `"${client.name}"`,
      `"${client.cpf || ''}"`,
      inst.number,
      inst.dueDate,
      Number(inst.installmentAmount || 0).toFixed(2),
      Number(inst.paidAmount || 0).toFixed(2),
      inst.paidDate || '',
      `"${inst.status}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_financeiro_vandomotos_${formatDateForInput()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
