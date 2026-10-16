// src/js/components/searchBar.js
// Componente de Busca Global com Modal Spotlight, Atalho Ctrl+K e Filtros em Tempo Real

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput } from '../utils.js';

let overlayElement = null;
let searchInput = null;
let resultsContainer = null;
let clearBtn = null;
let statsText = null;
let debounceTimeout = null;
let currentSelectedIndex = -1;
let currentResultsList = []; // Array de elementos de resultado para navegação por teclado

/**
 * Normaliza texto para busca insensível a acentos e maiúsculas
 */
function normalizeStr(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Cria o overlay global de busca e anexa ao DOM
 */
export function createSearchOverlay() {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement('div');
  overlay.className = 'global-search-overlay';
  overlay.id = 'global-search-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Busca Geral no Sistema');

  overlay.innerHTML = `
    <div class="global-search-modal">
      <div class="global-search-header">
        <div class="global-search-input-wrap">
          <span class="global-search-icon">🔍</span>
          <input 
            type="text" 
            id="global-search-field" 
            class="global-search-input" 
            placeholder="Buscar por cliente, CPF, contrato ou parcela... (ESC para fechar)"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="global-search-clear" id="global-search-clear" title="Limpar busca" style="display: none;">✕</button>
        </div>
        <button type="button" class="global-search-close" id="global-search-close" title="Fechar (ESC)">✕</button>
      </div>

      <div class="global-search-body" id="global-search-results">
        <!-- Preenchido dinamicamente -->
      </div>

      <div class="global-search-footer">
        <div class="global-search-shortcuts">
          <span class="search-key-badge"><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
          <span class="search-key-badge"><kbd>Enter</kbd> Abrir</span>
          <span class="search-key-badge"><kbd>ESC</kbd> Fechar</span>
        </div>
        <div class="global-search-stats" id="global-search-stats">
          Pressione <kbd>Ctrl</kbd> + <kbd>K</kbd> a qualquer momento
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlayElement = overlay;

  searchInput = overlay.querySelector('#global-search-field');
  resultsContainer = overlay.querySelector('#global-search-results');
  clearBtn = overlay.querySelector('#global-search-clear');
  statsText = overlay.querySelector('#global-search-stats');

  // Event Listeners
  const closeBtn = overlay.querySelector('#global-search-close');
  closeBtn.addEventListener('click', closeSearch);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchInput.focus();
    renderInitialState();
  });

  // Fechar ao clicar no backdrop (fora do modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSearch();
    }
  });

  // Input com debounce de 200ms
  searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    clearBtn.style.display = query ? 'block' : 'none';

    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      performSearch(query);
    }, 200);
  });

  // Navegação por teclado dentro do input
  searchInput.addEventListener('keydown', handleKeyNavigation);

  // Atalho global Ctrl+K / Cmd+K e ESC
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (overlay.classList.contains('active')) {
        closeSearch();
      } else {
        openSearch();
      }
    } else if (e.key === 'Escape' && overlay.classList.contains('active')) {
      e.preventDefault();
      closeSearch();
    }
  });

  // Estado inicial
  renderInitialState();

  return overlay;
}

/**
 * Abre o overlay e foca o campo de busca
 */
export function openSearch() {
  if (!overlayElement) {
    createSearchOverlay();
  }

  overlayElement.classList.add('active');
  document.body.classList.add('modal-open');

  if (searchInput) {
    searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    renderInitialState();
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 50);
  }
}

/**
 * Fecha o overlay de busca
 */
export function closeSearch() {
  if (overlayElement) {
    overlayElement.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

/**
 * Exibe tela inicial quando não há termo digitado
 */
function renderInitialState() {
  currentSelectedIndex = -1;
  currentResultsList = [];

  const clients = state.getClients();
  const loans = state.getLoans();
  const insts = state.getInstallments();

  const totalClients = clients.length;
  const activeLoans = loans.filter(l => l.status === 'active').length;
  const overdueInsts = insts.filter(i => i.status !== 'paid' && i.status !== 'renegotiated' && i.dueDate < formatDateForInput()).length;

  resultsContainer.innerHTML = `
    <div class="global-search-empty-prompt">
      <div class="search-empty-icon">⚡</div>
      <div class="search-empty-title">Busca Global do Sistema</div>
      <div class="search-empty-sub">
        Pesquise instantaneamente por nome ou CPF de clientes, número de contrato de empréstimo ou parcelas.
      </div>

      <div class="search-quick-stats-row">
        <div class="search-stat-pill" data-tab="clients">
          👥 <strong>${totalClients}</strong> Clientes
        </div>
        <div class="search-stat-pill" data-tab="loans">
          📄 <strong>${activeLoans}</strong> Empréstimos Ativos
        </div>
        <div class="search-stat-pill ${overdueInsts > 0 ? 'search-stat-pill--alert' : ''}" data-tab="installments">
          🚨 <strong>${overdueInsts}</strong> Parcelas em Atraso
        </div>
      </div>

      <div class="search-recent-title">Dicas Rápidas de Busca</div>
      <div class="search-hints-grid">
        <div class="search-hint-item">
          <span class="search-hint-badge">Nome</span>
          <span>Digite qualquer parte do nome do cliente</span>
        </div>
        <div class="search-hint-item">
          <span class="search-hint-badge">CPF</span>
          <span>Digite os dígitos com ou sem pontuação</span>
        </div>
        <div class="search-hint-item">
          <span class="search-hint-badge">Contrato</span>
          <span>Digite o ID ou "contrato" para filtrar empréstimos</span>
        </div>
        <div class="search-hint-item">
          <span class="search-hint-badge">Parcela</span>
          <span>Ex: "parcela 2" ou o vencimento</span>
        </div>
      </div>
    </div>
  `;

  // Atalhos nos pills rápidos
  resultsContainer.querySelectorAll('.search-stat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tab = pill.dataset.tab;
      closeSearch();
      if (window.navigateToTab) {
        if (tab === 'installments' && overdueInsts > 0) {
          window.navigateToTab('installments', { filter: 'overdue' });
        } else {
          window.navigateToTab(tab);
        }
      }
    });
  });

  if (statsText) {
    statsText.innerHTML = `Pressione <kbd>Ctrl</kbd> + <kbd>K</kbd> a qualquer momento`;
  }
}

/**
 * Executa a busca através dos dados do estado
 */
function performSearch(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    renderInitialState();
    return;
  }

  const normQuery = normalizeStr(query);
  const digitsQuery = query.replace(/\D/g, '');

  const clients = state.getClients();
  const loans = state.getLoans();
  const installments = state.getInstallments();
  const todayStr = formatDateForInput(new Date());

  // 1. Filtrar Clientes
  const matchedClients = clients.filter(c => {
    const nameNorm = normalizeStr(c.name);
    const cpfClean = String(c.cpf || '').replace(/\D/g, '');
    const phoneClean = String(c.phone || '').replace(/\D/g, '');
    const addressNorm = normalizeStr(c.address);

    const matchesName = nameNorm.includes(normQuery);
    const matchesCpf = c.cpf && (c.cpf.includes(query) || (digitsQuery.length >= 3 && cpfClean.includes(digitsQuery)));
    const matchesPhone = c.phone && (c.phone.includes(query) || (digitsQuery.length >= 4 && phoneClean.includes(digitsQuery)));
    const matchesAddress = addressNorm.includes(normQuery);

    return matchesName || matchesCpf || matchesPhone || matchesAddress;
  });

  // 2. Filtrar Empréstimos
  const matchedLoans = loans.filter(l => {
    const client = state.getClientById(l.clientId);
    const clientNameNorm = client ? normalizeStr(client.name) : '';
    const idNorm = normalizeStr(l.id);
    const notesNorm = normalizeStr(l.notes);

    const matchesId = idNorm.includes(normQuery);
    const matchesClient = clientNameNorm.includes(normQuery);
    const matchesNotes = notesNorm.includes(normQuery);

    return matchesId || matchesClient || matchesNotes;
  });

  // 3. Filtrar Parcelas
  const matchedInstallments = installments.filter(inst => {
    const client = state.getClientById(inst.clientId);
    const clientNameNorm = client ? normalizeStr(client.name) : '';
    const idNorm = normalizeStr(inst.id);
    const loanIdNorm = normalizeStr(inst.loanId);
    const dueDateNorm = formatDate(inst.dueDate);

    const matchesId = idNorm.includes(normQuery) || loanIdNorm.includes(normQuery);
    const matchesClient = clientNameNorm.includes(normQuery);
    const matchesNumber = (
      normQuery === String(inst.number) ||
      normQuery === `#${inst.number}` ||
      `parcela ${inst.number}`.includes(normQuery)
    );
    const matchesDate = dueDateNorm.includes(query);

    return matchesId || matchesClient || matchesNumber || matchesDate;
  });

  const totalResults = matchedClients.length + matchedLoans.length + matchedInstallments.length;

  if (totalResults === 0) {
    currentSelectedIndex = -1;
    currentResultsList = [];
    resultsContainer.innerHTML = `
      <div class="global-search-empty-prompt">
        <div class="search-empty-icon">🔎</div>
        <div class="search-empty-title">Nenhum resultado encontrado</div>
        <div class="search-empty-sub">
          Não encontramos nenhum registro para "<strong>${escapeHtml(query)}</strong>".
        </div>
        <div style="font-size: 0.8rem; color: var(--text-400); margin-top: 12px;">
          Tente pesquisar por termos mais curtos, apenas o primeiro nome ou os dígitos do CPF.
        </div>
      </div>
    `;
    if (statsText) {
      statsText.textContent = '0 resultados';
    }
    return;
  }

  // Renderiza resultados agrupados
  let html = '';
  const resultItems = [];

  // GRUPO 1: CLIENTES
  if (matchedClients.length > 0) {
    html += `
      <div class="search-group-header">
        <span class="search-group-title">👥 Clientes (${matchedClients.length})</span>
        <span class="search-group-tag">Cadastro</span>
      </div>
      <div class="search-group-items">
    `;

    matchedClients.slice(0, 8).forEach(c => {
      const clientLoans = loans.filter(l => l.clientId === c.id);
      const activeCount = clientLoans.filter(l => l.status === 'active').length;
      const itemId = `search-item-${resultItems.length}`;

      resultItems.push({
        type: 'client',
        data: c,
        action: () => {
          closeSearch();
          if (window.navigateToTab) {
            window.navigateToTab('clients', { search: c.name, clientId: c.id });
          }
        }
      });

      html += `
        <div class="search-result-item" id="${itemId}" data-index="${resultItems.length - 1}">
          <div class="search-item-icon-box search-icon-client">👤</div>
          <div class="search-item-main">
            <div class="search-item-title-row">
              <span class="search-item-title">${highlightMatch(c.name, query)}</span>
              <span class="badge ${activeCount > 0 ? 'badge-pending' : 'badge-paid'}">
                ${activeCount > 0 ? `${activeCount} contrato(s)` : 'Sem dívida'}
              </span>
            </div>
            <div class="search-item-desc">
              <span>CPF: <strong>${c.cpf ? highlightMatch(c.cpf, query) : 'Não inf.'}</strong></span>
              <span>•</span>
              <span>Tel: ${c.phone ? highlightMatch(c.phone, query) : '-'}</span>
              <span>•</span>
              <span>Limite: <strong style="color: var(--yellow);">${formatBRL(c.creditLimit || 0)}</strong></span>
            </div>
          </div>
          <div class="search-item-action-icon">→</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // GRUPO 2: EMPRÉSTIMOS
  if (matchedLoans.length > 0) {
    html += `
      <div class="search-group-header">
        <span class="search-group-title">📄 Empréstimos & Contratos (${matchedLoans.length})</span>
        <span class="search-group-tag">Contratos</span>
      </div>
      <div class="search-group-items">
    `;

    matchedLoans.slice(0, 6).forEach(l => {
      const client = state.getClientById(l.clientId) || { name: 'Cliente' };
      const itemId = `search-item-${resultItems.length}`;
      const isPaid = l.status === 'paid';

      resultItems.push({
        type: 'loan',
        data: l,
        action: () => {
          closeSearch();
          if (window.navigateToTab) {
            window.navigateToTab('loans', { tab: 'contratos', loanId: l.id });
          }
        }
      });

      html += `
        <div class="search-result-item" id="${itemId}" data-index="${resultItems.length - 1}">
          <div class="search-item-icon-box search-icon-loan">📄</div>
          <div class="search-item-main">
            <div class="search-item-title-row">
              <span class="search-item-title">${highlightMatch(client.name, query)}</span>
              <span class="badge ${isPaid ? 'badge-paid' : 'badge-pending'}">
                ${isPaid ? '✓ Quitado' : 'Em Andamento'}
              </span>
            </div>
            <div class="search-item-desc">
              <span>ID: <code class="search-code-id">${highlightMatch(l.id, query)}</code></span>
              <span>•</span>
              <span>${l.installmentsCount}x parcelas</span>
              <span>•</span>
              <span>Total: <strong style="color: var(--emerald-400);">${formatBRL(l.totalPayable)}</strong></span>
              ${l.notes ? `<span>• <em>${highlightMatch(l.notes, query)}</em></span>` : ''}
            </div>
          </div>
          <div class="search-item-action-icon">→</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // GRUPO 3: PARCELAS
  if (matchedInstallments.length > 0) {
    html += `
      <div class="search-group-header">
        <span class="search-group-title">💳 Parcelas (${matchedInstallments.length})</span>
        <span class="search-group-tag">Cobrança</span>
      </div>
      <div class="search-group-items">
    `;

    matchedInstallments.slice(0, 8).forEach(inst => {
      const client = state.getClientById(inst.clientId) || { name: 'Cliente' };
      const itemId = `search-item-${resultItems.length}`;
      
      let statusLabel = 'Pendente';
      let statusClass = 'badge-pending';

      if (inst.status === 'paid') {
        statusLabel = '✓ Paga';
        statusClass = 'badge-paid';
      } else if (inst.dueDate < todayStr) {
        statusLabel = '🚨 Atrasada';
        statusClass = 'badge-overdue';
      }

      resultItems.push({
        type: 'installment',
        data: inst,
        action: () => {
          closeSearch();
          if (window.navigateToTab) {
            window.navigateToTab('installments', { 
              loanId: inst.loanId,
              installmentId: inst.id
            });
          }
        }
      });

      html += `
        <div class="search-result-item" id="${itemId}" data-index="${resultItems.length - 1}">
          <div class="search-item-icon-box search-icon-inst">💳</div>
          <div class="search-item-main">
            <div class="search-item-title-row">
              <span class="search-item-title">${highlightMatch(client.name, query)} — Parcela nº ${inst.number}</span>
              <span class="badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="search-item-desc">
              <span>Vencimento: <strong>${formatDate(inst.dueDate)}</strong></span>
              <span>•</span>
              <span>Valor: <strong style="color: var(--yellow);">${formatBRL(inst.installmentAmount)}</strong></span>
              ${inst.paidAmount > 0 ? `<span>• Pago: ${formatBRL(inst.paidAmount)}</span>` : ''}
              <span>•</span>
              <span>Contrato: <code class="search-code-id">${inst.loanId}</code></span>
            </div>
          </div>
          <div class="search-item-action-icon">→</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  resultsContainer.innerHTML = html;
  currentResultsList = resultItems;
  currentSelectedIndex = -1;

  if (statsText) {
    statsText.innerHTML = `<strong>${totalResults}</strong> resultado(s) encontrado(s)`;
  }

  // Adiciona listeners de clique aos itens
  resultsContainer.querySelectorAll('.search-result-item').forEach(el => {
    const idx = parseInt(el.dataset.index, 10);
    el.addEventListener('click', () => {
      if (currentResultsList[idx] && currentResultsList[idx].action) {
        currentResultsList[idx].action();
      }
    });

    el.addEventListener('mouseenter', () => {
      setSelectedIndex(idx);
    });
  });

  // Se houver resultados, seleciona o primeiro
  if (currentResultsList.length > 0) {
    setSelectedIndex(0);
  }
}

/**
 * Controla navegação por setas (cima / baixo) e Enter
 */
function handleKeyNavigation(e) {
  if (currentResultsList.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = currentSelectedIndex + 1 >= currentResultsList.length ? 0 : currentSelectedIndex + 1;
    setSelectedIndex(nextIdx);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIdx = currentSelectedIndex - 1 < 0 ? currentResultsList.length - 1 : currentSelectedIndex - 1;
    setSelectedIndex(prevIdx);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentSelectedIndex >= 0 && currentResultsList[currentSelectedIndex]) {
      currentResultsList[currentSelectedIndex].action();
    }
  }
}

/**
 * Atualiza visualmente o item selecionado para navegação via teclado
 */
function setSelectedIndex(index) {
  currentSelectedIndex = index;

  resultsContainer.querySelectorAll('.search-result-item').forEach((el, idx) => {
    if (idx === index) {
      el.classList.add('selected');
      // Scroll suave para garantir visibilidade
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      el.classList.remove('selected');
    }
  });
}

/**
 * Destaca o termo pesquisado com tag mark
 */
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const rawText = String(text);
  const qClean = query.trim();
  if (!qClean) return escapeHtml(rawText);

  try {
    const regex = new RegExp(`(${escapeRegExp(qClean)})`, 'gi');
    return rawText.replace(regex, '<mark class="search-match">$1</mark>');
  } catch (err) {
    return escapeHtml(rawText);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
