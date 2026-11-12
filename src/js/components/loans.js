// src/js/components/loans.js
// Simulador Dinâmico, Emissão de Novos Empréstimos e Gestão de Contratos - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, createWhatsAppUrl, showToast, escapeHtml, maskCPF, maskPhone } from '../utils.js';
import { calculateAmortizationSchedule } from '../finance.js';
import { getPromissorySigningUrl } from './publicSignPortal.js';
import { isAdmin } from './loginScreen.js';
import { icon } from '../icons.js';

export function renderLoans(options = {}) {
  const container = document.createElement('div');
  container.className = 'loans-view animate-fade-in';

  const clients = state.getClients();
  const loans = state.getLoans();
  const todayStr = formatDateForInput();

  container.innerHTML = `
    <!-- Topo da Visão: Alternar entre Novo Empréstimo e Contratos Ativos -->
    <div class="tabs-bar">
      <button class="tab-btn active" id="tab-btn-simulador">Simular & Novo Empréstimo</button>
      <button class="tab-btn" id="tab-btn-contratos">Contratos Ativos (${loans.length})</button>
    </div>

    <!-- SEÇÃO 1: SIMULADOR E NOVO EMPRÉSTIMO -->
    <div id="section-simulador">
      <div class="loan-simulator-layout">
        
        <!-- Formulário de Parâmetros -->
        <div class="card sim-card-config">
          <div class="card-header">
            <div>
              <h3 class="card-title">Configurar Empréstimo</h3>
              <p class="card-subtitle">Informe os valores para simulação em tempo real</p>
            </div>
          </div>

          <form id="form-novo-emprestimo">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <div style="display: flex; gap: 8px;">
                <select class="form-control" id="sim-cliente" required style="flex: 1;">
                  <option value="">Selecione um cliente...</option>
                  ${clients.map(c => `
                    <option value="${c.id}">${escapeHtml(c.name)}${c.blocked ? ' [BLOQUEADO]' : ''} (${escapeHtml(c.phone || c.cpf || 'Sem doc')})</option>
                  `).join('')}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-new-client" title="Novo Cliente">
                  + Novo
                </button>
              </div>
              <!-- Cartão de Insight de Risco / Score / Limite -->
              <div id="sim-client-insight" style="display: none; margin-top: 10px;"></div>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Valor do Empréstimo *</label>
                <span class="sim-val-hint text-yellow" id="sim-val-display" style="font-size: 0.88rem; font-weight: 700;">R$ 1.000,00</span>
              </div>
              <input type="number" inputmode="decimal" class="form-control" id="sim-valor" value="1000" min="10" step="10" required>
              <div class="amount-quick-chips">
                <button type="button" class="amount-chip" data-set="500">R$ 500</button>
                <button type="button" class="amount-chip" data-set="1000">R$ 1.000</button>
                <button type="button" class="amount-chip" data-set="2000">R$ 2.000</button>
                <button type="button" class="amount-chip" data-set="5000">R$ 5.000</button>
                <button type="button" class="amount-chip" data-add="500">+ R$ 500</button>
                <button type="button" class="amount-chip" data-add="1000">+ R$ 1.000</button>
              </div>
            </div>

            <!-- Taxa de Juros (%) - Destaque Principal -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Taxa de Juros (%) *</label>
                <span class="sim-taxa-hint text-yellow" id="sim-taxa-display" style="font-size: 0.88rem; font-weight: 700;">20% (+R$ 200,00 de juros)</span>
              </div>
              <input type="number" inputmode="decimal" class="form-control" id="sim-taxa" value="20" min="0" step="0.5" required placeholder="Ex: 20">
              <div class="rate-quick-chips">
                <button type="button" class="rate-chip" data-rate="10">10%</button>
                <button type="button" class="rate-chip" data-rate="15">15%</button>
                <button type="button" class="rate-chip active" data-rate="20">20%</button>
                <button type="button" class="rate-chip" data-rate="25">25%</button>
                <button type="button" class="rate-chip" data-rate="30">30%</button>
                <button type="button" class="rate-chip" data-rate="40">40%</button>
              </div>
            </div>

            <!-- Parcelas com 1x (Única) em destaque -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Quantidade de Parcelas *</label>
                <span class="sim-parcelas-hint text-yellow" id="sim-parcelas-display" style="font-size: 0.88rem; font-weight: 700;">1x (Pagamento Único)</span>
              </div>
              <div class="installment-pills">
                <button type="button" class="pill-btn active" data-n="1">1x (Única)</button>
                <button type="button" class="pill-btn" data-n="2">2x</button>
                <button type="button" class="pill-btn" data-n="3">3x</button>
                <button type="button" class="pill-btn" data-n="4">4x</button>
                <button type="button" class="pill-btn" data-n="5">5x</button>
                <button type="button" class="pill-btn" data-n="6">6x</button>
                <button type="button" class="pill-btn" data-n="10">10x</button>
                <button type="button" class="pill-btn" data-n="12">12x</button>
              </div>
              <div style="margin-top: 8px;">
                <input type="number" inputmode="numeric" class="form-control" id="sim-parcelas" value="1" min="1" max="120" placeholder="Número de parcelas (1 = Pagamento Único)" required>
              </div>
            </div>

            <!-- Data de Início, Periodicidade e Meio de Liberação -->
            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
              <div class="form-group">
                <label class="form-label">Data do Empréstimo *</label>
                <input type="date" class="form-control" id="sim-data-inicio" value="${todayStr}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Periodicidade *</label>
                <select class="form-control" id="sim-periodicidade">
                  <option value="monthly" selected>Mensal (30 dias)</option>
                  <option value="biweekly">Quinzenal (15 dias)</option>
                  <option value="weekly">Semanal (7 dias)</option>
                  <option value="daily">Diário (1 dia)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Saída / Pagamento *</label>
                <select class="form-control" id="sim-desembolso">
                  <option value="PIX" selected>PIX</option>
                  <option value="Dinheiro">Dinheiro (Espécie)</option>
                  <option value="Transferência">Transferência / TED</option>
                </select>
              </div>
            </div>

            <!-- Hero Box de Resumo Imediato (Fintech) -->
            <div class="sim-hero-box">
              <div class="sim-hero-main">
                <span class="sim-hero-label" id="sim-hero-label">Pagamento Único (Total com Juros)</span>
                <div class="sim-hero-value" id="sim-hero-parcela">R$ 1.200,00</div>
              </div>
              <div class="sim-hero-subgrid">
                <div class="sim-hero-subitem">
                  <span class="sim-hero-sublabel">Total a Receber</span>
                  <span class="sim-hero-subvalue text-green" id="sim-hero-total">R$ 1.200,00</span>
                </div>
                <div class="sim-hero-subitem">
                  <span class="sim-hero-sublabel">Total de Juros</span>
                  <span class="sim-hero-subvalue text-yellow" id="sim-hero-juros">R$ 200,00 (20%)</span>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary sim-submit-btn" id="sim-submit-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Efetivar Empréstimo</span>
            </button>

            <!-- Detalhes Avançados (Accordion) -->
            <details class="sim-advanced-details" id="sim-advanced-details">
              <summary class="sim-advanced-summary">
                <span class="sim-advanced-summary-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>Opções Avançadas (Cálculo, Multas, Garantia & Avalista)</span>
                </span>
                <span class="sim-details-chevron">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
              </summary>

              <div class="sim-advanced-body">
                <div class="form-group">
                  <label class="form-label">Modelo de Amortização / Cálculo</label>
                  <select class="form-control" id="sim-tipo-juros">
                    <option value="price" selected>Tabela Price (Parcelas Fixas / Padrão)</option>
                    <option value="simple">Juros Simples (Taxa Fixa)</option>
                    <option value="sac">Tabela SAC (Amortização Constante)</option>
                    <option value="interest_only">Só Juros (Amortização no Fim)</option>
                  </select>
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Carência (Dias adicionais p/ 1ª parcela)</label>
                    <input type="number" inputmode="numeric" class="form-control" id="sim-carencia" value="0" min="0">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Multa por Atraso (%)</label>
                    <input type="number" inputmode="decimal" class="form-control" id="sim-multa" value="2.0" step="0.5">
                  </div>
                </div>

                <!-- Garantia Estruturada -->
                <div class="sim-subpanel">
                  <div class="sim-subpanel-title">${icon('shieldCheck', 14)} Garantia do Contrato (Opcional)</div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">Tipo de Bem</label>
                      <select class="form-control" id="sim-gar-tipo">
                        <option value="">Sem garantia real</option>
                        <option value="Moto / Veículo">Moto / Veículo</option>
                        <option value="Celular / Notebook">Celular / Eletrônico</option>
                        <option value="Imóvel / Terreno">Imóvel / Terreno</option>
                        <option value="Outro Bem / Documento">Outro Bem / Documento</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Valor Estimado (R$)</label>
                      <input type="number" inputmode="decimal" class="form-control" id="sim-gar-valor" placeholder="0,00" step="100" min="0">
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">Modelo / Descrição do Bem</label>
                      <input type="text" class="form-control" id="sim-gar-desc" placeholder="Ex: Honda CG 160 Start Preta 2023">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Placa / Chassi / Nº de Série</label>
                      <input type="text" class="form-control" id="sim-gar-id" placeholder="Ex: Placa QRT-4B21">
                    </div>
                  </div>
                </div>

                <!-- Avalista / Fiador Estruturado -->
                <div class="sim-subpanel">
                  <div class="sim-subpanel-title">${icon('userCheck', 14)} Avalista / Fiador Solidário (Opcional)</div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">Nome Completo do Avalista</label>
                      <input type="text" class="form-control" id="sim-av-nome" placeholder="Nome completo">
                    </div>
                    <div class="form-group">
                      <label class="form-label">CPF do Avalista</label>
                      <input type="text" inputmode="numeric" class="form-control" id="sim-av-cpf" placeholder="000.000.000-00" maxlength="14">
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">Telefone / WhatsApp</label>
                      <input type="text" inputmode="tel" class="form-control" id="sim-av-phone" placeholder="(00) 00000-0000" maxlength="15">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Endereço</label>
                      <input type="text" class="form-control" id="sim-av-address" placeholder="Rua, número e bairro">
                    </div>
                  </div>
                </div>

                <div class="form-group" style="margin-top: 10px;">
                  <label class="form-label">Observações Gerais do Contrato</label>
                  <textarea class="form-control" id="sim-notas" rows="2" placeholder="Condições especiais, combinados, observações..."></textarea>
                </div>
              </div>
            </details>
          </form>
        </div>

        <!-- Painel de Resultados do Simulador -->
        <div class="card sim-card-schedule">
          <div class="card-header">
            <div>
              <h3 class="card-title">Cronograma de Vencimentos</h3>
              <p class="card-subtitle">Cálculo detalhado do retorno financeiro</p>
            </div>
            <span class="badge badge-pending" id="sim-badge-parcelas">5x parcelas</span>
          </div>

          <div class="kpi-grid" style="margin-bottom: 14px;">
            <div class="kpi-card" style="padding: 10px 12px;">
              <span class="kpi-label">Total a Receber</span>
              <div class="kpi-value text-green" id="sim-total-pagar">R$ 0,00</div>
            </div>
            <div class="kpi-card" style="padding: 10px 12px;">
              <span class="kpi-label">Total de Juros</span>
              <div class="kpi-value text-yellow" id="sim-total-juros">R$ 0,00</div>
            </div>
          </div>

          <div class="scroll-hint-mobile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Deslize a tabela para ver todas as colunas</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>

          <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
            <table class="table table-mobile-card-view table-sim-parcelas" id="sim-tabela-parcelas">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Vencimento</th>
                  <th>Parcela</th>
                  <th>Juros</th>
                  <th>Amortização</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                <!-- Inserido dinamicamente -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- SEÇÃO 2: CONTRATOS ATIVOS -->
    <div id="section-contratos" style="display: none;">
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Contratos de Empréstimo</h3>
            <p class="card-subtitle">Busque, filtre, edite, gerencie garantias, anexos e quitações</p>
          </div>
          <div class="search-input-wrap" style="min-width: 240px;">
            <span class="search-icon">${icon('search', 16)}</span>
            <input type="text" class="form-control" id="search-contratos" placeholder="Buscar cliente, garantia, placa ou ID...">
          </div>
        </div>

        <div class="filter-pills-row" id="contracts-filter-pills" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
          <button type="button" class="filter-pill active" data-cfilter="all">Todos (${loans.length})</button>
          <button type="button" class="filter-pill" data-cfilter="active">Em Andamento</button>
          <button type="button" class="filter-pill" data-cfilter="overdue">Atrasados</button>
          <button type="button" class="filter-pill" data-cfilter="unsigned">Sem Assinatura</button>
          <button type="button" class="filter-pill" data-cfilter="signed">Assinados</button>
          <button type="button" class="filter-pill" data-cfilter="paid">Quitados</button>
        </div>

        <div id="contracts-list-container"></div>
      </div>
    </div>
  `;

  function updateSimulation() {
    const val = Number(container.querySelector('#sim-valor').value) || 0;
    const taxa = Number(container.querySelector('#sim-taxa').value) || 0;
    const tipo = container.querySelector('#sim-tipo-juros')?.value || 'price';
    const periodicidade = container.querySelector('#sim-periodicidade')?.value || 'monthly';
    const parcelas = parseInt(container.querySelector('#sim-parcelas').value, 10) || 1;
    const dataInicio = container.querySelector('#sim-data-inicio')?.value || formatDateForInput();
    const carencia = parseInt(container.querySelector('#sim-carencia')?.value, 10) || 0;

    const res = calculateAmortizationSchedule({
      principal: val,
      interestRate: taxa,
      interestType: tipo,
      periodicity: periodicidade,
      installmentsCount: parcelas,
      startDate: dataInicio,
      firstPaymentDays: carencia
    });

    const parcelaUnit = res.schedule.length > 0 ? res.schedule[0].installmentAmount : 0;

    const valDisplay = container.querySelector('#sim-val-display');
    if (valDisplay) valDisplay.textContent = formatBRL(val);

    const taxaDisplay = container.querySelector('#sim-taxa-display');
    if (taxaDisplay) {
      taxaDisplay.textContent = `${taxa}% (+${formatBRL(res.totalInterest)} de juros)`;
    }

    const parcelasDisplay = container.querySelector('#sim-parcelas-display');
    if (parcelasDisplay) {
      if (parcelas === 1) {
        parcelasDisplay.textContent = '1x (Pagamento Único)';
      } else {
        parcelasDisplay.textContent = `${parcelas} parcelas`;
      }
    }

    const heroLabel = container.querySelector('#sim-hero-label');
    const heroParcela = container.querySelector('#sim-hero-parcela');
    if (heroParcela) {
      if (parcelas === 1) {
        if (heroLabel) heroLabel.textContent = 'Pagamento Único (Total com Juros)';
        heroParcela.textContent = formatBRL(res.totalPayable);
      } else {
        if (heroLabel) heroLabel.textContent = 'Valor Estimado da Parcela';
        if (res.schedule.length > 1 && tipo === 'sac') {
          const first = res.schedule[0].installmentAmount;
          const last = res.schedule[res.schedule.length - 1].installmentAmount;
          heroParcela.textContent = `${parcelas}x (${formatBRL(first)} ~ ${formatBRL(last)})`;
        } else {
          heroParcela.textContent = `${parcelas}x de ${formatBRL(parcelaUnit)}`;
        }
      }
    }

    const heroTotal = container.querySelector('#sim-hero-total');
    if (heroTotal) heroTotal.textContent = formatBRL(res.totalPayable);

    const heroJuros = container.querySelector('#sim-hero-juros');
    if (heroJuros) heroJuros.textContent = `${formatBRL(res.totalInterest)} (${taxa}%)`;

    container.querySelector('#sim-total-pagar').textContent = formatBRL(res.totalPayable);
    container.querySelector('#sim-total-juros').textContent = formatBRL(res.totalInterest);
    container.querySelector('#sim-badge-parcelas').textContent = parcelas === 1 ? '1x Pagamento Único' : `${parcelas}x parcelas`;

    // Sincroniza active dos botões de parcelas (pills)
    container.querySelectorAll('.installment-pills .pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.n, 10) === parcelas);
    });

    // Sincroniza active dos botões de taxa (rate-chips)
    container.querySelectorAll('.rate-chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.rate) === taxa);
    });

    const tbody = container.querySelector('#sim-tabela-parcelas tbody');
    tbody.innerHTML = res.schedule.map(item => `
      <tr>
        <td data-label="Nº">
          <div class="td-cell-val" style="align-items: flex-start; font-weight: 800; color: var(--yellow);">
            ${parcelas === 1 ? 'Única (#1)' : `#${item.number}`}
          </div>
        </td>
        <td data-label="Vencimento">
          <div class="td-cell-val">${formatDate(item.dueDate)}</div>
        </td>
        <td data-label="Parcela">
          <div class="td-cell-val" style="font-weight: 800; color: var(--green);">${formatBRL(item.installmentAmount)}</div>
        </td>
        <td data-label="Juros">
          <div class="td-cell-val" style="color: var(--yellow);">${formatBRL(item.interestAmount)}</div>
        </td>
        <td data-label="Amortização">
          <div class="td-cell-val">${formatBRL(item.amortizationAmount)}</div>
        </td>
        <td data-label="Saldo Devedor">
          <div class="td-cell-val" style="color: var(--text-400);">${formatBRL(item.remainingBalance)}</div>
        </td>
      </tr>
    `).join('');
  }

  function renderContractsList(filterMode = 'all', searchTerm = '') {
    const listWrap = container.querySelector('#contracts-list-container');
    if (!listWrap) return;

    const allLoans = state.getLoans();
    const allInsts = state.getInstallments();
    const q = String(searchTerm || '').trim().toLowerCase();
    const adminAllowed = isAdmin();

    const filtered = allLoans.filter(loan => {
      const client = state.getClientById(loan.clientId) || { name: 'Cliente Removido', cpf: '', phone: '' };
      const loanInsts = allInsts.filter(i => i.loanId === loan.id);
      const hasOverdue = loanInsts.some(i => i.status !== 'paid' && String(i.dueDate || '').split('T')[0] < todayStr);
      const isSigned = !!(loan.signature || localStorage.getItem(`vando_signed_${loan.id}`));

      if (filterMode === 'active' && loan.status === 'paid') return false;
      if (filterMode === 'paid' && loan.status !== 'paid') return false;
      if (filterMode === 'overdue' && !hasOverdue) return false;
      if (filterMode === 'signed' && !isSigned) return false;
      if (filterMode === 'unsigned' && isSigned) return false;

      if (q) {
        const garStr = loan.guarantee ? `${loan.guarantee.type || ''} ${loan.guarantee.description || ''} ${loan.guarantee.identifier || ''}` : '';
        const avStr = loan.guarantor ? `${loan.guarantor.name || ''} ${loan.guarantor.cpf || ''}` : '';
        const haystack = `${client.name} ${client.cpf || ''} ${client.phone || ''} ${loan.id} ${loan.notes || ''} ${garStr} ${avStr}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state-box">
          <p>${allLoans.length === 0 ? 'Nenhum contrato cadastrado no momento.' : 'Nenhum contrato encontrado com esse filtro ou busca.'}</p>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${filtered.map(loan => {
          const client = state.getClientById(loan.clientId) || { name: 'Cliente Removido' };
          const scoreInfo = client.id ? state.getClientScore(client.id) : { grade: 'B', label: 'Regular', color: 'var(--yellow)' };
          const loanInsts = allInsts.filter(i => i.loanId === loan.id);
          const totalInsts = loanInsts.length;
          const paidInsts = loanInsts.filter(i => i.status === 'paid').length;
          const totalPaid = loanInsts.reduce((acc, i) => acc + Number(i.paidAmount || 0), 0);
          const hasOverdue = loanInsts.some(i => i.status !== 'paid' && String(i.dueDate || '').split('T')[0] < todayStr);
          const progressPct = totalInsts > 0 ? Math.round((paidInsts / totalInsts) * 100) : 0;
          const isSigned = !!(loan.signature || localStorage.getItem(`vando_signed_${loan.id}`));
          const attCount = Array.isArray(loan.attachments) ? loan.attachments.length : 0;

          let tipoFormatado = 'Price';
          if (loan.interestType === 'simple') tipoFormatado = 'Simples';
          if (loan.interestType === 'sac') tipoFormatado = 'SAC';
          if (loan.interestType === 'interest_only') tipoFormatado = 'Só Juros';

          const g = loan.guarantee && (loan.guarantee.description || loan.guarantee.type) ? loan.guarantee : null;
          const av = loan.guarantor && loan.guarantor.name ? loan.guarantor : null;

          return `
            <div class="card contract-item-card" style="background: var(--bg-3); border-color: ${hasOverdue && loan.status !== 'paid' ? 'rgba(239,68,68,0.45)' : 'var(--border-soft)'}; margin-bottom: 0;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 1.05rem; font-weight: 800; color: #fff;">${escapeHtml(client.name)}</span>
                    ${client.id ? `<span class="score-pill-sm" style="border-color: ${scoreInfo.color}; color: ${scoreInfo.color};">Score ${scoreInfo.grade}</span>` : ''}
                    ${client.blocked ? `<span class="badge badge-overdue">Restrição</span>` : ''}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-400); margin-top: 3px;">
                    Liberado em: ${formatDate(loan.startDate)} •
                    ${Number(loan.installmentsCount) === 1 ? '<strong>Pagamento Único</strong>' : `${loan.installmentsCount} parcelas`} •
                    <strong>${tipoFormatado}</strong> (${loan.interestRate}%) •
                    Saída: <strong>${escapeHtml(loan.disbursementMethod || 'PIX')}</strong>
                    ${loan.operatorName ? ` • Op: ${escapeHtml(loan.operatorName)}` : ''}
                  </div>
                  ${(g || av || loan.notes) ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                      ${g ? `<span class="contract-meta-chip chip-guarantee">${icon('shieldCheck', 12)} ${escapeHtml(g.type || 'Garantia')}: ${escapeHtml(g.description || '')}${g.identifier ? ` (${escapeHtml(g.identifier)})` : ''}</span>` : ''}
                      ${av ? `<span class="contract-meta-chip chip-guarantor">${icon('userCheck', 12)} Avalista: ${escapeHtml(av.name)}</span>` : ''}
                      ${loan.settledEarlyDiscount > 0 ? `<span class="contract-meta-chip chip-discount">Desc. Quitação: ${formatBRL(loan.settledEarlyDiscount)}</span>` : ''}
                      ${loan.notes ? `<span class="contract-meta-chip">${escapeHtml(loan.notes)}</span>` : ''}
                    </div>
                  ` : ''}
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                    ${isSigned
                      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;">✓ Assinado</span>`
                      : `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;">Pend. Assinatura</span>`
                    }
                    <span class="badge ${loan.status === 'paid' ? 'badge-paid' : (hasOverdue ? 'badge-overdue' : 'badge-pending')}">
                      ${loan.status === 'paid' ? 'Quitado' : (hasOverdue ? 'Com Atraso' : 'Em Andamento')}
                    </span>
                  </div>
                  <div style="font-size: 1.2rem; font-weight: 800; color: var(--green);">
                    ${formatBRL(loan.totalPayable)}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-400);">Capital: ${formatBRL(loan.principal)}</div>
                </div>
              </div>

              <!-- Barra de Progresso de Quitação -->
              <div style="margin: 10px 0 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-400); margin-bottom: 6px;">
                  <span>${totalInsts === 1 ? (paidInsts === 1 ? 'Pagamento Único Quitado (100%)' : 'Pagamento Único Pendente (0%)') : `Progresso: ${paidInsts} de ${totalInsts} parcelas pagas (${progressPct}%)`}</span>
                  <span>Total recebido: <strong style="color: var(--text-100);">${formatBRL(totalPaid)}</strong></span>
                </div>
                <div style="height: 6px; background: var(--bg-1); border-radius: var(--r-full); overflow: hidden;">
                  <div style="height: 100%; width: ${progressPct}%; background: ${hasOverdue && loan.status !== 'paid' ? 'var(--amber)' : 'var(--green)'}; border-radius: var(--r-full); transition: width 0.3s ease;"></div>
                </div>
              </div>

              <!-- Ações do Empréstimo -->
              <div class="loan-card-actions">
                <button class="btn btn-secondary btn-sm btn-print-promissoria" data-loan-id="${loan.id}">
                  ${icon('fileText', 13)} Docs / Contrato
                </button>
                <button class="btn btn-whatsapp btn-sm btn-wpp-promissoria" data-loan-id="${loan.id}" style="background: #25d366; color: #fff; font-weight: 700; border: none; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;" title="Enviar Promissória e Link de Assinatura via WhatsApp">
                  ${icon('whatsapp', 13)} WhatsApp
                </button>
                <button class="btn btn-secondary btn-sm btn-ver-parcelas-loan" data-loan-id="${loan.id}">
                  Parcelas
                </button>
                <button class="btn btn-secondary btn-sm btn-editar-loan" data-loan-id="${loan.id}">
                  ${icon('sliders', 13)} Editar
                </button>
                <button class="btn btn-secondary btn-sm btn-anexos-loan" data-loan-id="${loan.id}">
                  ${icon('paperclip', 13)} Anexos${attCount > 0 ? ` (${attCount})` : ''}
                </button>
                ${loan.status !== 'paid' ? `
                  <button class="btn btn-primary btn-sm btn-quitar-loan" data-loan-id="${loan.id}">
                    ${icon('checkCircle', 13)} Quitar Tudo
                  </button>
                ` : ''}
                ${adminAllowed ? `
                  <button class="btn btn-danger btn-sm btn-excluir-loan" data-loan-id="${loan.id}">
                    Excluir
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind eventos dinâmicos dos cards filtrados
    listWrap.querySelectorAll('.btn-ver-parcelas-loan').forEach(btn => {
      btn.addEventListener('click', () => {
        window.navigateToTab('installments', { loanId: btn.dataset.loanId });
      });
    });

    listWrap.querySelectorAll('.btn-print-promissoria').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openPromissoryModal(btn.dataset.loanId);
      });
    });

    listWrap.querySelectorAll('.btn-editar-loan').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openLoanEditModal(btn.dataset.loanId);
      });
    });

    listWrap.querySelectorAll('.btn-anexos-loan').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openLoanAttachmentsModal(btn.dataset.loanId);
      });
    });

    listWrap.querySelectorAll('.btn-quitar-loan').forEach(btn => {
      btn.addEventListener('click', () => {
        window.openSettleLoanModal(btn.dataset.loanId);
      });
    });

    listWrap.querySelectorAll('.btn-wpp-promissoria').forEach(btn => {
      btn.addEventListener('click', () => {
        const loanId = btn.dataset.loanId;
        const loan = state.getLoanById(loanId);
        if (!loan) return;
        const client = state.getClientById(loan.clientId);
        if (!client) return;
        const loanInsts = state.getInstallments({ loanId });
        const settings = state.getSettings();
        const inst = loanInsts[0];
        const isSingle = (loanInsts.length === 1);
        const signingUrl = getPromissorySigningUrl(loan, client, inst, settings);
        const amountVal = isSingle ? loan.totalPayable : (inst ? inst.installmentAmount : loan.totalPayable);
        const dueVal = inst ? inst.dueDate : loan.startDate;
        const numDesc = isSingle ? 'Única' : (inst ? `#01/${String(loanInsts.length).padStart(2, '0')}` : 'Carnê');

        const msg = `🏍️ *VANDO MOTOS LOCADORA - DOCUMENTOS DO CONTRATO*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOlá, *${client.name}*!\n\nSegue o resumo da sua Nota Promissória e Contrato referente ao seu empréstimo:\n\n📄 *Título:* Nota Promissória Oficial ${numDesc}\n💰 *Valor do Título:* ${formatBRL(amountVal)}\n📅 *Vencimento:* ${formatDate(dueVal)}\n🏛️ *Credor:* ${settings.businessName}\n📍 *Praça de Pagamento:* ${settings.creditorCity || 'PORTO VELHO RONDONIA'}\n\n✍️ *ASSINE SEUS DOCUMENTOS ONLINE:*\nAcesse o link seguro abaixo para conferir a Nota Promissória e o Contrato de Confissão de Dívida e assinar com o dedo na tela do seu celular:\n👉 ${signingUrl}\n\n_Documento com validade jurídica integral (MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020)._\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        if (client.phone) {
          const url = createWhatsAppUrl(client.phone, msg);
          window.open(url, '_blank');
        } else {
          const inputPhone = prompt('O cliente não possui telefone cadastrado. Digite o número com DDD para abrir o WhatsApp (ex: 69999999999):');
          if (inputPhone) {
            const url = createWhatsAppUrl(inputPhone, msg);
            window.open(url, '_blank');
          } else {
            navigator.clipboard.writeText(msg).then(() => {
              showToast('Mensagem com link copiada para a área de transferência!');
            });
          }
        }
      });
    });

    listWrap.querySelectorAll('.btn-excluir-loan').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Deseja realmente excluir este empréstimo e todas as suas parcelas?')) {
          await state.deleteLoan(btn.dataset.loanId);
          showToast('Empréstimo excluído com sucesso.', 'success');
          window.refreshCurrentTab();
        }
      });
    });
  }

  function updateClientInsight() {
    const insightBox = container.querySelector('#sim-client-insight');
    const submitBtn = container.querySelector('#sim-submit-btn');
    const clientId = container.querySelector('#sim-cliente')?.value;
    const principalVal = Number(container.querySelector('#sim-valor')?.value) || 0;

    if (!insightBox) return;

    if (!clientId) {
      insightBox.style.display = 'none';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    const client = state.getClientById(clientId);
    if (!client) {
      insightBox.style.display = 'none';
      return;
    }

    const scoreInfo = state.getClientScore(clientId);
    const exp = state.getClientActiveExposure(clientId);
    const limit = exp.creditLimit;
    const afterPrincipal = exp.openPrincipal + principalVal;
    const overLimit = limit > 0 && afterPrincipal > limit;
    const usagePct = limit > 0 ? Math.min(100, Math.round((afterPrincipal / limit) * 100)) : 0;

    insightBox.style.display = 'block';
    insightBox.innerHTML = `
      <div class="sim-client-insight-card ${client.blocked ? 'is-blocked' : ''}">
        <div class="sci-top">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="score-pill-lg" style="border-color: ${scoreInfo.color}; color: ${scoreInfo.color};">
              ${icon('award', 13)} Score ${scoreInfo.grade} • ${scoreInfo.score}/1000 (${scoreInfo.label})
            </span>
            ${client.referredBy ? `<span class="sci-ref">Indicado por: <strong>${escapeHtml(client.referredBy)}</strong></span>` : ''}
          </div>
          <span class="sci-exp">${exp.activeLoansCount} contrato(s) ativo(s)</span>
        </div>

        ${client.blocked ? `
          <div class="sci-blocked-alert">
            ${icon('ban', 15)}
            <div>
              <strong>CLIENTE BLOQUEADO / COM RESTRIÇÃO</strong>
              <div style="font-size: 0.78rem; margin-top: 2px;">${escapeHtml(client.blockedReason || 'Novos empréstimos impedidos até liberação no cadastro.')}</div>
            </div>
          </div>
        ` : `
          <div class="sci-limit-row">
            <span>Em aberto: <strong>${formatBRL(exp.openPrincipal)}</strong></span>
            <span>Com este (+${formatBRL(principalVal)}): <strong class="${overLimit ? 'text-red' : 'text-green'}">${formatBRL(afterPrincipal)}</strong> / Limite ${limit > 0 ? formatBRL(limit) : 'Sem teto'}</span>
          </div>
          ${limit > 0 ? `
            <div class="sci-limit-bar">
              <div class="sci-limit-fill ${overLimit ? 'fill-danger' : ''}" style="width: ${usagePct}%;"></div>
            </div>
            ${overLimit ? `<div class="sci-limit-warn">Atenção: este contrato ultrapassa o limite sugerido de ${formatBRL(limit)} em ${formatBRL(afterPrincipal - limit)}.</div>` : ''}
          ` : ''}
        `}
      </div>
    `;

    if (submitBtn) {
      submitBtn.disabled = !!client.blocked;
      submitBtn.style.opacity = client.blocked ? '0.5' : '1';
      submitBtn.title = client.blocked ? 'Cliente bloqueado para novos empréstimos' : '';
    }
  }

  setTimeout(() => {
    const tabSim = container.querySelector('#tab-btn-simulador');
    const tabCont = container.querySelector('#tab-btn-contratos');
    const secSim = container.querySelector('#section-simulador');
    const secCont = container.querySelector('#section-contratos');
    const searchContratos = container.querySelector('#search-contratos');
    let currentFilter = 'all';

    renderContractsList(currentFilter, '');

    tabSim.addEventListener('click', () => {
      tabSim.classList.add('active');
      tabCont.classList.remove('active');
      secSim.style.display = 'block';
      secCont.style.display = 'none';
    });

    tabCont.addEventListener('click', () => {
      tabCont.classList.add('active');
      tabSim.classList.remove('active');
      secCont.style.display = 'block';
      secSim.style.display = 'none';
    });

    if (options.tab === 'contratos' || options.loanId) {
      tabCont.click();
    }

    container.querySelectorAll('#contracts-filter-pills .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        currentFilter = pill.dataset.cfilter;
        container.querySelectorAll('#contracts-filter-pills .filter-pill').forEach(p => p.classList.toggle('active', p === pill));
        renderContractsList(currentFilter, searchContratos?.value || '');
      });
    });

    if (searchContratos) {
      searchContratos.addEventListener('input', () => {
        renderContractsList(currentFilter, searchContratos.value);
      });
    }

    // Chips de valor rápido
    container.querySelectorAll('.amount-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = container.querySelector('#sim-valor');
        let current = Number(input.value) || 0;
        if (chip.dataset.add) {
          current += Number(chip.dataset.add);
        } else if (chip.dataset.set) {
          current = Number(chip.dataset.set);
        }
        input.value = current;
        updateSimulation();
        updateClientInsight();
      });
    });

    // Chips de taxa rápida
    container.querySelectorAll('.rate-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = container.querySelector('#sim-taxa');
        input.value = chip.dataset.rate;
        updateSimulation();
      });
    });

    // Pills de parcelas
    container.querySelectorAll('.installment-pills .pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const input = container.querySelector('#sim-parcelas');
        input.value = pill.dataset.n;
        updateSimulation();
      });
    });

    // Se estiver no desktop (tela ampla), abre opções avançadas por padrão
    if (window.innerWidth > 768) {
      const advDetails = container.querySelector('#sim-advanced-details');
      if (advDetails) advDetails.open = true;
    }

    const clientSel = container.querySelector('#sim-cliente');
    if (clientSel) {
      clientSel.addEventListener('change', updateClientInsight);
    }

    const inputs = ['#sim-valor', '#sim-taxa', '#sim-tipo-juros', '#sim-periodicidade', '#sim-parcelas', '#sim-data-inicio', '#sim-carencia'];
    inputs.forEach(sel => {
      const el = container.querySelector(sel);
      if (el) {
        el.addEventListener('input', () => {
          updateSimulation();
          if (sel === '#sim-valor') updateClientInsight();
        });
        el.addEventListener('change', () => {
          updateSimulation();
          if (sel === '#sim-valor') updateClientInsight();
        });
      }
    });

    const avCpf = container.querySelector('#sim-av-cpf');
    const avPhone = container.querySelector('#sim-av-phone');
    if (avCpf) avCpf.addEventListener('input', (e) => { e.target.value = maskCPF(e.target.value); });
    if (avPhone) avPhone.addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });

    updateSimulation();

    container.querySelector('#btn-quick-new-client')?.addEventListener('click', () => {
      window.openClientModal();
    });

    const form = container.querySelector('#form-novo-emprestimo');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = container.querySelector('#sim-cliente').value;
      if (!clientId) {
        showToast('Por favor, selecione um cliente.', 'error');
        return;
      }

      const garType = container.querySelector('#sim-gar-tipo')?.value || '';
      const garDesc = container.querySelector('#sim-gar-desc')?.value?.trim() || '';
      const garId = container.querySelector('#sim-gar-id')?.value?.trim() || '';
      const garVal = Number(container.querySelector('#sim-gar-valor')?.value || 0);

      const avName = container.querySelector('#sim-av-nome')?.value?.trim() || '';
      const avCpf = container.querySelector('#sim-av-cpf')?.value?.trim() || '';
      const avPhone = container.querySelector('#sim-av-phone')?.value?.trim() || '';
      const avAddress = container.querySelector('#sim-av-address')?.value?.trim() || '';

      const newLoanData = {
        clientId,
        principal: container.querySelector('#sim-valor').value,
        interestRate: container.querySelector('#sim-taxa').value,
        interestType: container.querySelector('#sim-tipo-juros').value,
        periodicity: container.querySelector('#sim-periodicidade').value,
        installmentsCount: container.querySelector('#sim-parcelas').value,
        startDate: container.querySelector('#sim-data-inicio').value,
        firstPaymentDays: container.querySelector('#sim-carencia').value,
        penaltyRate: container.querySelector('#sim-multa').value,
        disbursementMethod: container.querySelector('#sim-desembolso')?.value || 'PIX',
        guarantee: (garType || garDesc || garId || garVal > 0)
          ? { type: garType, description: garDesc, identifier: garId, value: garVal }
          : null,
        guarantor: avName
          ? { name: avName, cpf: avCpf, phone: avPhone, address: avAddress }
          : null,
        notes: container.querySelector('#sim-notas').value
      };

      try {
        const created = state.createLoan(newLoanData);
        showToast('Empréstimo efetivado com sucesso!');
        window.navigateToTab('installments', { loanId: created.id });
      } catch (err) {
        showToast(err.message || 'Erro ao criar empréstimo', 'error');
      }
    });

  }, 0);

  return container;
}
