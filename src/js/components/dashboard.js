// src/js/components/dashboard.js
// Visão Geral, Indicadores Financeiros e Painel Rápido

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, formatDateForInput } from '../utils.js';
import { calculateLateCharges } from '../finance.js';

export function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'dashboard-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();
  const settings = state.getSettings();

  const todayStr = formatDateForInput(new Date());

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
  const overdueList = [];
  const recentPayments = [];

  installments.forEach(inst => {
    const isPaid = inst.status === 'paid';
    const isPartial = inst.status === 'partial';
    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido', phone: '' };

    // Saldo pendente da parcela
    const pendingAmount = Number(inst.installmentAmount) - Number(inst.paidAmount || 0);

    if (!isPaid) {
      capitalNaRua += Number(inst.amortizationAmount || pendingAmount);

      if (inst.dueDate === todayStr) {
        todayDueList.push({ ...inst, client });
      } else if (inst.dueDate < todayStr) {
        // Parcela atrasada
        const charges = calculateLateCharges(inst, new Date(), inst.penaltyRate || settings.defaultPenaltyRate, inst.dailyInterestRate || settings.defaultDailyRate);
        atrasadasTotal += charges.totalUpdatedAmount;
        atrasadasQtd++;
        overdueList.push({ ...inst, client, charges });
      }
    }

    // Histórico de pagamentos no mês
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

  // Ordena recentes
  recentPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  overdueList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  container.innerHTML = `
    <!-- Banner de Alerta se houver atrasos -->
    ${atrasadasQtd > 0 ? `
      <div class="alert-overdue">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-title">Atenção: ${atrasadasQtd} parcela(s) em atraso</div>
          <div class="alert-body">
            Total pendente com juros e multa: <strong style="color: var(--red-light);">${formatBRL(atrasadasTotal)}</strong>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-ver-atrasadas" style="margin-top: 10px;">
            Ver Inadimplentes e Cobrar
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Atalhos Rápidos do Dia -->
    <div class="quick-actions-grid">
      <button class="quick-action-btn" id="btn-dash-caixa">
        <span class="quick-action-icon">💰</span>
        <span>Fechamento de Caixa</span>
      </button>
      <button class="quick-action-btn" id="btn-dash-reneg">
        <span class="quick-action-icon">🔄</span>
        <span>Renegociar Dívidas</span>
      </button>
      <button class="quick-action-btn" id="btn-dash-novo-emp">
        <span class="quick-action-icon">➕</span>
        <span>Novo Empréstimo</span>
      </button>
    </div>

    <!-- Grade de KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Capital na Rua</span>
          <div class="kpi-icon-wrap kpi-icon-emerald">💰</div>
        </div>
        <div class="kpi-value">${formatBRL(capitalNaRua)}</div>
        <div class="kpi-footer">
          <span>Total de capital emprestado em aberto</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Lucro Previsto</span>
          <div class="kpi-icon-wrap kpi-icon-indigo">📈</div>
        </div>
        <div class="kpi-value">${formatBRL(lucroPrevisto)}</div>
        <div class="kpi-footer">
          <span>Juros contratados nos empréstimos ativos</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Recebido no Mês</span>
          <div class="kpi-icon-wrap kpi-icon-amber">📥</div>
        </div>
        <div class="kpi-value">${formatBRL(recebidoNoMes)}</div>
        <div class="kpi-footer">
          <span>Amortizações e juros baixados no mês</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Em Atraso</span>
          <div class="kpi-icon-wrap kpi-icon-rose">🚨</div>
        </div>
        <div class="kpi-value">${formatBRL(atrasadasTotal)}</div>
        <div class="kpi-footer" style="color: var(--rose-400);">
          <span>${atrasadasQtd} parcela(s) vencida(s)</span>
        </div>
      </div>
    </div>

    <!-- Seção de Ações Rápidas & Vencimentos -->
    <div class="grid-auto-fit">
      
      <!-- Card: Vencem Hoje -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">📅 Vencendo Hoje (${todayDueList.length})</h3>
            <p class="card-subtitle">Parcelas com vencimento para o dia de hoje</p>
          </div>
        </div>

        ${todayDueList.length === 0 ? `
          <div style="text-align: center; padding: 32px 0; color: var(--text-dim);">
            <div style="font-size: 2rem; margin-bottom: 8px;">✨</div>
            Nenhuma parcela vence hoje!
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${todayDueList.map(item => `
              <div class="due-item-card">
                <div class="due-item-info">
                  <div style="font-weight: 700; font-size: 0.95rem;">${item.client.name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">
                    Parcela nº ${item.number} • ${formatBRL(item.installmentAmount)}
                  </div>
                </div>
                <div class="due-item-actions">
                  <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}" title="Gerar QR Code PIX">
                    ⚡ PIX
                  </button>
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp" 
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${item.client.phone}"
                    data-amount="${item.installmentAmount}"
                    data-number="${item.number}"
                    data-date="${formatDate(item.dueDate)}">
                    WhatsApp
                  </button>
                  <button class="btn btn-primary btn-sm btn-action-pay" data-id="${item.id}">
                    Dar Baixa
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
            <h3 class="card-title">🚨 Inadimplentes Críticos (${overdueList.length})</h3>
            <p class="card-subtitle">Cobrança prioritária com juros atualizados</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-ir-parcelas">Ver Todas</button>
        </div>

        ${overdueList.length === 0 ? `
          <div style="text-align: center; padding: 32px 0; color: var(--emerald-400);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🎉</div>
            Excelente! Nenhuma parcela em atraso no momento.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${overdueList.slice(0, 4).map(item => `
              <div class="due-item-card due-item-overdue">
                <div class="due-item-info">
                  <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">${item.client.name}</div>
                  <div style="font-size: 0.78rem; color: var(--rose-400);">
                    Atrasado há ${item.charges.daysOverdue} dias • Total: <strong>${formatBRL(item.charges.totalUpdatedAmount)}</strong>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-dim);">
                    Original: ${formatBRL(item.installmentAmount)} (+${formatBRL(item.charges.totalLateCharges)} juros/multa)
                  </div>
                </div>
                <div class="due-item-actions">
                  <button class="btn btn-secondary btn-sm btn-action-pix" data-id="${item.id}" title="Gerar QR Code PIX">
                    ⚡ PIX
                  </button>
                  <button class="btn btn-whatsapp btn-sm btn-action-whatsapp-overdue" 
                    data-client="${encodeURIComponent(item.client.name)}"
                    data-phone="${item.client.phone}"
                    data-amount="${item.charges.totalUpdatedAmount}"
                    data-number="${item.number}"
                    data-date="${formatDate(item.dueDate)}"
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

    <!-- Histórico de Últimos Recebimentos -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">📝 Últimos Recebimentos Confirmados</h3>
          <p class="card-subtitle">Extrato das baixas recentes no sistema</p>
        </div>
      </div>

      ${recentPayments.length === 0 ? `
        <div style="text-align: center; padding: 24px; color: var(--text-dim);">
          Nenhum recebimento registrado recentemente.
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
                <th>Valor Pago</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${recentPayments.slice(0, 6).map(r => `
                <tr>
                  <td data-label="Data">${formatDate(r.date)}</td>
                  <td data-label="Cliente" style="font-weight: 600;">${r.client.name}</td>
                  <td data-label="Parcela">Parcela nº ${r.installmentNumber}</td>
                  <td data-label="Forma"><span class="badge badge-paid">${r.method || 'PIX'}</span></td>
                  <td data-label="Valor" style="font-weight: 700; color: var(--emerald-400);">${formatBRL(r.amount)}</td>
                  <td data-label="Status"><span class="badge badge-paid">Recebido</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Event Listeners locais do Dashboard
  setTimeout(() => {
    // Botão de ver atrasadas do banner
    const btnBanner = container.querySelector('#btn-ver-atrasadas');
    if (btnBanner) {
      btnBanner.addEventListener('click', () => {
        window.navigateToTab('installments', { filter: 'overdue' });
      });
    }

    const btnIrParcelas = container.querySelector('#btn-ir-parcelas');
    if (btnIrParcelas) {
      btnIrParcelas.addEventListener('click', () => {
        window.navigateToTab('installments', { filter: 'overdue' });
      });
    }

    // Botões de cobrança via WhatsApp
    container.querySelectorAll('.btn-action-whatsapp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const client = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = formatBRL(btn.dataset.amount);
        const number = btn.dataset.number;
        const date = btn.dataset.date;
        
        let msg = settings.whatsappTemplate
          .replace('{cliente}', client)
          .replace('{parcela_num}', number)
          .replace('{valor_parcela}', amount)
          .replace('{data_vencimento}', date)
          .replace('{chave_pix}', settings.pixKey)
          .replace('{titular_pix}', settings.pixHolder);

        const url = createWhatsAppUrl(phone, msg);
        if (url) window.open(url, '_blank');
      });
    });

    container.querySelectorAll('.btn-action-whatsapp-overdue').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const client = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = formatBRL(btn.dataset.amount);
        const number = btn.dataset.number;
        const date = btn.dataset.date;
        const days = btn.dataset.days;

        const msg = `Olá, ${client}! Constatamos que sua parcela nº ${number} (vencida em ${date}, há ${days} dias) continua em aberto. O valor atualizado para quitação hoje com os encargos é ${amount}.\n\nPara quitar via PIX:\nChave: ${settings.pixKey} (${settings.pixHolder})\n\nPor favor, nos envie o comprovante assim que realizar o pagamento.`;
        
        const url = createWhatsAppUrl(phone, msg);
        if (url) window.open(url, '_blank');
      });
    });

    // Botões de Dar Baixa
    container.querySelectorAll('.btn-action-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPaymentModal(btn.dataset.id);
      });
    });

    // Botões de Gerar PIX
    container.querySelectorAll('.btn-action-pix').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openPixModal) {
          window.openPixModal(btn.dataset.id);
        }
      });
    });

    // Atalhos Rápidos do Dashboard
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
