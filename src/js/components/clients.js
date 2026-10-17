// src/js/components/clients.js
// Gestão Cadastral de Clientes, Limites e Dossiê Financeiro - Vando Motos Locadora LTDA

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Novo Cliente
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
              <th>Contratos Ativos</th>
              <th>Status</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            <!-- Preenchido via script -->
          </tbody>
        </table>
      </div>

      <div id="empty-clients-msg" class="empty-state-box" style="display: none;">
        <p>Nenhum cliente encontrado.</p>
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
            <div class="td-cell-val">
              <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${c.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-400);">CPF: ${c.cpf || 'Não informado'}</div>
            </div>
          </td>
          <td data-label="Telefone">
            <div class="td-cell-val">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>${c.phone || '-'}</span>
                ${c.phone ? `
                  <a href="${createWhatsAppUrl(c.phone, `Olá, ${c.name}!`)}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding: 2px 8px; font-size: 0.72rem; min-height: 24px;">
                    WhatsApp
                  </a>
                ` : ''}
              </div>
            </div>
          </td>
          <td data-label="Limite">
            <div class="td-cell-val">
              <span style="font-weight: 700; color: var(--yellow);">${formatBRL(c.creditLimit || 0)}</span>
            </div>
          </td>
          <td data-label="Contratos">
            <div class="td-cell-val">
              <span style="font-weight: 700;">${activeLoans.length}</span> contrato(s)
            </div>
          </td>
          <td data-label="Status">
            <div class="td-cell-val">${statusBadge}</div>
          </td>
          <td class="td-actions" data-label="Ações">
            <div class="client-actions-wrap">
              <button class="btn btn-secondary btn-sm btn-edit-client" data-id="${c.id}" title="Editar Dados">
                Editar
              </button>
              <button class="btn btn-secondary btn-sm btn-pdf-client" data-id="${c.id}" title="Gerar Dossiê do Cliente (PDF)">
                PDF
              </button>
              <button class="btn btn-secondary btn-sm btn-reneg-client" data-id="${c.id}" title="Renegociar Dívidas">
                Renegociar
              </button>
              <button class="btn btn-danger btn-sm btn-del-client" data-id="${c.id}" title="Excluir Cliente">
                Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

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
      btn.addEventListener('click', async () => {
        const client = state.getClientById(btn.dataset.id);
        if (!client) return;

        const clientLoans = state.getLoans().filter(l => l.clientId === client.id);
        let confirmMsg = `Tem certeza que deseja excluir o cliente ${client.name}?`;
        if (clientLoans.length > 0) {
          confirmMsg = `O cliente ${client.name} possui ${clientLoans.length} empréstimo(s) registrado(s).\n\nDeseja excluir o cliente e TODOS os seus contratos e parcelas vinculados?`;
        }

        if (confirm(confirmMsg)) {
          try {
            await state.deleteClient(btn.dataset.id, true);
            showToast('Cliente e contratos excluídos com sucesso.', 'success');
            window.refreshCurrentTab();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  setTimeout(() => {
    container.querySelector('#btn-novo-cliente')?.addEventListener('click', () => {
      window.openClientModal();
    });

    container.querySelector('#search-input-clients')?.addEventListener('input', (e) => {
      renderRows(e.target.value);
    });

    renderRows();
  }, 0);

  return container;
}
