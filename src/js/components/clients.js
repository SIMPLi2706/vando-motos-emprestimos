// src/js/components/clients.js
// Gestão Cadastral de Clientes, Limites e Dossiê Financeiro - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, showToast, escapeHtml } from '../utils.js';
import { generateClientReportPDF } from './pdfExport.js';
import { openDocumentScanner } from './documentScanner.js';
import { isAdmin } from './loginScreen.js';
import { icon } from '../icons.js';

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
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="btn-scan-doc-client-list" title="Escanear documento com a câmera (preenchimento automático)">
            ${icon('camera', 15)} Escanear CNH / RG
          </button>
          <button class="btn btn-primary" id="btn-novo-cliente">
            ${icon('plus', 16)}
            Novo Cliente
          </button>
        </div>
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
        <table class="table table-clean-mobile" id="table-clients">
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
        (c.phone && c.phone.includes(term)) ||
        (c.referredBy && c.referredBy.toLowerCase().includes(term))
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    const adminAllowed = isAdmin();
    emptyMsg.style.display = 'none';
    tbody.innerHTML = filtered.map(c => {
      const clientLoans = loans.filter(l => l.clientId === c.id);
      const activeLoans = clientLoans.filter(l => l.status === 'active');
      const clientInsts = installments.filter(i => i.clientId === c.id);
      const todayStr = new Date().toISOString().split('T')[0];
      const hasOverdue = clientInsts.some(i => i.status !== 'paid' && String(i.dueDate || '').split('T')[0] < todayStr);
      const scoreInfo = state.getClientScore(c.id);

      let statusBadge = `<span class="badge badge-paid">Bom Pagador</span>`;
      if (c.blocked) {
        statusBadge = `<span class="badge badge-overdue" title="${escapeHtml(c.blockedReason || 'Cliente com restrição')}">Bloqueado</span>`;
      } else if (hasOverdue) {
        statusBadge = `<span class="badge badge-overdue">Inadimplente</span>`;
      } else if (activeLoans.length === 0) {
        statusBadge = `<span class="badge badge-pending">Sem Dívida</span>`;
      }

      const initials = (c.name || 'C')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('') || 'CL';

      return `
        <tr>
          <!-- Visualização em Tabela para Computador / Telas Grandes -->
          <td class="desktop-table-cell" data-label="Cliente">
            <div class="td-cell-val">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">${escapeHtml(c.name)}</span>
                <span class="score-pill-sm" style="border-color: ${scoreInfo.color}; color: ${scoreInfo.color};">Score ${scoreInfo.grade}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-400);">
                CPF: ${escapeHtml(c.cpf || 'Não informado')}
                ${c.referredBy ? ` • Indicado por: <strong>${escapeHtml(c.referredBy)}</strong>` : ''}
              </div>
            </div>
          </td>
          <td class="desktop-table-cell" data-label="Telefone">
            <div class="td-cell-val">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>${escapeHtml(c.phone || '-')}</span>
                ${c.phone ? `
                  <a href="${createWhatsAppUrl(c.phone, `Olá, ${c.name}!`)}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding: 2px 8px; font-size: 0.72rem; min-height: 24px;">
                    WhatsApp
                  </a>
                ` : ''}
              </div>
            </div>
          </td>
          <td class="desktop-table-cell" data-label="Limite">
            <div class="td-cell-val">
              <span style="font-weight: 700; color: var(--yellow);">${formatBRL(c.creditLimit || 0)}</span>
            </div>
          </td>
          <td class="desktop-table-cell" data-label="Contratos">
            <div class="td-cell-val">
              <span style="font-weight: 700;">${activeLoans.length}</span> contrato(s)
            </div>
          </td>
          <td class="desktop-table-cell" data-label="Status">
            <div class="td-cell-val">${statusBadge}</div>
          </td>
          <td class="desktop-table-cell td-actions" data-label="Ações">
            <div class="client-actions-wrap">
              <button class="btn btn-secondary btn-sm btn-statement-client" data-id="${c.id}" title="Ver Extrato da Conta Corrente e Histórico de Juros" style="color: var(--yellow); border-color: rgba(245, 197, 24, 0.35);">
                ${icon('fileText', 14)} Extrato
              </button>
              <button class="btn btn-secondary btn-sm btn-edit-client" data-id="${c.id}" title="Editar Dados">
                Editar
              </button>
              <button class="btn btn-secondary btn-sm btn-pdf-client" data-id="${c.id}" title="Gerar Dossiê do Cliente (PDF)">
                PDF
              </button>
              <button class="btn btn-secondary btn-sm btn-reneg-client" data-id="${c.id}" title="Renegociar Dívidas">
                Renegociar
              </button>
              ${adminAllowed ? `
                <button class="btn btn-danger btn-sm btn-del-client" data-id="${c.id}" title="Excluir Cliente">
                  Excluir
                </button>
              ` : ''}
            </div>
          </td>

          <!-- Card Limpo, Organizado e Nativo para Celular -->
          <td class="mobile-card-cell" colspan="6">
            <div class="mobile-card-item">
              <div class="mcard-top">
                <div class="mcard-profile">
                  <div class="mcard-avatar">${initials}</div>
                  <div class="mcard-info">
                    <div class="mcard-name">${escapeHtml(c.name)}</div>
                    <div class="mcard-sub">
                      ${c.phone ? `${escapeHtml(c.phone)} • ` : ''}CPF: ${escapeHtml(c.cpf || 'Não informado')}
                    </div>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                  ${statusBadge}
                  <span class="score-pill-sm" style="border-color: ${scoreInfo.color}; color: ${scoreInfo.color}; font-size: 0.68rem; padding: 1px 6px;">Score ${scoreInfo.grade}</span>
                </div>
              </div>

              <div class="mcard-body-metrics">
                <div>
                  <span style="color: var(--text-400); font-size: 0.72rem;">Limite:</span>
                  <strong style="color: var(--yellow);">${formatBRL(c.creditLimit || 0)}</strong>
                </div>
                <div>
                  <span style="color: var(--text-400); font-size: 0.72rem;">Contratos:</span>
                  <strong>${activeLoans.length} ativo${activeLoans.length !== 1 ? 's' : ''}</strong>
                </div>
                ${c.referredBy ? `
                  <div style="font-size: 0.72rem; color: var(--text-400);">
                    Ind: <strong>${escapeHtml(c.referredBy)}</strong>
                  </div>
                ` : ''}
              </div>

              <div class="mcard-actions-row">
                ${c.phone ? `
                  <a href="${createWhatsAppUrl(c.phone, `Olá, ${c.name}!`)}" target="_blank" class="btn btn-whatsapp btn-sm" title="Conversar no WhatsApp">
                    ${icon('whatsapp', 13)} WhatsApp
                  </a>
                ` : ''}
                <button class="btn btn-secondary btn-sm btn-statement-client" data-id="${c.id}" title="Ver Extrato e Juros">
                  ${icon('fileText', 13)} Extrato
                </button>
                <button class="btn btn-secondary btn-sm btn-edit-client" data-id="${c.id}" title="Editar Dados">
                  ${icon('edit', 13)} Editar
                </button>
                <button type="button" class="btn-more-options btn-client-more" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Mais opções">
                  •••
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Listener para o Menu de Mais Opções no Celular
    tbody.querySelectorAll('.btn-client-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.dataset.id;
        const clientName = btn.dataset.name;
        const c = clients.find(item => item.id === clientId);
        if (window.openActionSheet) {
          window.openActionSheet({
            title: clientName || 'Opções do Cliente',
            subtitle: `CPF: ${c?.cpf || 'Não informado'} • Limite: ${formatBRL(c?.creditLimit || 0)}`,
            items: [
              {
                icon: icon('fileText', 18),
                label: 'Dossiê do Cliente em PDF',
                description: 'Relatório completo para impressão e envio',
                onClick: () => generateClientReportPDF(clientId)
              },
              {
                icon: icon('refresh', 18),
                label: 'Renegociar Dívidas',
                description: 'Criar acordo ou refinanciamento das parcelas',
                onClick: () => window.navigateToTab('renegotiation', { clientId })
              },
              ...(adminAllowed ? [{
                icon: icon('trash', 18),
                label: 'Excluir Cliente',
                description: 'Remover cadastro e dados vinculados',
                danger: true,
                onClick: () => {
                  const delBtn = tbody.querySelector(`.btn-del-client[data-id="${clientId}"]`);
                  if (delBtn) delBtn.click();
                }
              }] : [])
            ]
          });
        }
      });
    });

    tbody.querySelectorAll('.btn-statement-client').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openClientStatementModal) {
          window.openClientStatementModal(btn.dataset.id);
        }
      });
    });

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

    container.querySelector('#btn-scan-doc-client-list')?.addEventListener('click', () => {
      openDocumentScanner((extracted) => {
        window.openClientModal(null, extracted);
      });
    });

    container.querySelector('#search-input-clients')?.addEventListener('input', (e) => {
      renderRows(e.target.value);
    });

    renderRows();
  }, 0);

  return container;
}
