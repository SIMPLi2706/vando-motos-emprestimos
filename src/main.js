// src/main.js
// Ponto de Entrada da Aplicação e Roteamento de Telas - Vando Motos Locadora LTDA

import { createLoginScreen, isAuthenticated } from './js/components/loginScreen.js';
import { state } from './js/state.js';
import { renderDashboard } from './js/components/dashboard.js';
import { renderLoans } from './js/components/loans.js';
import { renderInstallments } from './js/components/installments.js';
import { renderRenegotiation } from './js/components/renegotiation.js';
import { renderClients } from './js/components/clients.js';
import { renderReports } from './js/components/reports.js';
import { renderSettings } from './js/components/settings.js';
import { createPaymentModal } from './js/components/paymentModal.js';
import { createClientModal } from './js/components/clientModal.js';
import { createReceiptModal } from './js/components/receiptModal.js';
import { createPixModal } from './js/pix.js';
import { createCashRegisterModal } from './js/components/cashRegisterModal.js';
import { createSearchOverlay, openSearch, closeSearch } from './js/components/searchBar.js';
import { formatDateForInput } from './js/utils.js';
import { generateMonthlyReportPDF, generateClientReportPDF, openMonthlyReportModal } from './js/components/pdfExport.js';

// Desativa restauração automática de rolagem do navegador para que a página sempre inicie no topo
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;

window.addEventListener('pageshow', () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

// Callback exportado disparado após autenticação bem-sucedida pelo PIN
export function onAuthSuccess() {
  updateBrandDisplay();
  navigateToTab('dashboard');
  window.scrollTo(0, 0);
}
export const onLoginSuccess = onAuthSuccess;

// Inicializa a tela de login por PIN antes de qualquer outra inicialização
createLoginScreen(onAuthSuccess);

let currentTab = 'dashboard';
let currentTabOptions = {};

// Inicializa os Modais Globais
createPaymentModal();
createClientModal();
createReceiptModal();
createPixModal();
createCashRegisterModal();
createSearchOverlay();

let navTransitionTimeout = null;
let navEnterTimeout = null;

// Roteamento de Abas
export function navigateToTab(tabName, options = {}) {
  currentTab = tabName;
  currentTabOptions = options;

  const contentView = document.getElementById('main-content-view');
  const titleEl = document.getElementById('top-page-title');
  const subtitleEl = document.getElementById('top-page-subtitle');

  // Atualiza botões ativos na Sidebar e no Mobile Nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Fecha a gaveta mobile se estiver aberta
  closeMobileDrawer();

  const renderContent = () => {
    // Limpa o conteúdo anterior e classes de transição
    contentView.innerHTML = '';
    contentView.classList.remove('page-transition-exit');

    // Força rolagem para o topo absoluto (0, 0) ao renderizar a aba
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Renderiza a tela selecionada
    switch (tabName) {
      case 'dashboard':
        titleEl.textContent = 'Painel Geral';
        subtitleEl.textContent = 'Vando motos locadora LTDA • Acompanhamento em tempo real';
        contentView.appendChild(renderDashboard());
        break;

      case 'loans':
        titleEl.textContent = 'Simular & Empréstimos';
        subtitleEl.textContent = 'Simulador de parcelas e emissão de contratos & promissórias';
        contentView.appendChild(renderLoans(options));
        break;

      case 'installments':
        titleEl.textContent = 'Parcelas & Cobrança';
        subtitleEl.textContent = 'Recebimentos, baixas, PIX Copia e Cola e WhatsApp';
        contentView.appendChild(renderInstallments(options));
        break;

      case 'renegotiation':
        titleEl.textContent = 'Renegociação de Dívidas';
        subtitleEl.textContent = 'Agrupar parcelas em atraso em um novo contrato formal';
        contentView.appendChild(renderRenegotiation(options.clientId));
        break;

      case 'clients':
        titleEl.textContent = 'Gestão de Clientes';
        subtitleEl.textContent = 'Cadastro de clientes, limites e histórico financeiro';
        contentView.appendChild(renderClients(options));
        break;

      case 'reports':
        titleEl.textContent = 'Relatórios Financeiros';
        subtitleEl.textContent = 'Indicadores de receita, inadimplência e evolução do capital';
        contentView.appendChild(renderReports());
        break;

      case 'settings':
        titleEl.textContent = 'Configurações do Sistema';
        subtitleEl.textContent = 'Vando motos locadora LTDA • CNPJ 28.623.431-0001-23 • Chave PIX e backups';
        contentView.appendChild(renderSettings());
        break;

      default:
        titleEl.textContent = 'Painel Geral';
        subtitleEl.textContent = 'Acompanhamento financeiro';
        contentView.appendChild(renderDashboard());
        break;
    }

    updateOverdueBadge();

    // Animação de entrada
    contentView.classList.add('page-transition-enter');
    void contentView.offsetHeight;
    requestAnimationFrame(() => {
      contentView.classList.add('page-transition-active');
      contentView.classList.remove('page-transition-enter');

      if (navEnterTimeout) clearTimeout(navEnterTimeout);
      navEnterTimeout = setTimeout(() => {
        contentView.classList.remove('page-transition-active');
      }, 300);
    });
  };

  if (navTransitionTimeout) {
    clearTimeout(navTransitionTimeout);
    navTransitionTimeout = null;
  }

  // Executa animação de saída se houver conteúdo atual
  if (contentView && contentView.children.length > 0) {
    contentView.classList.remove('page-transition-enter', 'page-transition-active');
    contentView.classList.add('page-transition-exit');
    navTransitionTimeout = setTimeout(() => {
      renderContent();
    }, 150);
  } else if (contentView) {
    renderContent();
  }
}

export function refreshCurrentTab() {
  navigateToTab(currentTab, currentTabOptions);
}

export function updateBrandDisplay() {
  const settings = state.getSettings();
  const brandTitle = document.getElementById('display-brand-title');
  const footerBusiness = document.getElementById('footer-business-name');

  if (brandTitle) {
    brandTitle.textContent = 'Vando Motos';
  }
  if (footerBusiness && settings.businessName) {
    footerBusiness.textContent = settings.businessName;
  }
}

function updateOverdueBadge() {
  const todayStr = formatDateForInput(new Date());
  const insts = state.getInstallments();
  const overdueCount = insts.filter(i => i.status !== 'paid' && i.status !== 'renegotiated' && i.dueDate < todayStr).length;

  const badge = document.getElementById('badge-overdue-count');
  if (badge) {
    if (overdueCount > 0) {
      badge.textContent = overdueCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ============================================================
// Controle de Scroll Lock e Efeito Blur no Fundo (Robusto & Leve)
// ============================================================
const sidebar = document.getElementById('app-sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
const closeSidebarBtn = document.getElementById('btn-close-sidebar');

export function updateScrollLockState() {
  const isDrawerOpen = sidebar && sidebar.classList.contains('open');
  const hasActiveModal = !!document.querySelector('.modal-overlay.active, .global-search-overlay.active');

  // Adiciona / remove classes de efeito visual
  if (isDrawerOpen) {
    document.body.classList.add('drawer-open');
  } else {
    document.body.classList.remove('drawer-open');
  }

  if (hasActiveModal) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }

  // Trava a rolagem do documento apenas quando houver drawer ou modal aberto
  if (isDrawerOpen || hasActiveModal) {
    document.documentElement.classList.add('scroll-locked');
    document.body.classList.add('scroll-locked');
  } else {
    document.documentElement.classList.remove('scroll-locked');
    document.body.classList.remove('scroll-locked');
  }
}

export function openMobileDrawer() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.add('open');
  backdrop.classList.add('open');
  updateScrollLockState();
}

export function closeMobileDrawer() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove('open');
  backdrop.classList.remove('open');
  updateScrollLockState();
}

// Aliases para compatibilidade
export const lockBodyScroll = () => updateScrollLockState();
export const unlockBodyScroll = () => updateScrollLockState();
window.lockBodyScroll = lockBodyScroll;
window.unlockBodyScroll = unlockBodyScroll;
window.openMobileDrawer = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;
window.updateScrollLockState = updateScrollLockState;

// Event listeners do menu mobile
if (mobileToggleBtn) {
  mobileToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMobileDrawer();
  });
}

