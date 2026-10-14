// src/js/components/installments.js
// Gestão Geral de Parcelas, Filtros, Cobrança e Ações de Baixa

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, formatDateForInput, showToast } from '../utils.js';
import { calculateLateCharges } from '../finance.js';

export function renderInstallments(options = {}) {
  const container = document.createElement('div');
  container.className = 'installments-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  let installments = state.getInstallments();
  const settings = state.getSettings();

  const todayStr = formatDateForInput(new Date());

  // Se veio filtrado por um empréstimo específico
  if (options.loanId) {
    installments = installments.filter(i => i.loanId === options.loanId);
  }

  // Prepara dados calculados para cada parcela
  const enrichedList = installments.map(inst => {
    const client = state.getClientById(inst.clientId) || { name: 'Cliente Removido', phone: '' };
    const loan = state.getLoanById(inst.loanId) || { notes: '' };

    let isOverdue = false;
    let isToday = false;
    let lateCharges = null;

    if (inst.status !== 'paid') {
      if (inst.dueDate < todayStr) {
        isOverdue = true;
        lateCharges = calculateLateCharges(
          inst,
          new Date(),
          loan.penaltyRate || settings.defaultPenaltyRate,
          loan.dailyInterestRate || settings.defaultDailyRate
        );
      } else if (inst.dueDate === todayStr) {
        isToday = true;
      }
    }

    return {
      ...inst,
      client,
      loan,
      isOverdue,
      isToday,
      lateCharges
    };
  });

  // Contadores para as abas
  const totalCount = enrichedList.length;
  const overdueCount = enrichedList.filter(i => i.isOverdue).length;
  const todayCount = enrichedList.filter(i => i.isToday).length;
  const pendingCount = enrichedList.filter(i => i.status === 'pending').length;
  const paidCount = enrichedList.filter(i => i.status === 'paid').length;

  // Filtro padrão inicial
  let activeTab = options.filter || 'all';

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Gestão de Parcelas & Cobrança</h3>
          <p class="card-subtitle">
            ${options.loanId ? `Exibindo parcelas do contrato selecionado` : 'Controle geral de recebimentos e baixas'}
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-renegociar-topo" style="color: var(--amber-400);">
            🔄 Renegociar Dívida
          </button>
          ${options.loanId ? `
            <button class="btn btn-secondary btn-sm" id="btn-voltar-todas">
              ← Ver Todas as Parcelas
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Abas de Filtros de Status -->
      <div class="tabs-bar">
        <button class="tab-btn ${activeTab === 'all' ? 'active' : ''}" data-tab="all">
          Todas (${totalCount})
        </button>
        <button class="tab-btn ${activeTab === 'overdue' ? 'active' : ''}" data-tab="overdue" style="color: var(--rose-400);">
          🚨 Atrasadas (${overdueCount})
        </button>
        <button class="tab-btn ${activeTab === 'today' ? 'active' : ''}" data-tab="today" style="color: var(--amber-400);">
          📅 Vencem Hoje (${todayCount})
        </button>
        <button class="tab-btn ${activeTab === 'pending' ? 'active' : ''}" data-tab="pending">
          Pendentes (${pendingCount})
        </button>
        <button class="tab-btn ${activeTab === 'paid' ? 'active' : ''}" data-tab="paid" style="color: var(--emerald-400);">
          ✓ Pagas (${paidCount})
        </button>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar-wrap">
        <div class="search-input-box">
          <span class="search-icon-inside">🔍</span>
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
              <th>Valor Atual / Pago</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            <!-- Preenchido dinamicamente -->
          </tbody>
        </table>
      </div>

      <div id="empty-parcelas-msg" style="display: none; text-align: center; padding: 40px; color: var(--text-dim);">
        Nenhuma parcela encontrada com os filtros atuais.
      </div>
    </div>
  `;

  // Função interna para renderizar as linhas da tabela
  function renderTableRows(filterTab, searchTerm = '') {
    const tbody = container.querySelector('#table-parcelas tbody');
    const emptyMsg = container.querySelector('#empty-parcelas-msg');
    const term = searchTerm.toLowerCase().trim();

    let filtered = enrichedList.filter(item => {
      // Filtro por aba
      if (filterTab === 'overdue' && !item.isOverdue) return false;
      if (filterTab === 'today' && !item.isToday) return false;
      if (filterTab === 'pending' && item.status !== 'pending') return false;
      if (filterTab === 'paid' && item.status !== 'paid') return false;

      // Filtro por termo de busca
      if (term) {
        const matchName = item.client.name.toLowerCase().includes(term);
        const matchPhone = (item.client.phone || '').includes(term);
        const matchCPF = (item.client.cpf || '').includes(term);
        const matchNum = String(item.number).includes(term);
        if (!matchName && !matchPhone && !matchCPF && !matchNum) return false;
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
        badgeHtml = `<span class="badge badge-paid">✓ Pago</span>`;
        amountDisplay = `<span style="font-weight: 700; color: var(--emerald-400);">${formatBRL(item.paidAmount)}</span>`;
      } else if (item.isOverdue) {
        badgeHtml = `<span class="badge badge-overdue">🚨 Atrasada (${item.lateCharges.daysOverdue}d)</span>`;
        amountDisplay = `
          <div style="font-weight: 800; color: var(--rose-400);">${formatBRL(item.lateCharges.totalUpdatedAmount)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">(+${formatBRL(item.lateCharges.totalLateCharges)} juros/multa)</div>
        `;
      } else if (item.isToday) {
        badgeHtml = `<span class="badge badge-today">Hoje</span>`;
        amountDisplay = `<span style="font-weight: 700; color: var(--amber-400);">${formatBRL(item.installmentAmount)}</span>`;
      } else if (item.status === 'partial') {
        const saldoRestante = Number(item.installmentAmount) - Number(item.paidAmount);
        badgeHtml = `<span class="badge badge-partial">Parcial</span>`;
        amountDisplay = `
          <div style="font-weight: 700; color: #60a5fa;">Restante: ${formatBRL(saldoRestante)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">Pago: ${formatBRL(item.paidAmount)}</div>
        `;
      } else {
        badgeHtml = `<span class="badge badge-pending">Pendente</span>`;
        amountDisplay = `<span style="font-weight: 600;">${formatBRL(item.installmentAmount)}</span>`;
      }

      return `
        <tr>
          <td data-label="Status">${badgeHtml}</td>
          <td data-label="Parcela" style="font-weight: 700;">#${item.number}</td>
          <td data-label="Cliente">
            <div style="font-weight: 700; color: #fff;">${item.client.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${item.client.phone || item.client.cpf || ''}</div>
          </td>
          <td data-label="Vencimento">
            <div>${formatDate(item.dueDate)}</div>
            ${item.paidDate ? `<div style="font-size: 0.72rem; color: var(--emerald-400);">Pago em ${formatDate(item.paidDate)}</div>` : ''}
          </td>
          <td data-label="Valor Original">${formatBRL(item.installmentAmount)}</td>
          <td data-label="Valor Atual">${amountDisplay}</td>
          <td class="td-actions" data-label="Ações">
            <div class="installment-actions-wrap">
              
              <!-- Botão Nota Promissória -->
              <button class="btn btn-secondary btn-sm btn-inst-promissory" data-loan-id="${item.loanId}" data-inst-num="${item.number}" title="Emitir Nota Promissória desta Parcela">
                📄 Promissória
              </button>

              <!-- Botão PIX QR Code & Copia e Cola -->
              ${item.status !== 'paid' ? `
                <button class="btn btn-secondary btn-sm btn-inst-pix" data-id="${item.id}" title="Gerar QR Code e Copia e Cola PIX">
                  <span style="color: var(--brand-yellow);">⚡</span> PIX
                </button>
              ` : ''}

              <!-- Botão WhatsApp se pendente ou atrasada -->
              ${item.status !== 'paid' ? `
                <button class="btn btn-whatsapp btn-sm btn-wpp" 
                  data-client="${encodeURIComponent(item.client.name)}"
                  data-phone="${item.client.phone}"
                  data-amount="${item.isOverdue ? item.lateCharges.totalUpdatedAmount : item.installmentAmount}"
                  data-number="${item.number}"
                  data-date="${formatDate(item.dueDate)}"
                  data-overdue="${item.isOverdue}"
                  data-days="${item.isOverdue ? item.lateCharges.daysOverdue : 0}"
                  title="Cobrar via WhatsApp">
                  WhatsApp
                </button>
              ` : ''}

              <!-- Botão Dar Baixa se pendente/parcial/atrasada -->
              ${item.status !== 'paid' ? `
                <button class="btn btn-primary btn-sm btn-pay" data-id="${item.id}" title="Receber Pagamento">
                  Baixar
                </button>
              ` : `
                <!-- Botão Recibo se paga -->
                <button class="btn btn-secondary btn-sm btn-receipt" data-id="${item.id}" title="Ver Recibo de Pagamento">
                  Recibo
                </button>
                <button class="btn btn-secondary btn-sm btn-revert" data-id="${item.id}" title="Estornar baixa" style="color: var(--rose-400);">
                  ↩ Estornar
                </button>
              `}

            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Reanexa listeners dos botões gerados
    attachActionListeners(tbody);
  }

  function attachActionListeners(tbody) {
    // WhatsApp
    tbody.querySelectorAll('.btn-wpp').forEach(btn => {
      btn.addEventListener('click', () => {
        const client = decodeURIComponent(btn.dataset.client);
        const phone = btn.dataset.phone;
        const amount = formatBRL(btn.dataset.amount);
        const number = btn.dataset.number;
        const date = btn.dataset.date;
        const isOverdue = btn.dataset.overdue === 'true';
        const days = btn.dataset.days;

        let msg = '';
        if (isOverdue) {
          msg = `Olá, ${client}! Notamos que a parcela nº ${number} (vencida em ${date}, há ${days} dias) ainda não foi liquidada. O valor atualizado para quitação hoje é ${amount}.\n\nChave PIX: ${settings.pixKey} (${settings.pixHolder})\n\nPor gentileza, envie o comprovante após a transferência.`;
        } else {
          msg = settings.whatsappTemplate
            .replace('{cliente}', client)
            .replace('{parcela_num}', number)
            .replace('{valor_parcela}', amount)
            .replace('{data_vencimento}', date)
            .replace('{chave_pix}', settings.pixKey)
            .replace('{titular_pix}', settings.pixHolder);
        }

        const url = createWhatsAppUrl(phone, msg);
        if (url) window.open(url, '_blank');
      });
    });

    // Baixa
    tbody.querySelectorAll('.btn-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPaymentModal(btn.dataset.id);
      });
    });

    // Recibo
    tbody.querySelectorAll('.btn-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openReceiptModal(btn.dataset.id);
      });
    });

    // PIX QR Code & Copia e Cola
    tbody.querySelectorAll('.btn-inst-pix').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openPixModal) {
          window.openPixModal(btn.dataset.id);
        }
      });
    });

    // Promissória Individual da Parcela
    tbody.querySelectorAll('.btn-inst-promissory').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromissoryModal(btn.dataset.loanId, btn.dataset.instNum);
      });
    });

    // Estorno
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

  // Event Listeners locais
  setTimeout(() => {
    // Botão de Renegociação no topo
    const btnRenegTopo = container.querySelector('#btn-renegociar-topo');
    if (btnRenegTopo) {
      btnRenegTopo.addEventListener('click', () => {
        window.navigateToTab('renegotiation');
      });
    }
    // Clique nas abas
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        renderTableRows(activeTab, container.querySelector('#search-input-parcelas').value);
      });
    });

    // Busca ao digitar
    const searchInput = container.querySelector('#search-input-parcelas');
    searchInput.addEventListener('input', (e) => {
      renderTableRows(activeTab, e.target.value);
    });

    // Voltar para todas
    const btnVoltar = container.querySelector('#btn-voltar-todas');
    if (btnVoltar) {
      btnVoltar.addEventListener('click', () => {
        window.navigateToTab('installments');
      });
    }

    // Render inicial
    renderTableRows(activeTab);
  }, 0);

  return container;
}
