// src/js/components/installments.js
// Gestão Geral de Parcelas, Filtros, Cobrança e Ações de Baixa - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, formatDateForInput, showToast, escapeHtml, buildWhatsAppCollectionMessage } from '../utils.js';
import { calculateLateCharges } from '../finance.js';
import { isAdmin } from './loginScreen.js';
import { icon } from '../icons.js';

export function renderInstallments(options = {}) {
  const container = document.createElement('div');
  container.className = 'installments-view animate-fade-in';

  let installments = state.getInstallments();
  const settings = state.getSettings();

  const todayDate = new Date();
  const todayStr = formatDateForInput(todayDate);
  const upcomingDateObj = new Date(todayDate);
  upcomingDateObj.setDate(upcomingDateObj.getDate() + 3);
  const upcomingLimitStr = formatDateForInput(upcomingDateObj);

  if (options.loanId) {
    installments = installments.filter(i => i.loanId === options.loanId);
  }

  const enrichedList = installments.map(inst => {
    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido', phone: '' };
    const loan = state.getLoanById(inst.loanId) || { notes: '' };
    const dueNorm = String(inst.dueDate || '').split('T')[0];

    let isOverdue = false;
    let isToday = false;
    let isUpcoming = false;
    let lateCharges = null;

    if (inst.status !== 'paid') {
      if (dueNorm < todayStr) {
        isOverdue = true;
        lateCharges = calculateLateCharges(
          inst,
          new Date(),
          loan.penaltyRate || settings.defaultPenaltyRate,
          loan.dailyInterestRate || settings.defaultDailyRate
        );
      } else if (dueNorm === todayStr) {
        isToday = true;
      } else if (dueNorm > todayStr && dueNorm <= upcomingLimitStr) {
        isUpcoming = true;
      }
    }

    return {
      ...inst,
      dueNorm,
      client,
      loan,
      isOverdue,
      isToday,
      isUpcoming,
      lateCharges
    };
  });

  const totalCount = enrichedList.length;
  const overdueCount = enrichedList.filter(i => i.isOverdue).length;
  const todayCount = enrichedList.filter(i => i.isToday).length;
  const upcomingCount = enrichedList.filter(i => i.isUpcoming).length;
  const pendingCount = enrichedList.filter(i => i.status === 'pending').length;
  const paidCount = enrichedList.filter(i => i.status === 'paid').length;
  const adminAllowed = isAdmin();

  let activeTab = options.filter || 'all';

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Gestão de Parcelas & Cobrança</h3>
          <p class="card-subtitle">
            ${options.loanId ? `Exibindo parcelas do contrato selecionado` : 'Controle completo de recebimentos, régua de cobrança e promessas'}
          </p>
        </div>
        <div class="card-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-renegociar-topo">
            Renegociar
          </button>
          ${options.loanId ? `
            <button class="btn btn-secondary btn-sm" id="btn-voltar-todas">
              Ver Todas
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Abas de Filtros de Status -->
      <div class="tabs-bar">
        <button class="tab-btn ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
          Todas (${totalCount})
        </button>
        <button class="tab-btn ${activeTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">
          Vence em Breve 3d (${upcomingCount})
        </button>
        <button class="tab-btn ${activeTab === 'today' ? 'active' : ''}" data-tab="today">
          Hoje (${todayCount})
        </button>
        <button class="tab-btn ${activeTab === 'overdue' ? 'active' : ''}" data-tab="overdue">
          Atrasadas (${overdueCount})
        </button>
        <button class="tab-btn ${activeTab === 'pending' ? 'active' : ''}" data-tab="pending">
          Pendentes (${pendingCount})
        </button>
        <button class="tab-btn ${activeTab === 'paid' ? 'active' : ''}" data-tab="paid">
          Pagas (${paidCount})
        </button>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar-wrap">
        <div class="search-input-box">
          <span class="search-icon-inside">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input type="text" class="form-control" id="search-input-parcelas" placeholder="Buscar por cliente, documento ou parcela...">
        </div>
      </div>

      <!-- Tabela Responsiva de Parcelas -->
      <div class="table-responsive">
        <table class="table table-mobile-card-view" id="table-parcelas">
          <thead>
            <tr>
              <th>Status</th>
              <th>Parcela</th>
              <th>Cliente</th>
              <th>Vencimento</th>
              <th>Valor Original</th>
              <th>Valor Atual</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            <!-- Preenchido dinamicamente -->
          </tbody>
        </table>
      </div>

      <div id="empty-parcelas-msg" class="empty-state-box" style="display: none;">
        <p>Nenhuma parcela encontrada com os filtros selecionados.</p>
      </div>
    </div>
  `;

  function renderTableRows(filterTab, searchTerm = '') {
    const tbody = container.querySelector('#table-parcelas tbody');
    const emptyMsg = container.querySelector('#empty-parcelas-msg');
    const term = searchTerm.toLowerCase().trim();

    let filtered = enrichedList.filter(item => {
      if (filterTab === 'upcoming' && !item.isUpcoming) return false;
      if (filterTab === 'overdue' && !item.isOverdue) return false;
      if (filterTab === 'today' && !item.isToday) return false;
      if (filterTab === 'pending' && item.status !== 'pending') return false;
      if (filterTab === 'paid' && item.status !== 'paid') return false;

      if (term) {
        const matchName = item.client.name.toLowerCase().includes(term);
        const matchPhone = (item.client.phone || '').includes(term);
        const matchCPF = (item.client.cpf || '').includes(term);
        const matchNum = String(item.number).includes(term);
        const matchPromise = (item.promiseNote || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchCPF && !matchNum && !matchPromise) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    tbody.innerHTML = filtered.map(item => {
      let badgeHtml = '';
      let amountDisplay = '';

      if (item.status === 'paid') {
        badgeHtml = `<span class="badge badge-paid">Pago</span>`;
        amountDisplay = `<span style="font-weight: 700; color: var(--green);">${formatBRL(item.paidAmount)}</span>`;
      } else if (item.isOverdue) {
        badgeHtml = `<span class="badge badge-overdue">Atrasada (${item.lateCharges.daysOverdue}d)</span>`;
        amountDisplay = `
          <div style="font-weight: 800; color: var(--red);">${formatBRL(item.lateCharges.totalUpdatedAmount)}</div>
          <div style="font-size: 0.72rem; color: var(--text-400);">(+${formatBRL(item.lateCharges.totalLateCharges)} juros)</div>
        `;
      } else if (item.isToday) {
        badgeHtml = `<span class="badge badge-today">Hoje</span>`;
        amountDisplay = `<span style="font-weight: 700; color: var(--yellow);">${formatBRL(item.installmentAmount)}</span>`;
      } else if (item.isUpcoming) {
        badgeHtml = `<span class="badge" style="background: rgba(245, 197, 24, 0.16); color: var(--yellow); border: 1px solid rgba(245, 197, 24, 0.4);">Em Breve</span>`;
        amountDisplay = `<span style="font-weight: 700; color: var(--yellow);">${formatBRL(item.installmentAmount)}</span>`;
      } else if (item.status === 'partial') {
        const saldoRestante = Number(item.installmentAmount) - Number(item.paidAmount);
        badgeHtml = `<span class="badge badge-partial">Parcial</span>`;
        amountDisplay = `
          <div style="font-weight: 700; color: #60a5fa;">Restante: ${formatBRL(saldoRestante)}</div>
          <div style="font-size: 0.72rem; color: var(--text-400);">Pago: ${formatBRL(item.paidAmount)}</div>
        `;
      } else {
        badgeHtml = `<span class="badge badge-pending">Pendente</span>`;
        amountDisplay = `<span style="font-weight: 600;">${formatBRL(item.installmentAmount)}</span>`;
      }

      const promiseChip = (item.status !== 'paid' && item.promisedDate)
        ? `<div class="promise-inline-badge ${item.promisedDate <= todayStr ? 'promise-due' : ''}">${icon('bell', 11)} Promessa: ${formatDate(item.promisedDate)}${item.promiseNote ? ` (${escapeHtml(item.promiseNote)})` : ''}</div>`
        : '';

      return `
        <tr>
          <td data-label="Status">
            <div class="td-cell-val">${badgeHtml}</div>
          </td>
          <td data-label="Parcela">
            <div class="td-cell-val" style="font-weight: 700;">${Number(item.loan?.installmentsCount) === 1 ? 'Única' : `#${item.number}`}</div>
          </td>
          <td data-label="Cliente">
            <div class="td-cell-val">
              <div style="font-weight: 700; color: #fff;">${escapeHtml(item.client.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-400);">${escapeHtml(item.client.phone || item.client.cpf || '')}</div>
              ${promiseChip}
            </div>
          </td>
          <td data-label="Vencimento">
            <div class="td-cell-val">
              <div>${formatDate(item.dueDate)}</div>
              ${item.paidDate ? `<div style="font-size: 0.72rem; color: var(--green);">Pago em ${formatDate(item.paidDate)}</div>` : ''}
            </div>
          </td>
          <td data-label="Original" class="${!item.isOverdue && item.status !== 'partial' ? 'desktop-only-cell' : ''}">
            <div class="td-cell-val">${formatBRL(item.installmentAmount)}</div>
          </td>
          <td data-label="${item.isOverdue ? 'Com Atraso' : 'Valor'}">
            <div class="td-cell-val">${amountDisplay}</div>
          </td>
          <td class="td-actions" data-label="Ações">
            <div class="installment-actions-wrap">
              ${item.status !== 'paid' ? `
                <button class="btn btn-primary btn-sm btn-pay" data-id="${item.id}" title="Dar Baixa">
                  Baixar
                </button>
                <button class="btn btn-secondary btn-sm btn-inst-pix" data-id="${item.id}" title="Gerar PIX">
                  PIX
                </button>
                <button class="btn btn-whatsapp btn-sm btn-wpp" 
                  data-client="${encodeURIComponent(item.client.name)}"
                  data-phone="${escapeHtml(item.client.phone || '')}"
                  data-amount="${item.isOverdue ? item.lateCharges.totalUpdatedAmount : item.installmentAmount}"
                  data-number="${item.number}"
                  data-raw-date="${item.dueNorm}"
                  data-days="${item.isOverdue ? item.lateCharges.daysOverdue : 0}"
                  title="Cobrar via Régua WhatsApp">
                  WhatsApp
                </button>
                <button class="btn btn-secondary btn-sm btn-inst-promise" data-id="${item.id}" title="Agendar / Registrar Promessa de Pagamento">
                  ${icon('bell', 12)} ${item.promisedDate ? 'Alterar Promessa' : 'Promessa'}
                </button>
                <button class="btn btn-secondary btn-sm btn-inst-promissory" data-loan-id="${item.loanId}" data-inst-num="${item.number}" title="Emitir Nota Promissória">
                  Promissória
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm btn-receipt" data-id="${item.id}" title="Ver Recibo">
                  Recibo
                </button>
                ${adminAllowed ? `
                  <button class="btn btn-secondary btn-sm btn-revert" data-id="${item.id}" title="Estornar baixa" style="color: var(--red);">
                    Estornar
                  </button>
                ` : ''}
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachActionListeners(tbody);
  }

  function attachActionListeners(tbody) {
    tbody.querySelectorAll('.btn-wpp').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientName = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = Number(btn.dataset.amount || 0);
        const installmentNumber = btn.dataset.number;
        const rawDueDate = btn.dataset.rawDate;
        const daysOverdue = Number(btn.dataset.days || 0);

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

    tbody.querySelectorAll('.btn-inst-promise').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromiseModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPaymentModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openReceiptModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-inst-pix').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openPixModal) {
          window.openPixModal(btn.dataset.id);
        }
      });
    });

    tbody.querySelectorAll('.btn-inst-promissory').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromissoryModal(btn.dataset.loanId, btn.dataset.instNum);
      });
    });

    tbody.querySelectorAll('.btn-revert').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Deseja realmente estornar o pagamento desta parcela? Ela voltará para o status pendente.')) {
          state.revertPayment(btn.dataset.id);
          showToast('Pagamento estornado com sucesso.');
          window.refreshCurrentTab();
        }
      });
    });
  }

  setTimeout(() => {
    container.querySelector('#btn-renegociar-topo')?.addEventListener('click', () => {
      window.navigateToTab('renegotiation');
    });

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        renderTableRows(activeTab, container.querySelector('#search-input-parcelas').value);
      });
    });

    container.querySelector('#search-input-parcelas')?.addEventListener('input', (e) => {
      renderTableRows(activeTab, e.target.value);
    });

    container.querySelector('#btn-voltar-todas')?.addEventListener('click', () => {
      window.navigateToTab('installments');
    });

    renderTableRows(activeTab);
  }, 0);

  return container;
}
