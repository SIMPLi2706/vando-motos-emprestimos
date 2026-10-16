// src/js/components/clients.js
// Gestão Cadastral de Clientes, Limites e Dossiê Financeiro

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, showToast } from '../utils.js';
import { generateClientReportPDF } from './pdfExport.js';

export function renderClients(options = {}) {
  const container = document.createElement('div');
  container.className = 'clients-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Carteira de Clientes (${clients.length})</h3>
          <p class="card-subtitle">Cadastro, limites de crédito e histórico financeiro</p>
        </div>
        <button class="btn btn-primary" id="btn-novo-cliente">
          ➕ Novo Cliente
        </button>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar-wrap">
        <div class="search-input-box">
          <span class="search-icon-inside">🔍</span>
          <input type="text" class="form-control" id="search-input-clients" placeholder="Buscar por nome, CPF ou telefone...">
        </div>
      </div>

      <!-- Lista / Tabela de Clientes -->
      <div class="table-responsive">
        <table class="table table-mobile-card-view" id="table-clients">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Limite Aprovado</th>
              <th>Empréstimos Ativos</th>
              <th>Status</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            <!-- Preenchido via script -->
          </tbody>
        </table>
      </div>

      <div id="empty-clients-msg" style="display: none; text-align: center; padding: 40px; color: var(--text-dim);">
        Nenhum cliente encontrado.
      </div>
    </div>
  `;

  function renderRows(searchTerm = '') {
    const tbody = container.querySelector('#table-clients tbody');
    const emptyMsg = container.querySelector('#empty-clients-msg');
    const term = searchTerm.toLowerCase().trim();

    let filtered = clients.filter(c => {
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.cpf && c.cpf.includes(term)) ||
        (c.phone && c.phone.includes(term))
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    tbody.innerHTML = filtered.map(c => {
      const clientLoans = loans.filter(l => l.clientId === c.id);
      const activeLoans = clientLoans.filter(l => l.status === 'active');
      const clientInsts = installments.filter(i => i.clientId === c.id);
      const hasOverdue = clientInsts.some(i => i.status !== 'paid' && new Date(i.dueDate) < new Date());

      let statusBadge = `<span class="badge badge-paid">Bom Pagador</span>`;
      if (hasOverdue) {
        statusBadge = `<span class="badge badge-overdue">Inadimplente</span>`;
      } else if (activeLoans.length === 0) {
        statusBadge = `<span class="badge badge-pending">Sem Dívida</span>`;
      }

      return `
        <tr>
          <td data-label="Cliente">
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${c.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">
              CPF: ${c.cpf || 'Não informado'} ${c.address ? `• ${c.address}` : ''}
            </div>
          </td>
          <td data-label="Telefone">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>${c.phone || '-'}</span>
              ${c.phone ? `
                <a href="${createWhatsAppUrl(c.phone, `Olá, ${c.name}! Tudo bem?`)}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding: 2px 6px; font-size: 0.7rem; min-height: 24px;">
                  Wpp
                </a>
              ` : ''}
            </div>
          </td>
          <td data-label="Limite">
            <span style="font-weight: 600; color: var(--brand-yellow);">${formatBRL(c.creditLimit || 0)}</span>
          </td>
          <td data-label="Contratos">
            <span style="font-weight: 700;">${activeLoans.length}</span> contrato(s)
          </td>
          <td data-label="Status">${statusBadge}</td>
          <td class="td-actions" data-label="Ações">
            <div class="client-actions-wrap">
              <button class="btn btn-secondary btn-sm btn-pdf-client" data-id="${c.id}" title="Gerar Dossiê do Cliente (PDF)">
                📄 PDF
              </button>
              <button class="btn btn-secondary btn-sm btn-reneg-client" data-id="${c.id}" title="Renegociar Dívidas deste Cliente" style="color: var(--amber-400);">
                🔄 Acordo
              </button>
              <button class="btn btn-secondary btn-sm btn-edit-client" data-id="${c.id}" title="Editar Dados">
                ✏️ Editar
              </button>
              <button class="btn btn-danger btn-sm btn-del-client" data-id="${c.id}" title="Excluir Cliente">
                🗑️ Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Listeners
    tbody.querySelectorAll('.btn-pdf-client').forEach(btn => {
      btn.addEventListener('click', () => {
        generateClientReportPDF(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-reneg-client').forEach(btn => {
      btn.addEventListener('click', () => {
        window.navigateToTab('renegotiation', { clientId: btn.dataset.id });
      });
    });

    tbody.querySelectorAll('.btn-edit-client').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openClientModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-del-client').forEach(btn => {
      btn.addEventListener('click', () => {
        const client = state.getClientById(btn.dataset.id);
        if (confirm(`Tem certeza que deseja excluir o cliente ${client?.name}?`)) {
          try {
            state.deleteClient(btn.dataset.id);
            showToast('Cliente excluído com sucesso.');
            window.refreshCurrentTab();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  setTimeout(() => {
    container.querySelector('#btn-novo-cliente').addEventListener('click', () => {
      window.openClientModal();
    });

    const searchInput = container.querySelector('#search-input-clients');
    searchInput.addEventListener('input', (e) => {
      renderRows(e.target.value);
    });

    const initialSearch = options.search || '';
    if (initialSearch) {
      searchInput.value = initialSearch;
    }
    renderRows(initialSearch);
  }, 0);

  return container;
}
