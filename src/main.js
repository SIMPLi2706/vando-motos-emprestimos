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

// Callback exportado disparado após autenticação bem-sucedida pelo PIN
export function onAuthSuccess() {
  updateBrandDisplay();
  navigateToTab('dashboard');
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

// Controle do Menu Lateral Mobile
const sidebar = document.getElementById('app-sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
const closeSidebarBtn = document.getElementById('btn-close-sidebar');

function openMobileDrawer() {
  sidebar.classList.add('open');
  backdrop.classList.add('open');
}

function closeMobileDrawer() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('open');
}

if (mobileToggleBtn) mobileToggleBtn.addEventListener('click', openMobileDrawer);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileDrawer);
if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

// Listeners de Navegação (Desktop Sidebar)
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    navigateToTab(btn.dataset.tab);
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