if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileDrawer();
  });
}

if (backdrop) {
  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileDrawer();
  });

  // Previne arrastar a tela através do backdrop vazio
  backdrop.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}

// Fecha ao pressionar ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (sidebar && sidebar.classList.contains('open')) {
      closeMobileDrawer();
    }
  }
});

// Observador para modais: monitora APENAS elementos modais (NUNCA observa atributos do body para evitar loop)
const modalObserver = new MutationObserver(() => {
  updateScrollLockState();
});

// Registra modais já existentes
document.querySelectorAll('.modal-overlay, .global-search-overlay').forEach(modal => {
  modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
});

// Se novos modais forem anexados ao body dinamicamente, registra-os no observer
const bodyChildObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1 && (node.classList.contains('modal-overlay') || node.classList.contains('global-search-overlay'))) {
        modalObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
        updateScrollLockState();
      }
    }
  }
});
bodyChildObserver.observe(document.body, { childList: true });

// Previne arrastar o fundo fora do card do modal
document.addEventListener('touchmove', (e) => {
  if (e.target && (e.target.classList.contains('modal-overlay') || e.target.classList.contains('global-search-overlay'))) {
    e.preventDefault();
  }
}, { passive: false });

// Listeners de Navegação (Sidebar)
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    closeMobileDrawer();
    navigateToTab(tab);
  });
});

// Atalhos do Cabeçalho Superior
document.getElementById('btn-header-search')?.addEventListener('click', () => {
  openSearch();
});

document.getElementById('btn-header-caixa')?.addEventListener('click', () => {
  if (window.openCashRegisterModal) {
    window.openCashRegisterModal();
  }
});

document.getElementById('btn-header-quick-sim')?.addEventListener('click', () => {
  navigateToTab('loans');
});

document.getElementById('btn-header-quick-client')?.addEventListener('click', () => {
  window.openClientModal();
});

// Registra funções globais de janela
window.navigateToTab = navigateToTab;
window.refreshCurrentTab = refreshCurrentTab;
window.updateBrandDisplay = updateBrandDisplay;
window.onAuthSuccess = onAuthSuccess;
window.onLoginSuccess = onAuthSuccess;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.generateMonthlyReportPDF = generateMonthlyReportPDF;
window.generateClientReportPDF = generateClientReportPDF;
window.openMonthlyReportModal = openMonthlyReportModal;

// Observa mudanças de estado para atualizar badges
state.subscribe(() => {
  updateOverdueBadge();
});

// Registra Service Worker (PWA para Celular e Computador)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration error:', err);
    });
  });
}

// Inicialização: Só entra no dashboard se já estiver autenticado na sessão atual.
// Caso contrário, o dashboard só será aberto quando o PIN correto for inserido.
if (isAuthenticated()) {
  onAuthSuccess();
}
