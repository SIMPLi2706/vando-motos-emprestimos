// src/js/components/clientStatementModal.js
// Extrato Financeiro Consolidado da Conta Corrente do Cliente (Livro Razão, WhatsApp e Impressão)

import { state } from '../state.js';
import { formatBRL, formatDate, createWhatsAppUrl, showToast } from '../utils.js';

export function createClientStatementModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-extrato-cliente';

  modal.innerHTML = `
    <div class="modal-card modal-lg" style="max-width: 820px; border-radius: 6px;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border-soft);">
        <div>
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>📊</span> Extrato Financeiro da Conta Corrente
          </h3>
          <p class="modal-subtitle" id="statement-client-subtitle">Demonstrativo consolidado de crédito, amortizações e juros</p>
        </div>
        <button class="modal-close-btn" id="statement-modal-close">✕</button>
      </div>

      <div class="modal-body" style="padding: 20px; max-height: calc(88vh - 140px); overflow-y: auto;">
        <!-- Header do Cliente e Status -->
        <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 16px; margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #fff; letter-spacing: -0.01em;" id="statement-client-name">-</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;" id="statement-client-meta">CPF: - • Telefone: -</div>
            </div>
            <div id="statement-client-badge-wrap">
              <span class="badge badge-paid">Conta Ativa</span>
            </div>
          </div>
        </div>

        <!-- Grade de KPIs do Extrato -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Capital Emprestado</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--yellow); margin-top: 4px;" id="st-kpi-principal">R$ 0,00</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Saldo Devedor (Capital)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-top: 4px;" id="st-kpi-balance">R$ 0,00</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Juros Quitados (Lucro)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--green); margin-top: 4px;" id="st-kpi-interest-paid">R$ 0,00</div>
          </div>

          <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Total Pago pelo Devedor</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--emerald-400); margin-top: 4px;" id="st-kpi-total-paid">R$ 0,00</div>
          </div>
        </div>

        <!-- Tabela do Livro Razão / Movimentações -->
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
            📜 Histórico Cronológico de Lançamentos
          </h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);" id="statement-entries-count">0 lançamento(s)</span>
        </div>

        <div class="table-responsive" style="border: 1px solid var(--border-soft); border-radius: 4px;">
          <table class="table-mobile-card-view" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;" id="table-statement-entries">
            <thead>
              <tr style="background: var(--bg-2); border-bottom: 1px solid var(--border-soft); text-align: left;">
                <th style="padding: 10px 12px; font-weight: 700; color: var(--text-muted);">Data</th>
                <th style="padding: 10px 12px; font-weight: 700; color: var(--text-muted);">Operação / Lançamento</th>
                <th style="padding: 10px 12px; font-weight: 700; color: var(--text-muted);">Tipo</th>
                <th style="padding: 10px 12px; font-weight: 700; color: var(--text-muted); text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              <!-- Preenchido via script -->
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer" style="border-top: 1px solid var(--border-soft); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <button type="button" class="btn btn-secondary" id="statement-modal-btn-close">
          Fechar
        </button>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary" id="statement-btn-print" style="border-radius: 4px; font-weight: 700;">
            🖨️ Imprimir / PDF
          </button>
          <button type="button" class="btn btn-whatsapp" id="statement-btn-whatsapp" style="border-radius: 4px; font-weight: 800;">
            🟢 Enviar via WhatsApp
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#statement-modal-close');
  const closeFooterBtn = modal.querySelector('#statement-modal-btn-close');
  const printBtn = modal.querySelector('#statement-btn-print');
  const whatsappBtn = modal.querySelector('#statement-btn-whatsapp');

  let activeClientId = null;

  function closeModal() {
    modal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeModal);
  closeFooterBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Exportar / Imprimir extrato
  printBtn.addEventListener('click', () => {
    if (!activeClientId) return;
    const st = state.getClientFinancialStatement(activeClientId);
    if (!st) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Permita popups para imprimir o extrato.', 'error');
      return;
    }

    const settings = state.getSettings();

    const rowsHtml = st.ledgerEntries.map(e => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px 10px;">${formatDate(e.date)}</td>
        <td style="padding: 8px 10px;"><strong>${e.title}</strong><br><small style="color: #666;">${e.description}</small></td>
        <td style="padding: 8px 10px;">${e.type === 'loan_grant' ? 'Crédito Liberado' : e.type === 'rollover' ? 'Rolagem (Juros)' : 'Pagamento'}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: ${e.impact === +1 ? '#b91c1c' : e.impact === -1 ? '#047857' : '#b45309'};">
          ${formatBRL(e.amount)}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Extrato Financeiro - ${st.client.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 40px; color: #111; line-height: 1.4; }
            .header { border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 4px 0; font-size: 20px; text-transform: uppercase; }
            .header p { margin: 0; font-size: 13px; color: #555; }
            .client-card { background: #f9f9f9; border: 1px solid #ccc; padding: 14px; margin-bottom: 20px; border-radius: 4px; }
            .kpis { display: flex; gap: 15px; margin-bottom: 25px; }
            .kpi { flex: 1; border: 1px solid #ddd; padding: 12px; background: #fff; border-radius: 4px; }
            .kpi-title { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; margin-bottom: 4px; }
            .kpi-val { font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
            th { background: #f0f0f0; border-bottom: 2px solid #999; padding: 8px 10px; text-align: left; }
            .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 11px; color: #777; text-align: center; }
            @media print {
              body { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Extrato de Conta Corrente e Gestão de Juros</h1>
            <p>${settings.businessName || 'Sistema Financeiro'} • Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>

          <div class="client-card">
            <strong style="font-size: 16px;">Cliente: ${st.client.name}</strong><br>
            <span>CPF: ${st.client.cpf || 'Não informado'} • Telefone: ${st.client.phone || '-'}</span><br>
            <span>Status Geral: ${st.parcelasAtrasadasQtd > 0 ? 'Inadimplente (' + st.parcelasAtrasadasQtd + ' parcela(s) em atraso)' : 'Em dia'}</span>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="kpi-title">Capital Emprestado</div>
              <div class="kpi-val">${formatBRL(st.totalPrincipalEmprestado)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Saldo Devedor Atual</div>
              <div class="kpi-val">${formatBRL(st.saldoDevedorCapital)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Juros Pagos (Lucro)</div>
              <div class="kpi-val" style="color: #047857;">${formatBRL(st.totalJurosPagos)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Total Pago pelo Devedor</div>
              <div class="kpi-val" style="color: #047857;">${formatBRL(st.totalGeralPago)}</div>
            </div>
          </div>

          <h3 style="font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Demonstrativo Detalhado de Lançamentos</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Operação / Histórico</th>
                <th>Tipo</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Documento de controle financeiro emitido pelo sistema de gestão de crédito e juros.
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  });

  // Enviar extrato formatado para WhatsApp
  whatsappBtn.addEventListener('click', () => {
    if (!activeClientId) return;
    const st = state.getClientFinancialStatement(activeClientId);
    if (!st || !st.client.phone) {
      showToast('O cliente não possui telefone/WhatsApp cadastrado.', 'warning');
      return;
    }

    const settings = state.getSettings();
    const cleanPhone = st.client.phone.replace(/\D/g, '');

    const nextDueTxt = st.nextDueDate ? formatDate(st.nextDueDate) : 'Nenhum vencimento pendente';

    const msg = [
      `*EXTRATO DE CONTA CORRENTE - ${st.client.name.toUpperCase()}*`,
      `_${settings.businessName || 'Gestão Financeira'}_`,
      `Data de emissão: ${formatDate(new Date())}`,
      ``,
      `📌 *RESUMO CONSOLIDADO:*`,
      `• *Capital Emprestado:* ${formatBRL(st.totalPrincipalEmprestado)}`,
      `• *Principal Amortizado:* ${formatBRL(st.totalAmortizado)}`,
      `• *Juros Pagos:* ${formatBRL(st.totalJurosPagos)}`,
      `• *Total Já Pago:* ${formatBRL(st.totalGeralPago)}`,
      `-----------------------------`,
      `⚠️ *SALDO DEVEDOR ATUAL (Capital):* ${formatBRL(st.saldoDevedorCapital)}`,
      `📅 *Próximo Vencimento:* ${nextDueTxt}`,
      ``,
      st.parcelasAtrasadasQtd > 0 ? `🚨 *Atenção:* Constam ${st.parcelasAtrasadasQtd} parcela(s) em atraso. Entre em contato para regularizar.` : `✅ *Situação:* Parcelamento em dia!`,
      ``,
      `Chave PIX: ${settings.pixKey || settings.creditorCpfCnpj || '-'}`,
      `Favorecido: ${settings.pixHolder || settings.businessName || '-'}`
    ].join('\n');

    const url = createWhatsAppUrl(cleanPhone, msg);
    window.open(url, '_blank');
  });

  window.openClientStatementModal = function(clientId) {
    activeClientId = clientId;
    const st = state.getClientFinancialStatement(clientId);
    if (!st) return;

    modal.querySelector('#statement-client-name').textContent = st.client.name;
    modal.querySelector('#statement-client-meta').textContent = `CPF: ${st.client.cpf || 'Não informado'} • Telefone: ${st.client.phone || '-'}`;

    const badgeWrap = modal.querySelector('#statement-client-badge-wrap');
    if (st.parcelasAtrasadasQtd > 0) {
      badgeWrap.innerHTML = `<span class="badge badge-overdue">Inadimplente (${st.parcelasAtrasadasQtd} em atraso)</span>`;
    } else if (st.saldoDevedorCapital > 0) {
      badgeWrap.innerHTML = `<span class="badge badge-pending">Em Aberto (Em dia)</span>`;
    } else {
      badgeWrap.innerHTML = `<span class="badge badge-paid">Quitado / Sem Dívida</span>`;
    }

    modal.querySelector('#st-kpi-principal').textContent = formatBRL(st.totalPrincipalEmprestado);
    modal.querySelector('#st-kpi-balance').textContent = formatBRL(st.saldoDevedorCapital);
    modal.querySelector('#st-kpi-interest-paid').textContent = formatBRL(st.totalJurosPagos);
    modal.querySelector('#st-kpi-total-paid').textContent = formatBRL(st.totalGeralPago);

    const tbody = modal.querySelector('#table-statement-entries tbody');
    modal.querySelector('#statement-entries-count').textContent = `${st.ledgerEntries.length} lançamento(s)`;

    if (st.ledgerEntries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum lançamento financeiro registrado.</td></tr>`;
    } else {
      tbody.innerHTML = st.ledgerEntries.map(e => {
        let badgeType = '';
        let amountColor = '#fff';
        let prefix = '';

        if (e.impact === +1) {
          badgeType = `<span class="badge badge-overdue" style="font-size: 0.68rem;">Dívida (+)</span>`;
          amountColor = 'var(--rose-400)';
          prefix = '+';
        } else if (e.impact === -1) {
          badgeType = `<span class="badge badge-paid" style="font-size: 0.68rem;">Pagamento (-)</span>`;
          amountColor = 'var(--emerald-400)';
          prefix = '-';
        } else {
          badgeType = `<span class="badge badge-rollover" style="font-size: 0.68rem; background: rgba(245, 197, 24, 0.2); color: var(--yellow); border-color: rgba(245, 197, 24, 0.4);">Rolagem (Juros)</span>`;
          amountColor = 'var(--yellow)';
          prefix = '';
        }

        return `
          <tr style="border-bottom: 1px solid var(--border-soft);">
            <td data-label="Data" style="padding: 10px 12px; white-space: nowrap;">
              <div class="td-cell-val">${formatDate(e.date)}</div>
            </td>
            <td data-label="Operação" style="padding: 10px 12px;">
              <div class="td-cell-val">
                <div style="font-weight: 700; color: #fff;">${e.title}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${e.description}</div>
              </div>
            </td>
            <td data-label="Tipo" style="padding: 10px 12px;">
              <div class="td-cell-val">${badgeType}</div>
            </td>
            <td data-label="Valor" style="padding: 10px 12px; text-align: right; font-weight: 800; color: ${amountColor};">
              <div class="td-cell-val">${prefix} ${formatBRL(e.amount)}</div>
            </td>
          </tr>
        `;
      }).join('');
    }

    modal.classList.add('active');
  };
}
