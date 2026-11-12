// src/js/components/cashRegisterModal.js
// Fechamento de Caixa Diário com Separação por Forma de Pagamento e Impressão de Relatório

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast, escapeHtml } from '../utils.js';
import { isAdmin } from './loginScreen.js';
import { icon } from '../icons.js';

export function createCashRegisterModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-fechamento-caixa';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 880px; max-height: 94vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${icon('bank', 18)} Fluxo & Fechamento de Caixa Diário</h3>
          <p class="modal-subtitle">Vando Motos Locadora LTDA • Entradas, Saídas, Empréstimos e Saldo de Gaveta</p>
        </div>
        <button class="modal-close-btn" id="caixa-modal-close">${icon('x', 16)}</button>
      </div>

      <div class="modal-body" style="padding: 20px;">
        <!-- Seletor de Data e Botões -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-label" style="margin-bottom: 0; font-weight: 700;">Data do Caixa:</label>
            <input type="date" class="form-control" id="caixa-input-date" style="max-width: 170px;" />
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="caixa-btn-ontem">Ontem</button>
            <button type="button" class="btn btn-secondary btn-sm" id="caixa-btn-hoje">Hoje</button>
            <button type="button" class="btn btn-secondary btn-sm" id="caixa-btn-toggle-manual" style="color: var(--yellow); border-color: rgba(245, 197, 24, 0.35);">
              ${icon('plus', 14)} Lançar Sangria / Despesa / Aporte
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="caixa-btn-imprimir">${icon('print', 14)} Imprimir</button>
          </div>
        </div>

        <!-- Formulário de Lançamento Manual (Colapsável) -->
        <form id="caixa-manual-form" class="caixa-manual-box" style="display: none;">
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--yellow); margin-bottom: 10px;">
            Novo Lançamento Manual no Caixa
          </div>
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Operação</label>
              <select class="form-control" id="cf-type">
                <option value="out">Saída / Despesa / Sangria (-)</option>
                <option value="in">Entrada / Aporte (+)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Categoria</label>
              <select class="form-control" id="cf-category">
                <option value="Despesa Operacional">Despesa Operacional</option>
                <option value="Sangria / Retirada">Sangria / Retirada</option>
                <option value="Combustível / Motoboy">Combustível / Cobrança</option>
                <option value="Aporte de Capital">Aporte de Capital</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Meio</label>
              <select class="form-control" id="cf-method">
                <option value="Dinheiro">Dinheiro (Gaveta)</option>
                <option value="PIX">PIX</option>
                <option value="Transferência">Transferência / TED</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Valor (R$) *</label>
              <input type="number" inputmode="decimal" step="0.01" min="0.01" class="form-control" id="cf-amount" placeholder="0,00" required />
            </div>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 10px; align-items: flex-end; flex-wrap: wrap;">
            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
              <label class="form-label">Descrição / Motivo</label>
              <input type="text" class="form-control" id="cf-desc" placeholder="Ex: Combustível cobrança, suprimento de gaveta..." />
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="min-height: 40px;">${icon('save', 14)} Salvar Lançamento</button>
          </div>
        </form>

        <!-- Grade de KPIs: Entradas, Saídas, Saldo Líquido e Gaveta -->
        <div class="kpi-grid" style="margin-bottom: 14px; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));">
          <div class="kpi-card" style="border-left: 4px solid var(--emerald-500);">
            <div class="kpi-header">
              <span class="kpi-label">Entradas (+)</span>
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--emerald-400);">${icon('arrowDownLeft', 18)}</div>
            </div>
            <div class="kpi-value" id="caixa-total-entradas" style="font-size: 1.32rem; color: var(--emerald-400);">R$ 0,00</div>
            <div class="kpi-footer" id="caixa-sub-entradas" style="font-size: 0.72rem;">Baixas + Aportes</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid var(--red);">
            <div class="kpi-header">
              <span class="kpi-label">Saídas (-)</span>
              <div class="kpi-icon-wrap" style="background: rgba(244, 63, 94, 0.15); color: var(--red);">${icon('arrowUpRight', 18)}</div>
            </div>
            <div class="kpi-value" id="caixa-total-saidas" style="font-size: 1.32rem; color: var(--red);">R$ 0,00</div>
            <div class="kpi-footer" id="caixa-sub-saidas" style="font-size: 0.72rem;">Empréstimos + Despesas</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
            <div class="kpi-header">
              <span class="kpi-label">Saldo Gaveta (Espécie)</span>
              <div class="kpi-icon-wrap" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">${icon('dollar', 18)}</div>
            </div>
            <div class="kpi-value" id="caixa-saldo-gaveta" style="font-size: 1.32rem; color: #60a5fa;">R$ 0,00</div>
            <div class="kpi-footer" id="caixa-sub-gaveta" style="font-size: 0.72rem;">Dinheiro físico do dia</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid var(--brand-yellow); background: rgba(245, 197, 24, 0.08);">
            <div class="kpi-header">
              <span class="kpi-label" style="font-weight: 800; color: var(--silver-metallic);">SALDO LÍQUIDO</span>
              <div class="kpi-icon-wrap" style="background: rgba(245, 197, 24, 0.25); color: var(--brand-yellow);">${icon('wallet', 18)}</div>
            </div>
            <div class="kpi-value" id="caixa-saldo-liquido" style="font-size: 1.4rem; color: var(--brand-yellow); font-weight: 800;">R$ 0,00</div>
            <div class="kpi-footer" style="font-size: 0.72rem;">Entradas menos Saídas</div>
          </div>
        </div>

        <!-- Resumo Compacto por Modalidade -->
        <div class="caixa-methods-strip" id="caixa-methods-strip">
          <span><strong>PIX:</strong> Ent <span id="caixa-total-pix" class="text-green">R$ 0,00</span> / Sai <span id="caixa-out-pix" class="text-danger">R$ 0,00</span></span>
          <span><strong>Dinheiro:</strong> Ent <span id="caixa-total-dinheiro" class="text-green">R$ 0,00</span> / Sai <span id="caixa-out-dinheiro" class="text-danger">R$ 0,00</span></span>
          <span><strong>Transf.:</strong> Ent <span id="caixa-total-transf" class="text-green">R$ 0,00</span> / Sai <span id="caixa-out-transf" class="text-danger">R$ 0,00</span></span>
        </div>

        <!-- Tabela Unificada de Movimentações -->
        <h4 style="font-size: 0.95rem; font-weight: 700; margin: 16px 0 10px; display: flex; align-items: center; justify-content: space-between;">
          <span>Movimentações Financeiras do Dia</span>
          <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-dim);" id="caixa-contagem-lancamentos">0 movimentações</span>
        </h4>

        <div class="table-responsive table-scroll-x" style="max-height: 330px; overflow-x: auto !important; overflow-y: auto;">
          <table class="table table-mobile-card-view" id="caixa-table-entries">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descrição / Cliente</th>
                <th>Meio</th>
                <th>Valor</th>
                <th style="text-align: right;">Ação</th>
              </tr>
            </thead>
            <tbody id="caixa-tbody-entries">
              <!-- Preenchido dinamicamente -->
            </tbody>
          </table>
        </div>

        <div id="caixa-empty-msg" style="display: none; text-align: center; padding: 28px; color: var(--text-dim);">
          Nenhuma movimentação registrada nesta data.
        </div>
      </div>

      <div class="modal-footer" style="justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="caixa-modal-close-btn">Fechar</button>
        <button type="button" class="btn btn-primary" id="caixa-btn-imprimir-footer">
          ${icon('print', 14)} Imprimir Fechamento do Dia
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const dateInput = modal.querySelector('#caixa-input-date');
  const closeBtn = modal.querySelector('#caixa-modal-close');
  const closeBtn2 = modal.querySelector('#caixa-modal-close-btn');
  const btnOntem = modal.querySelector('#caixa-btn-ontem');
  const btnHoje = modal.querySelector('#caixa-btn-hoje');
  const btnPrint = modal.querySelector('#caixa-btn-imprimir');
  const btnPrintFooter = modal.querySelector('#caixa-btn-imprimir-footer');
  const btnToggleManual = modal.querySelector('#caixa-btn-toggle-manual');
  const manualForm = modal.querySelector('#caixa-manual-form');

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  btnToggleManual?.addEventListener('click', () => {
    manualForm.style.display = manualForm.style.display === 'none' ? 'block' : 'none';
  });

  manualForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = Number(modal.querySelector('#cf-amount')?.value || 0);
    if (amount <= 0) {
      showToast('Informe um valor maior que zero.', 'error');
      return;
    }
    state.addCashFlow({
      date: dateInput.value || formatDateForInput(),
      type: modal.querySelector('#cf-type').value,
      category: modal.querySelector('#cf-category').value,
      method: modal.querySelector('#cf-method').value,
      amount,
      description: modal.querySelector('#cf-desc').value.trim()
    });
    modal.querySelector('#cf-amount').value = '';
    modal.querySelector('#cf-desc').value = '';
    manualForm.style.display = 'none';
    showToast('Movimentação registrada no caixa!', 'success');
    updateCaixaView(dateInput.value);
  });

  function updateCaixaView(dateStr) {
    dateInput.value = dateStr;
    const report = state.getCashRegisterReport(dateStr);
    const adminAllowed = isAdmin();

    modal.querySelector('#caixa-total-entradas').textContent = formatBRL(report.totalInflows);
    modal.querySelector('#caixa-total-saidas').textContent = formatBRL(report.totalOutflows);
    modal.querySelector('#caixa-saldo-gaveta').textContent = formatBRL(report.netCashInDrawer);
    const netEl = modal.querySelector('#caixa-saldo-liquido');
    netEl.textContent = formatBRL(report.netBalance);
    netEl.style.color = report.netBalance < 0 ? 'var(--red)' : 'var(--brand-yellow)';

    modal.querySelector('#caixa-total-pix').textContent = formatBRL(report.totalPix);
    modal.querySelector('#caixa-out-pix').textContent = formatBRL(report.totalPixOut);
    modal.querySelector('#caixa-total-dinheiro').textContent = formatBRL(report.totalCash);
    modal.querySelector('#caixa-out-dinheiro').textContent = formatBRL(report.totalCashOut);
    modal.querySelector('#caixa-total-transf').textContent = formatBRL(report.totalTransfer);
    modal.querySelector('#caixa-out-transf').textContent = formatBRL(report.totalTransferOut);

    modal.querySelector('#caixa-contagem-lancamentos').textContent = `${report.allMovements.length} movimentação(ões)`;

    const tbody = modal.querySelector('#caixa-tbody-entries');
    const emptyMsg = modal.querySelector('#caixa-empty-msg');

    if (report.allMovements.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    tbody.innerHTML = report.allMovements.map(m => {
      const isIn = m.direction === 'in';
      const badgeCls = isIn ? 'badge-paid' : 'badge-overdue';
      const valColor = isIn ? 'var(--green)' : 'var(--red)';
      const sign = isIn ? '+' : '-';

      let actionHtml = '<span style="color: var(--text-400); font-size: 0.75rem;">Auto</span>';
      if (m.installmentId) {
        actionHtml = `<button class="btn btn-secondary btn-sm btn-caixa-view-receipt" data-inst-id="${m.installmentId}">Recibo</button>`;
      } else if (m.manualId && adminAllowed) {
        actionHtml = `<button class="btn btn-danger btn-sm btn-caixa-del-manual" data-cf-id="${m.manualId}">Excluir</button>`;
      }

      return `
        <tr>
          <td data-label="Tipo">
            <div class="td-cell-val">
              <span class="badge ${badgeCls}">${escapeHtml(m.label)}</span>
            </div>
          </td>
          <td data-label="Descrição">
            <div class="td-cell-val">
              <div style="font-weight: 700; color: #fff;">${escapeHtml(m.title)}</div>
              ${m.subtitle ? `<div style="font-size: 0.74rem; color: var(--text-400);">${escapeHtml(m.subtitle)}</div>` : ''}
            </div>
          </td>
          <td data-label="Meio">
            <div class="td-cell-val">${escapeHtml(m.method || 'PIX')}</div>
          </td>
          <td data-label="Valor">
            <div class="td-cell-val" style="font-weight: 800; color: ${valColor};">${sign} ${formatBRL(m.amount)}</div>
          </td>
          <td class="td-actions" data-label="Ação">
            ${actionHtml}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-caixa-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        if (window.openReceiptModal) {
          window.openReceiptModal(btn.dataset.instId);
        }
      });
    });

    tbody.querySelectorAll('.btn-caixa-del-manual').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Excluir este lançamento manual do caixa?')) {
          state.deleteCashFlow(btn.dataset.cfId);
          showToast('Lançamento removido.', 'success');
          updateCaixaView(dateInput.value);
        }
      });
    });
  }

  dateInput.addEventListener('change', () => {
    updateCaixaView(dateInput.value);
  });

  btnHoje.addEventListener('click', () => {
    updateCaixaView(formatDateForInput());
  });

  btnOntem.addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    updateCaixaView(formatDateForInput(d));
  });

  function printCaixa() {
    const dateStr = dateInput.value;
    const report = state.getCashRegisterReport(dateStr);
    const settings = state.getSettings();

    const printWin = window.open('', '_blank');
    if (!printWin) {
      showToast('Permita popups para imprimir o relatório de caixa.', 'error');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Fechamento de Caixa - ${formatDate(dateStr)} - ${escapeHtml(settings.businessName)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #0f172a; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; margin: 0; }
          .sub { font-size: 13px; color: #475569; }
          .grid { display: flex; gap: 12px; margin-bottom: 20px; }
          .card { flex: 1; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; }
          .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .card-val { font-size: 17px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .assinatura { margin-top: 48px; display: flex; justify-content: space-between; gap: 40px; }
          .linha { border-top: 1px solid #0f172a; width: 260px; text-align: center; padding-top: 6px; font-size: 12px; }
          @media print { body { margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${escapeHtml(settings.businessName)}</div>
          <div class="sub">CNPJ: ${escapeHtml(settings.creditorCpfCnpj)} • Praça: ${escapeHtml(settings.creditorCity)}</div>
          <div style="margin-top: 8px; font-size: 16px; font-weight: 700;">FLUXO & FECHAMENTO DE CAIXA DIÁRIO</div>
          <div class="sub">Data do Movimento: <strong>${formatDate(dateStr)}</strong> | Emissão: ${new Date().toLocaleString('pt-BR')}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">Total Entradas (+)</div>
            <div class="card-val" style="color: #059669;">${formatBRL(report.totalInflows)}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Saídas (-)</div>
            <div class="card-val" style="color: #dc2626;">${formatBRL(report.totalOutflows)}</div>
          </div>
          <div class="card">
            <div class="card-label">Gaveta (Espécie)</div>
            <div class="card-val">${formatBRL(report.netCashInDrawer)}</div>
          </div>
          <div class="card" style="background: #f8fafc; border: 2px solid #0f172a;">
            <div class="card-label">SALDO LÍQUIDO</div>
            <div class="card-val">${formatBRL(report.netBalance)}</div>
          </div>
        </div>

        <h3>Movimentações do Dia (${report.allMovements.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Operação</th>
              <th>Descrição / Cliente</th>
              <th>Meio</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${report.allMovements.map(m => `
              <tr>
                <td>${escapeHtml(m.label)}</td>
                <td><strong>${escapeHtml(m.title)}</strong>${m.subtitle ? ` — ${escapeHtml(m.subtitle)}` : ''}</td>
                <td>${escapeHtml(m.method)}</td>
                <td style="text-align: right; font-weight: 700; color: ${m.direction === 'in' ? '#059669' : '#dc2626'};">
                  ${m.direction === 'in' ? '+' : '-'} ${formatBRL(m.amount)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="assinatura">
          <div class="linha">
            Responsável pelo Caixa<br>
            <strong>${escapeHtml(settings.businessName)}</strong>
          </div>
          <div class="linha">
            Conferência / Auditoria
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }

  btnPrint.addEventListener('click', printCaixa);
  btnPrintFooter.addEventListener('click', printCaixa);

  window.openCashRegisterModal = function(selectedDate = formatDateForInput()) {
    updateCaixaView(selectedDate);
    modal.classList.add('active');
  };
}
