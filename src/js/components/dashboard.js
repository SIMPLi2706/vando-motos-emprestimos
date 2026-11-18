// src/js/components/dashboard.js
// Visão Geral, Indicadores Financeiros e Painel Rápido - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, formatDateForInput, escapeHtml, buildWhatsAppCollectionMessage } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
import { icon } from '../icons.js';

export function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'dashboard-view animate-fade-in';

  const loans = state.getLoans();
  const installments = state.getInstallments();
  const settings = state.getSettings();
  const interestStats = state.getInterestProfitStats();

  const todayDate = new Date();
  const todayStr = formatDateForInput(todayDate);
  const plus3Date = new Date(todayDate);
  plus3Date.setDate(plus3Date.getDate() + 3);
  const plus3Str = formatDateForInput(plus3Date);

  // Cálculos de Indicadores
  let capitalNaRua = 0;
  let lucroPrevisto = 0;
  let recebidoNoMes = 0;
  let atrasadasTotal = 0;
  let atrasadasQtd = 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Empréstimos ativos
  loans.filter(l => l.status === 'active').forEach(l => {
    lucroPrevisto += Number(l.totalInterest || 0);
  });

  // Analisa parcelas
  const todayDueList = [];
  const upcomingList = [];
  const promiseList = [];
  const overdueList = [];
  const recentPayments = [];

  installments.forEach(inst => {
    const isPaid = inst.status === 'paid';
    const client = state.getClientById(inst.clientId) || { name: 'Cliente', phone: '' };
    const pendingAmount = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);
    const dueNorm = String(inst.dueDate || '').split('T')[0];

    if (!isPaid) {
      capitalNaRua += Number(inst.amortizationAmount || pendingAmount);

      if (inst.promisedDate) {
        promiseList.push({ ...inst, client });
      }

      if (dueNorm === todayStr) {
        todayDueList.push({ ...inst, client });
      } else if (dueNorm > todayStr && dueNorm <= plus3Str) {
        upcomingList.push({ ...inst, client });
      } else if (dueNorm < todayStr) {
        const charges = calculateLateCharges(
          inst,
          new Date(),
          inst.penaltyRate || settings.defaultPenaltyRate,
          inst.dailyInterestRate || settings.defaultDailyRate
        );
        atrasadasTotal += charges.totalUpdatedAmount;
        atrasadasQtd++;
        overdueList.push({ ...inst, client, charges });
      }
    }

    if (inst.paymentHistory && inst.paymentHistory.length > 0) {
      inst.paymentHistory.forEach(rec => {
        const recDate = new Date(rec.date);
        if (recDate.getMonth() === currentMonth && recDate.getFullYear() === currentYear) {
          recebidoNoMes += Number(rec.amount || 0);
        }
        recentPayments.push({ ...rec, client, installmentNumber: inst.number });
      });
    }
  });

  recentPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  overdueList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  promiseList.sort((a, b) => String(a.promisedDate || '').localeCompare(String(b.promisedDate || '')));
  upcomingList.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

  container.innerHTML = `
    <!-- VISÃO LIMPA E ORGANIZADA PARA CELULAR (FINTECH MOBILE) -->
    <div class="mobile-dash-view">
      <!-- 1. Hero Card: Capital na Rua e Indicadores Chave -->
      <div class="dash-hero-fintech">
        <div class="dhf-top">
          <span class="dhf-label">Capital Alocado (Na Rua)</span>
          <span class="dhf-badge">Padrão 20%</span>
        </div>
        <div class="dhf-value text-yellow">${formatBRL(capitalNaRua)}</div>
        <div class="dhf-stats-grid">
          <div class="dhf-stat-item">
            <span class="dhf-stat-label">Lucro Previsto</span>
            <span class="dhf-stat-val text-indigo">+${formatBRL(lucroPrevisto)}</span>
          </div>
          <div class="dhf-stat-item">
            <span class="dhf-stat-label">Recebido Mês</span>
            <span class="dhf-stat-val text-green">${formatBRL(recebidoNoMes)}</span>
          </div>
          <div class="dhf-stat-item">
            <span class="dhf-stat-label">Em Atraso</span>
            <span class="dhf-stat-val ${atrasadasQtd > 0 ? 'text-danger' : ''}">${formatBRL(atrasadasTotal)}</span>
          </div>
        </div>
      </div>

      <!-- 2. Ações Rápidas em Estilo App Nativo (4 Ícones Arredondados) -->
      <div class="quick-actions-bar-mobile">
        <div class="qab-item" id="m-btn-novo-emp">
          <div class="qab-icon qab-icon--primary">${icon('plus', 16)}</div>
          <span class="qab-label">Novo</span>
        </div>
        <div class="qab-item" id="m-btn-caixa">
          <div class="qab-icon">${icon('dollar', 16)}</div>
          <span class="qab-label">Caixa</span>
        </div>
        <div class="qab-item" id="m-btn-reneg">
          <div class="qab-icon">${icon('refresh', 16)}</div>
          <span class="qab-label">Acordo</span>
        </div>
        <div class="qab-item" id="m-btn-clientes">
          <div class="qab-icon">${icon('users', 16)}</div>
          <span class="qab-label">Clientes</span>
        </div>
      </div>

      <!-- 3. Alerta Direto de Inadimplência (se houver atraso) -->
      ${atrasadasQtd > 0 ? `
        <div class="alert-overdue" style="margin-bottom: 14px; padding: 10px 12px; border-radius: 14px;">
          <div class="alert-content" style="font-size: 0.82rem;">
            <strong style="color: var(--red);">${atrasadasQtd} parcela${atrasadasQtd > 1 ? 's' : ''} em atraso</strong> (${formatBRL(atrasadasTotal)})
          </div>
          <button class="btn btn-danger btn-sm" id="m-btn-ver-atrasadas" style="padding: 6px 12px; font-size: 0.76rem; min-height: 32px; border-radius: 8px;">
            Cobrar
          </button>
        </div>
      ` : ''}

      <!-- 4. Lucro & Rentabilidade Retrátil (Toque para Ver Indicadores) -->
      <div class="card" style="margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(245, 197, 24, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="m-btn-toggle-juros">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--yellow);">${icon('trendingUp', 16)}</span>
            <div>
              <strong style="font-size: 0.85rem; color: #fff;">Lucro & Rentabilidade Seu Vando</strong>
              <div style="font-size: 0.72rem; color: var(--emerald-400);">+${interestStats.rentabilidadeRealMensal.toFixed(2)}% a.m. • ${formatBRL(interestStats.jurosRecebidosMes)} no mês</div>
            </div>
          </div>
          <span id="m-arrow-juros" style="font-size: 0.9rem; color: var(--text-400); transition: transform 0.2s;">▾</span>
        </div>
        <div id="m-content-juros" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: var(--bg-1); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 0.65rem; color: var(--text-400); text-transform: uppercase;">Juros do Mês</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--green); margin-top: 2px;">${formatBRL(interestStats.jurosRecebidosMes)}</div>
            </div>
            <div style="background: var(--bg-1); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 0.65rem; color: var(--text-400); text-transform: uppercase;">Projeção (30d)</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: #fff; margin-top: 2px;">${formatBRL(interestStats.jurosProjetados30Dias)}</div>
            </div>
            <div style="background: var(--bg-1); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 0.65rem; color: var(--text-400); text-transform: uppercase;">Amortizado (Mês)</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--emerald-400); margin-top: 2px;">${formatBRL(interestStats.principalRecebidoMes)}</div>
            </div>
            <div style="background: var(--bg-1); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 0.65rem; color: var(--text-400); text-transform: uppercase;">Rentabilidade</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--yellow); margin-top: 2px;">${interestStats.rentabilidadeRealMensal.toFixed(2)}% <span style="font-size: 0.7rem; font-weight: 600;">a.m.</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. Operacional do Dia com Abas Segmentadas (Sem Rolagem Infinita) -->
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: var(--text-400); letter-spacing: 0.05em;">Operacional do Dia</span>
          <button type="button" class="btn btn-secondary btn-sm" id="m-btn-ver-todas-parcelas" style="font-size: 0.72rem; padding: 2px 8px; min-height: 24px;">Ver Todas</button>
        </div>
        <div class="dash-segmented-bar" id="m-dash-segments">
          <button type="button" class="dash-seg-btn ${overdueList.length > 0 ? '' : 'active'}" data-seg="today">Hoje (${todayDueList.length})</button>
          <button type="button" class="dash-seg-btn ${overdueList.length > 0 ? 'active' : ''}" data-seg="overdue">Atrasadas (${overdueList.length})</button>
          <button type="button" class="dash-seg-btn" data-seg="promises">Promessas (${promiseList.length})</button>
          <button type="button" class="dash-seg-btn" data-seg="upcoming">Em Breve (${upcomingList.length})</button>
        </div>
        <div id="m-dash-segment-content">
          <!-- Renderizado via script -->
        </div>
      </div>
    </div>

    <!-- VISÃO ORIGINAL PARA COMPUTADOR / TELAS GRANDES -->
    <div class="desktop-dash-view">
      <!-- Banner de Alerta para Parcelas em Atraso -->
      ${atrasadasQtd > 0 ? `
        <div class="alert-overdue">
          <div class="alert-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="alert-content">
            <div class="alert-title">${atrasadasQtd} parcela${atrasadasQtd > 1 ? 's' : ''} em atraso</div>
            <div class="alert-body">
              Total atualizado com juros e multa: <strong class="text-danger">${formatBRL(atrasadasTotal)}</strong>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-ver-atrasadas">
            Cobrar Inadimplentes
          </button>
        </div>
      ` : ''}

    <!-- Atalhos Rápidos Operacionais -->
    <div class="quick-actions-bar">
      <button class="quick-action-item" id="btn-dash-novo-emp">
        <span class="quick-action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </span>
        <span class="quick-action-label">Novo Empréstimo</span>
      </button>

      <button class="quick-action-item" id="btn-dash-caixa">
        <span class="quick-action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <circle cx="12" cy="12" r="2"></circle>
            <path d="M6 12h.01M18 12h.01"></path>
          </svg>
        </span>
        <span class="quick-action-label">Caixa do Dia</span>
      </button>

      <button class="quick-action-item" id="btn-dash-reneg">
        <span class="quick-action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <polyline points="23 20 23 14 17 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
        </span>
        <span class="quick-action-label">Renegociar</span>
      </button>
    </div>

    <!-- Grade de KPIs Financeiros -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Capital na Rua</span>
          <div class="kpi-icon-wrap kpi-icon-emerald">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
        </div>
        <div class="kpi-value text-yellow">${formatBRL(capitalNaRua)}</div>
        <div class="kpi-footer">
          <span>Capital emprestado ativo</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Lucro Previsto</span>
          <div class="kpi-icon-wrap kpi-icon-indigo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
        </div>
        <div class="kpi-value">${formatBRL(lucroPrevisto)}</div>
        <div class="kpi-footer">
          <span>Juros nos contratos ativos</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Recebido no Mês</span>
          <div class="kpi-icon-wrap kpi-icon-amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 12 20 22 4 22 4 12"></polyline>
              <rect x="2" y="7" width="20" height="5"></rect>
              <line x1="12" y1="22" x2="12" y2="7"></line>
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
            </svg>
          </div>
        </div>
        <div class="kpi-value text-green">${formatBRL(recebidoNoMes)}</div>
        <div class="kpi-footer">
          <span>Total baixado este mês</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Em Atraso</span>
          <div class="kpi-icon-wrap kpi-icon-rose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>
        <div class="kpi-value ${atrasadasQtd > 0 ? 'text-danger' : ''}">${formatBRL(atrasadasTotal)}</div>
        <div class="kpi-footer ${atrasadasQtd > 0 ? 'text-danger' : ''}">
          <span>${atrasadasQtd} parcela${atrasadasQtd !== 1 ? 's' : ''} em atraso</span>
        </div>
      </div>
    </div>

    <!-- Painel Executivo de Rentabilidade e Gestão de Juros -->
    <div class="card" style="margin-bottom: 24px; border: 1px solid rgba(245, 197, 24, 0.25); background: linear-gradient(180deg, rgba(245, 197, 24, 0.04) 0%, rgba(18, 18, 20, 0.95) 100%);">
      <div class="card-header" style="border-bottom: 1px solid var(--border-soft); padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 1rem; color: #fff;">
              ${icon('trendingUp', 18)} Gestão de Juros e Rentabilidade do Capital
            </h3>
            <p class="card-subtitle" style="margin-top: 2px;">Demonstrativo de lucros em juros, rolagem e retorno sobre capital na rua</p>
          </div>
          <span class="badge badge-paid" style="font-size: 0.72rem; letter-spacing: 0.05em; background: rgba(16, 185, 129, 0.15); color: var(--emerald-400); border-color: rgba(16, 185, 129, 0.3);">
            Retorno Real: +${interestStats.rentabilidadeRealMensal.toFixed(2)}% a.m.
          </span>
        </div>
      </div>
      <div class="card-body" style="padding: 16px 20px;">
        <div class="kpi-grid dashboard-interest-kpis" style="margin-bottom: 0;">
          
          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 14px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Juros Realizados no Mês</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--green); margin-top: 4px;">
              ${formatBRL(interestStats.jurosRecebidosMes)}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Lucro líquido de juros quitados</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 14px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Rentabilidade Mensal</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--yellow); margin-top: 4px;">
              ${interestStats.rentabilidadeRealMensal.toFixed(2)}% <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">a.m.</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Lucro s/ capital alocado</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 14px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Projeção de Juros (30d)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-top: 4px;">
              ${formatBRL(interestStats.jurosProjetados30Dias)}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Juros vincendos no próximo mês</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 14px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Principal Amortizado (Mês)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--emerald-400); margin-top: 4px;">
              ${formatBRL(interestStats.principalRecebidoMes)}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Capital recuperado de volta</div>
          </div>

        </div>
      </div>
    </div>

    <!-- Seção de Acompanhamento: Vencimentos e Inadimplência -->
    <div class="dashboard-columns-grid">
      
      <!-- Card: Vencem Hoje -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Vencem Hoje (${todayDueList.length})</h3>
            <p class="card-subtitle">Parcelas com vencimento para o dia atual</p>
          </div>
        </div>

        ${todayDueList.length === 0 ? `
          <div class="empty-state-box">
            <p>Nenhuma parcela vence hoje.</p>
          </div>
        ` : `
          <div class="due-items-list">
            ${todayDueList.map(item => `
              <div class="due-item-card">
                <div class="due-item-header">
                  <div class="due-item-name">${item.client.name}</div>
                  <div class="due-item-amount text-yellow">${formatBRL(item.installmentAmount)}</div>
                </div>
                <div class="due-item-sub">
                  Parcela nº ${item.number} • Vence hoje
                </div>
                <div class="due-item-actions">
                  <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}" title="Editar Parcela">
                    ${icon('edit', 12)}
                  </button>
                  <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}">
                    PIX
                  </button>
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp" 
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.installmentAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}">
                    WhatsApp
                  </button>
                  <button class="btn btn-primary btn-sm btn-action-pay" data-id="${item.id}">
                    Baixar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Card: Atrasadas em Destaque -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Inadimplentes (${overdueList.length})</h3>
            <p class="card-subtitle">Cobrança prioritária com juros calculados</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-ir-parcelas">Ver Todas</button>
        </div>

        ${overdueList.length === 0 ? `
          <div class="empty-state-box">
            <p class="text-green">Tudo em dia! Nenhuma parcela atrasada.</p>
          </div>
        ` : `
          <div class="due-items-list">
            ${overdueList.slice(0, 4).map(item => `
              <div class="due-item-card due-item-overdue">
                <div class="due-item-header">
                  <div class="due-item-name">${escapeHtml(item.client.name)}</div>
                  <div class="due-item-amount text-danger">${formatBRL(item.charges.totalUpdatedAmount)}</div>
                </div>
                <div class="due-item-sub">
                  ${item.charges.daysOverdue} dias de atraso • Original: ${formatBRL(item.installmentAmount)}
                </div>
                <div class="due-item-actions">
                  <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}" title="Editar Parcela">
                    ${icon('edit', 12)}
                  </button>
                  <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}">
                    PIX
                  </button>
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp-overdue" 
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.charges.totalUpdatedAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}"
                    data-days="${item.charges.daysOverdue}">
                    Cobrar
                  </button>
                  <button class="btn btn-primary btn-sm btn-action-pay" data-id="${item.id}">
                    Receber
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

    </div>

    <!-- Agenda de Promessas & Preventivos (Vencem em Breve 3d) -->
    <div class="dashboard-columns-grid" style="margin-top: 20px;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('bell', 16)} Promessas de Pagamento (${promiseList.length})</h3>
            <p class="card-subtitle">Compromissos combinados com os clientes</p>
          </div>
        </div>
        ${promiseList.length === 0 ? `
          <div class="empty-state-box">
            <p>Nenhuma promessa de pagamento agendada no momento.</p>
          </div>
        ` : `
          <div class="due-items-list">
            ${promiseList.slice(0, 4).map(item => {
              const duePromiseToday = item.promisedDate <= todayStr;
              return `
                <div class="due-item-card ${duePromiseToday ? 'due-item-overdue' : ''}">
                  <div class="due-item-header">
                    <div class="due-item-name">${escapeHtml(item.client.name)}</div>
                    <div class="due-item-amount ${duePromiseToday ? 'text-danger' : 'text-yellow'}">${formatDate(item.promisedDate)}</div>
                  </div>
                  <div class="due-item-sub">
                    Parcela nº ${item.number} (${formatBRL(item.installmentAmount)})${item.promiseNote ? ` • "${escapeHtml(item.promiseNote)}"` : ''}
                  </div>
                  <div class="due-item-actions">
                    <button class="btn btn-secondary btn-sm btn-dash-promise" data-id="${item.id}">Editar</button>
                    <button class="btn btn-primary btn-sm btn-action-pay" data-id="${item.id}">Baixar</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('clock', 16)} Vencem em Breve — Próximos 3 dias (${upcomingList.length})</h3>
            <p class="card-subtitle">Envie lembrete preventivo antes do vencimento</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-ver-em-breve">Ver Filtro</button>
        </div>
        ${upcomingList.length === 0 ? `
          <div class="empty-state-box">
            <p>Nenhum vencimento nos próximos 3 dias.</p>
          </div>
        ` : `
          <div class="due-items-list">
            ${upcomingList.slice(0, 4).map(item => `
              <div class="due-item-card">
                <div class="due-item-header">
                  <div class="due-item-name">${escapeHtml(item.client.name)}</div>
                  <div class="due-item-amount text-yellow">${formatBRL(item.installmentAmount)}</div>
                </div>
                <div class="due-item-sub">
                  Parcela nº ${item.number} • Vence em <strong>${formatDate(item.dueDate)}</strong>
                </div>
                <div class="due-item-actions">
                  <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}" title="Editar Parcela">
                    ${icon('edit', 12)}
                  </button>
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp"
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.installmentAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}"
                    data-stage="upcoming">
                    ${icon('whatsapp', 13)} Lembrar
                  </button>
                  <button class="btn btn-secondary btn-sm btn-dash-promise" data-id="${item.id}">Promessa</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Histórico de Últimos Recebimentos -->
    <div class="card" style="margin-top: 20px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Últimos Recebimentos</h3>
          <p class="card-subtitle">Extrato das baixas recentes no sistema</p>
        </div>
      </div>

      ${recentPayments.length === 0 ? `
        <div class="empty-state-box">
          <p>Nenhum recebimento registrado recentemente.</p>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="table table-mobile-card-view">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Parcela</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${recentPayments.slice(0, 5).map(r => `
                <tr>
                  <td data-label="Data">
                    <div class="td-cell-val">${formatDate(r.date)}</div>
                  </td>
                  <td data-label="Cliente">
                    <div class="td-cell-val" style="font-weight: 700; color: #fff;">${r.client.name}</div>
                  </td>
                  <td data-label="Parcela">
                    <div class="td-cell-val">Parcela nº ${r.installmentNumber}</div>
                  </td>
                  <td data-label="Forma">
                    <div class="td-cell-val"><span class="badge badge-paid">${r.method || 'PIX'}</span></div>
                  </td>
                  <td data-label="Valor">
                    <div class="td-cell-val" style="font-weight: 700; color: var(--green);">${formatBRL(r.amount)}</div>
                  </td>
                  <td data-label="Status">
                    <div class="td-cell-val"><span class="badge badge-paid">Recebido</span></div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
    </div> <!-- Fecha .desktop-dash-view -->
  `;

  setTimeout(() => {
    // --- LÓGICA DO DASHBOARD MOBILE LIMPO ---
    const mSegContainer = container.querySelector('#m-dash-segment-content');
    const mSegButtons = container.querySelectorAll('.dash-seg-btn');

    function renderMobileSegment(seg) {
      if (!mSegContainer) return;
      let html = '';

      if (seg === 'today') {
        if (todayDueList.length === 0) {
          html = '<div class="empty-state-box" style="padding: 18px;"><p style="font-size: 0.85rem;">Nenhuma parcela vence hoje.</p></div>';
        } else {
          html = todayDueList.map(item => `
            <div class="mobile-card-item" style="margin-bottom: 8px;">
              <div class="mcard-top">
                <div style="min-width: 0;">
                  <div class="mcard-name">${escapeHtml(item.client.name)}</div>
                  <div class="mcard-sub">${escapeHtml(item.client.phone || '')} • Parc. #${item.number}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: var(--yellow);">${formatBRL(item.installmentAmount)}</div>
                  <span class="badge badge-today" style="font-size: 0.65rem; padding: 2px 6px;">Vence Hoje</span>
                </div>
              </div>
              <div class="mcard-actions-row">
                <button class="btn btn-warning btn-sm btn-action-pay-interest" data-id="${item.id}">
                  ${icon('refresh', 12)} Receber Juros
                </button>
                ${item.client.phone ? `
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp"
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.installmentAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}">
                    ${icon('whatsapp', 13)} WhatsApp
                  </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}">PIX</button>
                <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}">${icon('edit', 12)}</button>
              </div>
            </div>
          `).join('');
        }
      } else if (seg === 'overdue') {
        if (overdueList.length === 0) {
          html = '<div class="empty-state-box" style="padding: 18px;"><p class="text-green" style="font-size: 0.85rem;">Tudo em dia! Nenhuma parcela atrasada.</p></div>';
        } else {
          html = overdueList.map(item => `
            <div class="mobile-card-item" style="margin-bottom: 8px; border-color: rgba(244, 63, 94, 0.35);">
              <div class="mcard-top">
                <div style="min-width: 0;">
                  <div class="mcard-name">${escapeHtml(item.client.name)}</div>
                  <div class="mcard-sub" style="color: var(--red); font-weight: 700;">${item.charges.daysOverdue} dias de atraso • Parc. #${item.number}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: var(--red);">${formatBRL(item.charges.totalUpdatedAmount)}</div>
                  <div style="font-size: 0.68rem; color: var(--text-400);">Orig: ${formatBRL(item.installmentAmount)}</div>
                </div>
              </div>
              <div class="mcard-actions-row">
                <button class="btn btn-warning btn-sm btn-action-pay-interest" data-id="${item.id}">
                  ${icon('refresh', 12)} Receber Juros
                </button>
                ${item.client.phone ? `
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp-overdue"
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.charges.totalUpdatedAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}"
                    data-days="${item.charges.daysOverdue}">
                    ${icon('whatsapp', 13)} Cobrar
                  </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}">PIX</button>
                <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}">${icon('edit', 12)}</button>
              </div>
            </div>
          `).join('');
        }
      } else if (seg === 'promises') {
        if (promiseList.length === 0) {
          html = '<div class="empty-state-box" style="padding: 18px;"><p style="font-size: 0.85rem;">Nenhuma promessa de pagamento agendada.</p></div>';
        } else {
          html = promiseList.map(item => `
            <div class="mobile-card-item" style="margin-bottom: 8px;">
              <div class="mcard-top">
                <div style="min-width: 0;">
                  <div class="mcard-name">${escapeHtml(item.client.name)}</div>
                  <div class="mcard-sub">Parc. #${item.number}${item.promiseNote ? ` • "${escapeHtml(item.promiseNote)}"` : ''}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 1.05rem; font-weight: 800; color: var(--yellow);">${formatBRL(item.installmentAmount)}</div>
                  <span class="badge" style="font-size: 0.65rem; background: rgba(245, 197, 24, 0.15); color: var(--yellow);">🗓️ ${formatDate(item.promisedDate)}</span>
                </div>
              </div>
              <div class="mcard-actions-row">
                <button class="btn btn-secondary btn-sm btn-dash-promise" data-id="${item.id}">Editar Promessa</button>
                <button class="btn btn-primary btn-sm btn-action-pay" data-id="${item.id}">Baixar</button>
              </div>
            </div>
          `).join('');
        }
      } else if (seg === 'upcoming') {
        if (upcomingList.length === 0) {
          html = '<div class="empty-state-box" style="padding: 18px;"><p style="font-size: 0.85rem;">Nenhum vencimento nos próximos 3 dias.</p></div>';
        } else {
          html = upcomingList.map(item => `
            <div class="mobile-card-item" style="margin-bottom: 8px;">
              <div class="mcard-top">
                <div style="min-width: 0;">
                  <div class="mcard-name">${escapeHtml(item.client.name)}</div>
                  <div class="mcard-sub">Parc. #${item.number} • Vence ${formatDate(item.dueDate)}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 1.05rem; font-weight: 800; color: var(--yellow);">${formatBRL(item.installmentAmount)}</div>
                </div>
              </div>
              <div class="mcard-actions-row">
                ${item.client.phone ? `
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp"
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${escapeHtml(item.client.phone || '')}"
                    data-amount="${item.installmentAmount}"
                    data-number="${item.number}"
                    data-raw-date="${String(item.dueDate || '').split('T')[0]}"
                    data-stage="upcoming">
                    ${icon('whatsapp', 13)} Lembrar
                  </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm btn-dash-promise" data-id="${item.id}">Promessa</button>
                <button class="btn btn-secondary btn-sm btn-dash-edit-inst" data-id="${item.id}">${icon('edit', 12)}</button>
              </div>
            </div>
          `).join('');
        }
      }

      mSegContainer.innerHTML = html;
      bindActionEvents(mSegContainer);
    }

    mSegButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        mSegButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMobileSegment(btn.dataset.seg);
      });
    });

    // Inicia com a aba mais relevante (Atrasadas se houver, ou Hoje)
    renderMobileSegment(overdueList.length > 0 ? 'overdue' : 'today');

    // Toggle de juros retrátil no mobile
    const toggleJurosBtn = container.querySelector('#m-btn-toggle-juros');
    const contentJuros = container.querySelector('#m-content-juros');
    const arrowJuros = container.querySelector('#m-arrow-juros');
    toggleJurosBtn?.addEventListener('click', () => {
      if (contentJuros) {
        const isHidden = contentJuros.style.display === 'none';
        contentJuros.style.display = isHidden ? 'block' : 'none';
        if (arrowJuros) arrowJuros.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });

    // Atalhos do dashboard mobile
    container.querySelector('#m-btn-novo-emp')?.addEventListener('click', () => window.navigateToTab('loans'));
    container.querySelector('#m-btn-caixa')?.addEventListener('click', () => window.openCashRegisterModal && window.openCashRegisterModal());
    container.querySelector('#m-btn-reneg')?.addEventListener('click', () => window.navigateToTab('renegotiation'));
    container.querySelector('#m-btn-clientes')?.addEventListener('click', () => window.navigateToTab('clients'));
    container.querySelector('#m-btn-ver-atrasadas')?.addEventListener('click', () => window.navigateToTab('installments', { filter: 'overdue' }));
    container.querySelector('#m-btn-ver-todas-parcelas')?.addEventListener('click', () => window.navigateToTab('installments'));

    function bindActionEvents(scope) {
      scope.querySelectorAll('.btn-action-pay-interest').forEach(btn => {
        btn.addEventListener('click', () => {
          window.openPaymentModal(btn.dataset.id, { mode: 'rollover' });
        });
      });

      scope.querySelectorAll('.btn-action-pay').forEach(btn => {
        btn.addEventListener('click', () => {
          window.openPaymentModal(btn.dataset.id);
        });
      });

      scope.querySelectorAll('.btn-action-pix').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.openPixModal) window.openPixModal(btn.dataset.id);
        });
      });

      scope.querySelectorAll('.btn-dash-edit-inst').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.openInstallmentEditModal) window.openInstallmentEditModal(btn.dataset.id);
        });
      });

      scope.querySelectorAll('.btn-dash-promise').forEach(btn => {
        btn.addEventListener('click', () => {
          window.openPromiseModal(btn.dataset.id);
        });
      });

      scope.querySelectorAll('.btn-action-whatsapp').forEach(btn => {
        btn.addEventListener('click', () => {
          const clientName = decodeURIComponent(btn.dataset.client);
          const phone = btn.dataset.phone;
          const amount = Number(btn.dataset.amount || 0);
          const installmentNumber = btn.dataset.number;
          const rawDueDate = btn.dataset.rawDate;
          const stageOverride = btn.dataset.stage || null;

          const msg = buildWhatsAppCollectionMessage({
            clientName,
            installmentNumber,
            amount,
            dueDate: rawDueDate,
            daysOverdue: 0,
            settings: state.getSettings(),
            stageOverride
          });
          const url = createWhatsAppUrl(phone, msg);
          if (url) window.open(url, '_blank');
        });
      });

      scope.querySelectorAll('.btn-action-whatsapp-overdue').forEach(btn => {
        btn.addEventListener('click', () => {
          const clientName = decodeURIComponent(btn.dataset.client);
          const phone = btn.dataset.phone;
          const amount = Number(btn.dataset.amount || 0);
          const installmentNumber = btn.dataset.number;
          const rawDueDate = btn.dataset.rawDate;
          const daysOverdue = Number(btn.dataset.days || 1);

          const msg = buildWhatsAppCollectionMessage({
            clientName,
            installmentNumber,
            amount,
            dueDate: rawDueDate,
            daysOverdue,
            settings: state.getSettings()
          });
          const url = createWhatsAppUrl(phone, msg);
          if (url) window.open(url, '_blank');
        });
      });
    }

    // --- EVENTOS DESKTOP ---
    bindActionEvents(container.querySelector('.desktop-dash-view') || container);
    container.querySelector('#btn-ver-atrasadas')?.addEventListener('click', () => {
      window.navigateToTab('installments', { filter: 'overdue' });
    });

    container.querySelector('#btn-ir-parcelas')?.addEventListener('click', () => {
      window.navigateToTab('installments', { filter: 'overdue' });
    });

    container.querySelector('#btn-ver-em-breve')?.addEventListener('click', () => {
      window.navigateToTab('installments', { filter: 'upcoming' });
    });

    container.querySelectorAll('.btn-dash-promise').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromiseModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-dash-edit-inst').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openInstallmentEditModal) {
          window.openInstallmentEditModal(btn.dataset.id);
        }
      });
    });

    container.querySelectorAll('.btn-action-whatsapp').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientName = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = Number(btn.dataset.amount || 0);
        const installmentNumber = btn.dataset.number;
        const rawDueDate = btn.dataset.rawDate;
        const stageOverride = btn.dataset.stage || null;

        const msg = buildWhatsAppCollectionMessage({
          clientName,
          installmentNumber,
          amount,
          dueDate: rawDueDate,
          daysOverdue: 0,
          settings: state.getSettings(),
          stageOverride
        });

        const url = createWhatsAppUrl(phone, msg);
        if (url) window.open(url, '_blank');
      });
    });

    container.querySelectorAll('.btn-action-whatsapp-overdue').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientName = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = Number(btn.dataset.amount || 0);
        const installmentNumber = btn.dataset.number;
        const rawDueDate = btn.dataset.rawDate;
        const daysOverdue = Number(btn.dataset.days || 1);

        const msg = buildWhatsAppCollectionMessage({
          clientName,
          installmentNumber,
          amount,
          dueDate: rawDueDate,
          daysOverdue,
          settings: state.getSettings()
        });

        const url = createWhatsAppUrl(phone, msg);
        if (url) window.open(url, '_blank');
      });
    });

    container.querySelectorAll('.btn-action-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPaymentModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-action-pix').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openPixModal) {
          window.openPixModal(btn.dataset.id);
        }
      });
    });

    container.querySelector('#btn-dash-caixa')?.addEventListener('click', () => {
      if (window.openCashRegisterModal) {
        window.openCashRegisterModal();
      }
    });

    container.querySelector('#btn-dash-reneg')?.addEventListener('click', () => {
      window.navigateToTab('renegotiation');
    });

    container.querySelector('#btn-dash-novo-emp')?.addEventListener('click', () => {
      window.navigateToTab('loans');
    });
  }, 0);

  return container;
}
