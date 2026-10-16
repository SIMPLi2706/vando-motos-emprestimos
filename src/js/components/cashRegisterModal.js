// src/js/components/cashRegisterModal.js
// Fechamento de Caixa Diário com Separação por Forma de Pagamento e Impressão de Relatório

import { state } from '../state.js';
import { formatBRL, formatDate, formatDateForInput, showToast } from '../utils.js';

export function createCashRegisterModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-fechamento-caixa';

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 820px; max-height: 94vh;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title">💰 Fechamento de Caixa Diário</h3>
          <p class="modal-subtitle">Vando motos locadora LTDA • CNPJ 28.623.431-0001-23</p>
        </div>
        <button class="modal-close-btn" id="caixa-modal-close">✕</button>
      </div>

      <div class="modal-body" style="padding: 20px;">
        <!-- Seletor de Data -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-label" style="margin-bottom: 0; font-weight: 700;">Data do Caixa:</label>
            <input type="date" class="form-control" id="caixa-input-date" style="max-width: 170px;" />
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="caixa-btn-ontem">◀ Ontem</button>
            <button class="btn btn-secondary btn-sm" id="caixa-btn-hoje">Hoje</button>
            <button class="btn btn-primary btn-sm" id="caixa-btn-imprimir">🖨️ Imprimir Fechamento</button>
          </div>
        </div>

        <!-- Grade de Totais por Modalidade -->
        <div class="kpi-grid" style="margin-bottom: 24px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
          <div class="kpi-card" style="border-left: 4px solid var(--emerald-500);">
            <div class="kpi-header">
              <span class="kpi-label">Total em PIX</span>
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--emerald-400);">⚡</div>
            </div>
            <div class="kpi-value" id="caixa-total-pix" style="font-size: 1.4rem; color: var(--emerald-400);">R$ 0,00</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
            <div class="kpi-header">
              <span class="kpi-label">Dinheiro (Espécie)</span>
              <div class="kpi-icon-wrap" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">💵</div>
            </div>
            <div class="kpi-value" id="caixa-total-dinheiro" style="font-size: 1.4rem; color: #60a5fa;">R$ 0,00</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
            <div class="kpi-header">
              <span class="kpi-label">Transferência / TED</span>
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">🏦</div>
            </div>
            <div class="kpi-value" id="caixa-total-transf" style="font-size: 1.4rem; color: #a78bfa;">R$ 0,00</div>
          </div>

          <div class="kpi-card" style="border-left: 4px solid var(--brand-yellow); background: rgba(245, 197, 24, 0.08);">
            <div class="kpi-header">
              <span class="kpi-label" style="font-weight: 800; color: var(--silver-metallic);">TOTAL DO DIA</span>
              <div class="kpi-icon-wrap" style="background: rgba(245, 197, 24, 0.25); color: var(--brand-yellow);">💰</div>
            </div>
            <div class="kpi-value" id="caixa-total-geral" style="font-size: 1.5rem; color: var(--brand-yellow); font-weight: 800;">R$ 0,00</div>
          </div>
        </div>

        <!-- Tabela Detalhada de Entradas -->
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>Lançamentos e Baixas do Dia</span>
          <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-dim);" id="caixa-contagem-lancamentos">0 lançamentos</span>
        </h4>

        <div class="table-responsive table-scroll-x" style="max-height: 360px; overflow-x: auto !important; overflow-y: auto;">
          <table class="table table-mobile-card-view" id="caixa-table-entries">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Parcela</th>
                <th>Forma</th>
                <th>Valor Pago</th>
                <th>Observação</th>
                <th style="text-align: right;">Ação</th>
              </tr>
            </thead>
            <tbody id="caixa-tbody-entries">
              <!-- Preenchido dinamicamente -->
            </tbody>
          </table>
        </div>

        <div id="caixa-empty-msg" style="display: none; text-align: center; padding: 32px; color: var(--text-dim);">
          Nenhum recebimento registrado nesta data.
        </div>
      </div>

      <div class="modal-footer" style="justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="caixa-modal-close-btn">Fechar</button>
        <button type="button" class="btn btn-primary" id="caixa-btn-imprimir-footer">
          🖨️ Imprimir Relatório de Caixa
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

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function updateCaixaView(dateStr) {
    dateInput.value = dateStr;
    const report = state.getCashRegisterReport(dateStr);

    modal.querySelector('#caixa-total-pix').textContent = formatBRL(report.totalPix);
    modal.querySelector('#caixa-total-dinheiro').textContent = formatBRL(report.totalCash);
    modal.querySelector('#caixa-total-transf').textContent = formatBRL(report.totalTransfer);
    modal.querySelector('#caixa-total-geral').textContent = formatBRL(report.totalCollected);
    modal.querySelector('#caixa-contagem-lancamentos').textContent = `${report.count} recebimento(s)`;

    const tbody = modal.querySelector('#caixa-tbody-entries');
    const emptyMsg = modal.querySelector('#caixa-empty-msg');

    if (report.entries.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    tbody.innerHTML = report.entries.map(e => `
      <tr>
        <td data-label="Cliente">
          <div class="td-cell-val">
            <div style="font-weight: 700; color: #fff;">${e.clientName}</div>
            <div style="font-size: 0.75rem; color: var(--text-400);">${e.clientPhone || ''}</div>
          </div>
        </td>
        <td data-label="Parcela">
          <div class="td-cell-val">#${e.installmentNumber}</div>
        </td>
        <td data-label="Forma">
          <div class="td-cell-val">
            <span class="badge ${e.method.toUpperCase().includes('PIX') ? 'badge-paid' : 'badge-today'}">
              ${e.method}
            </span>
          </div>
        </td>
        <td data-label="Valor">
          <div class="td-cell-val" style="font-weight: 700; color: var(--green);">${formatBRL(e.amount)}</div>
        </td>
        <td data-label="Obs" class="${!e.notes ? 'desktop-only-cell' : ''}">
          <div class="td-cell-val" style="font-size: 0.8rem; color: var(--text-400);">${e.notes || '-'}</div>
        </td>
        <td class="td-actions" data-label="Ação">
          <button class="btn btn-secondary btn-sm btn-caixa-view-receipt" data-inst-id="${e.installmentId}" style="width: 100%;">
            Recibo
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-caixa-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal();
        if (window.openReceiptModal) {
          window.openReceiptModal(btn.dataset.instId);
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
        <title>Fechamento de Caixa - ${formatDate(dateStr)} - ${settings.businessName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #0f172a; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; margin: 0; }
          .sub { font-size: 13px; color: #475569; }
          .grid { display: flex; gap: 16px; margin-bottom: 24px; }
          .card { flex: 1; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; }
          .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .card-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .assinatura { margin-top: 50px; display: flex; justify-content: space-between; gap: 40px; }
          .linha { border-top: 1px solid #0f172a; width: 260px; text-align: center; padding-top: 6px; font-size: 12px; }
          @media print {
            body { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${settings.businessName}</div>
          <div class="sub">CNPJ: ${settings.creditorCpfCnpj} • Praça: ${settings.creditorCity}</div>
          <div style="margin-top: 8px; font-size: 16px; font-weight: 700;">RELATÓRIO DE FECHAMENTO DE CAIXA DIÁRIO</div>
          <div class="sub">Data do Movimento: <strong>${formatDate(dateStr)}</strong> | Emissão: ${new Date().toLocaleString('pt-BR')}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">Total em PIX</div>
            <div class="card-val">${formatBRL(report.totalPix)}</div>
          </div>
          <div class="card">
            <div class="card-label">Total em Dinheiro</div>
            <div class="card-val">${formatBRL(report.totalCash)}</div>
          </div>
          <div class="card">
            <div class="card-label">Transferência / TED</div>
            <div class="card-val">${formatBRL(report.totalTransfer)}</div>
          </div>
          <div class="card" style="background: #f8fafc; border: 2px solid #0f172a;">
            <div class="card-label">TOTAL GERAL</div>
            <div class="card-val" style="color: #059669;">${formatBRL(report.totalCollected)}</div>
          </div>
        </div>

        <h3>Demonstrativo de Recebimentos (${report.count} lançamentos)</h3>
        <table>
          <thead>
            <tr>
              <th>Hora/Data</th>
              <th>Cliente</th>
              <th>Parcela</th>
              <th>Forma</th>
              <th>Observação</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${report.entries.map(e => `
              <tr>
                <td>${formatDate(e.date)}</td>
                <td><strong>${e.clientName}</strong></td>
                <td>#${e.installmentNumber}</td>
                <td>${e.method}</td>
                <td>${e.notes || '-'}</td>
                <td style="text-align: right; font-weight: 700;">${formatBRL(e.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="assinatura">
          <div class="linha">
            Responsável pelo Caixa<br>
            <strong>Vando Motos Locadora LTDA</strong>
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
