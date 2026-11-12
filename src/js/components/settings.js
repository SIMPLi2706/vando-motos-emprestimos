// src/js/components/settings.js
// Configurações do Negócio, Chave PIX, Template do WhatsApp e Backup de Dados - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { showToast, escapeHtml, DEFAULT_WHATSAPP_STAGE_TEMPLATES } from '../utils.js';
import { openMonthlyReportModal } from './pdfExport.js';
import { isPinEnabled, setPinEnabled, getStoredPin, setStoredPin, lockSession, isAdmin, getCurrentOperator, openOperatorSwitch } from './loginScreen.js';
import { isSupabaseConfigured, testSupabaseConnection } from '../supabaseClient.js';
import { icon } from '../icons.js';

const WPP_STAGE_META = [
  { id: 'upcoming', label: '1. Preventivo (Antes)' },
  { id: 'dueToday', label: '2. Vence Hoje' },
  { id: 'overdueLight', label: '3. Atraso 1–5d' },
  { id: 'overdueMedium', label: '4. Atraso 6–15d' },
  { id: 'overdueCritical', label: '5. Crítico +15d' }
];

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view animate-fade-in';

  const settings = state.getSettings();
  const pinActive = isPinEnabled();
  const isCloudActive = isSupabaseConfigured();
  const geminiKey = state.getGeminiApiKey();
  const hasGeminiKey = Boolean(geminiKey);
  const adminAllowed = isAdmin();
  const currentOp = getCurrentOperator();
  const operators = state.getOperators();
  const auditLogs = state.getAuditLogs(40);
  const stageTemplates = {
    ...DEFAULT_WHATSAPP_STAGE_TEMPLATES,
    ...(settings.whatsappTemplates || {})
  };
  let activeStage = 'dueToday';

  container.innerHTML = `
    ${!adminAllowed ? `
      <div class="alert-overdue" style="margin-bottom: 18px; border-color: rgba(245, 197, 24, 0.35); background: rgba(245, 197, 24, 0.08);">
        <div class="alert-content">
          <div class="alert-title" style="color: var(--yellow);">Operador Conectado: ${escapeHtml(currentOp.name)} (Perfil Cobrador)</div>
          <div class="alert-body">Configurações empresariais, operadoras e exclusão total ficam restritas ao Administrador.</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-switch-op-banner">Trocar Operador</button>
      </div>
    ` : ''}

    <div class="settings-grid">
      
      <!-- Card: Dados do Credor e PIX -->
      ${adminAllowed ? `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Perfil do Negócio & PIX</h3>
            <p class="card-subtitle">Informações que saem nos comprovantes, notas promissórias e mensagens</p>
          </div>
        </div>

        <form id="form-settings-pix">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nome da Empresa / Locadora *</label>
              <input type="text" class="form-control" id="set-business-name" value="${escapeHtml(settings.businessName || '')}" required>
            </div>

            <div class="form-group">
              <label class="form-label">CNPJ / CPF do Credor *</label>
              <input type="text" class="form-control" id="set-creditor-doc" value="${escapeHtml(settings.creditorCpfCnpj || '')}" required placeholder="00.000.000/0000-00">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Cidade / Praça do Acordo *</label>
              <input type="text" class="form-control" id="set-creditor-city" value="${escapeHtml(settings.creditorCity || '')}" required placeholder="Ex: PORTO VELHO - RO">
            </div>

            <div class="form-group">
              <label class="form-label">Titular da Conta PIX *</label>
              <input type="text" class="form-control" id="set-pix-holder" value="${escapeHtml(settings.pixHolder || '')}" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Tipo da Chave PIX</label>
              <select class="form-control" id="set-pix-type">
                <option value="CPF/CNPJ" ${settings.pixType === 'CPF/CNPJ' ? 'selected' : ''}>CPF / CNPJ</option>
                <option value="Celular" ${settings.pixType === 'Celular' ? 'selected' : ''}>Celular</option>
                <option value="E-mail" ${settings.pixType === 'E-mail' ? 'selected' : ''}>E-mail</option>
                <option value="Aleatória" ${settings.pixType === 'Aleatória' ? 'selected' : ''}>Chave Aleatória</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Chave PIX *</label>
              <input type="text" class="form-control" id="set-pix-key" value="${escapeHtml(settings.pixKey || '')}" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Multa por Atraso (%)</label>
              <input type="number" class="form-control" id="set-penalty-rate" value="${settings.defaultPenaltyRate || 2.0}" step="0.1" required>
            </div>

            <div class="form-group">
              <label class="form-label">Juros de Mora Diários (%)</label>
              <input type="number" class="form-control" id="set-daily-rate" value="${settings.defaultDailyRate || 0.1}" step="0.01" required>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
            Salvar Configurações
          </button>
        </form>
      </div>
      ` : ''}

      <!-- Card: Régua de Mensagens WhatsApp em 5 Estágios -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Régua de Cobrança WhatsApp (5 Estágios)</h3>
            <p class="card-subtitle">Personalize cada estágio da régua automática de cobrança</p>
          </div>
        </div>

        <div class="wpp-stage-tabs" id="wpp-stage-tabs">
          ${WPP_STAGE_META.map(s => `
            <button type="button" class="doc-tab-btn ${s.id === activeStage ? 'active' : ''}" data-wpp-stage="${s.id}">${s.label}</button>
          `).join('')}
        </div>

        <form id="form-settings-wpp">
          <div class="form-group">
            <label class="form-label" id="wpp-stage-label">Mensagem do Estágio: 2. Vence Hoje</label>
            <textarea class="form-control" id="set-wpp-template" rows="7" style="font-family: inherit; font-size: 0.88rem;">${escapeHtml(stageTemplates[activeStage] || '')}</textarea>
          </div>

          <div style="background: var(--bg-3); border: 1px solid var(--border-soft); padding: 12px; border-radius: var(--r-sm); font-size: 0.78rem; color: var(--text-300); margin-bottom: 16px;">
            <strong>Variáveis dinâmicas disponíveis:</strong><br>
            <code>{cliente}</code> • <code>{parcela_num}</code> • <code>{valor_parcela}</code> • <code>{data_vencimento}</code> • <code>{dias_atraso}</code> • <code>{chave_pix}</code> • <code>{titular_pix}</code>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary">
              ${icon('save', 14)} Salvar Régua WhatsApp
            </button>
            <button type="button" class="btn btn-secondary" id="btn-reset-wpp-stage">
              Restaurar Estágio Padrão
            </button>
          </div>
        </form>
      </div>

      <!-- Card: Segurança & PIN de Acesso -->
      ${adminAllowed ? `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Segurança & PIN Mestre (Admin)</h3>
            <p class="card-subtitle">Controle de acesso principal por código de 4 dígitos</p>
          </div>
        </div>

        <div style="margin-bottom: 18px; padding: 12px; background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm);">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="toggle-enable-pin" ${pinActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--yellow);">
            <span style="font-weight: 600; font-size: 0.9rem;">Exigir PIN ao abrir o aplicativo</span>
          </label>
          <p style="font-size: 0.75rem; color: var(--text-400); margin-top: 4px; margin-left: 28px;">
            Se desmarcado, o sistema abre diretamente no Dashboard sem pedir senha (exceto se houver múltiplos operadores ativos).
          </p>
        </div>

        <form id="form-settings-pin">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">PIN Atual *</label>
              <input type="password" class="form-control" id="set-current-pin" maxlength="4" placeholder="••••" inputmode="numeric">
            </div>

            <div class="form-group">
              <label class="form-label">Novo PIN (4 dígitos) *</label>
              <input type="password" class="form-control" id="set-new-pin" maxlength="4" placeholder="••••" inputmode="numeric">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Confirmar Novo PIN *</label>
            <input type="password" class="form-control" id="set-confirm-pin" maxlength="4" placeholder="••••" inputmode="numeric">
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary">
              Salvar Novo PIN
            </button>
            <button type="button" class="btn btn-secondary" id="btn-lock-session">
              Bloquear / Trocar Operador
            </button>
          </div>
        </form>
      </div>

      <!-- Card: Equipe / Operadores & Permissões -->
      <div class="card" id="card-operators">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('userCheck', 17)} Equipe / Operadores & Permissões</h3>
            <p class="card-subtitle">Cobradores possuem PIN próprio e não podem excluir contratos ou zerar dados</p>
          </div>
          <span class="badge badge-pending">${operators.length} operador(es)</span>
        </div>

        <form id="form-add-operator" style="margin-bottom: 16px; background: var(--bg-3); padding: 12px; border-radius: var(--r-sm); border: 1px solid var(--border-soft);">
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Nome do Operador *</label>
              <input type="text" class="form-control" id="op-name" placeholder="Ex: João Cobrador" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Perfil / Permissão</label>
              <select class="form-control" id="op-role">
                <option value="collector">Cobrador (Restrito)</option>
                <option value="admin">Administrador (Total)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">PIN (4 dígitos) *</label>
              <input type="password" inputmode="numeric" maxlength="4" class="form-control" id="op-pin" placeholder="1234" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 10px;">
            ${icon('plus', 14)} Adicionar Operador
          </button>
        </form>

        <div id="operators-list-wrap" style="display: flex; flex-direction: column; gap: 8px;">
          ${operators.length === 0 ? `
            <p style="font-size: 0.82rem; color: var(--text-400); text-align: center; padding: 10px 0;">
              Nenhum operador extra cadastrado. Apenas o Administrador Mestre acessa o sistema.
            </p>
          ` : operators.map(op => `
            <div class="operator-row-card">
              <div>
                <div style="font-weight: 700; color: #fff;">
                  ${escapeHtml(op.name)}
                  <span class="badge ${op.role === 'admin' ? 'badge-paid' : 'badge-pending'}" style="margin-left: 6px; font-size: 0.68rem;">
                    ${op.role === 'admin' ? 'Admin' : 'Cobrador'}
                  </span>
                  ${op.active === false ? '<span class="badge badge-overdue" style="margin-left: 4px; font-size: 0.68rem;">Inativo</span>' : ''}
                </div>
                <div style="font-size: 0.74rem; color: var(--text-400);">PIN configurado • Acesso individual no login</div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm btn-toggle-op" data-op-id="${op.id}">
                  ${op.active === false ? 'Reativar' : 'Desativar'}
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-del-op" data-op-id="${op.id}">
                  Remover
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Card: Backup e Gestão de Dados -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Backup & Gestão de Dados</h3>
            <p class="card-subtitle">Exporte relatórios oficiais em PDF ou faça backup completo</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button type="button" class="btn btn-primary" id="btn-export-monthly-pdf" style="justify-content: flex-start;">
            ${icon('fileText', 15)} Gerar Relatório Mensal (PDF Oficial)
          </button>

          <button class="btn btn-secondary" id="btn-export-backup" style="justify-content: flex-start;">
            ${icon('download', 15)} Baixar Cópia de Segurança (JSON)
          </button>

          ${adminAllowed ? `
          <label class="btn btn-secondary" style="cursor: pointer; margin-bottom: 0; justify-content: flex-start;">
            ${icon('upload', 15)} Restaurar Cópia de Backup
            <input type="file" id="input-import-backup" accept=".json" style="display: none;">
          </label>
          ` : ''}

          <div style="border-top: 1px solid var(--border-soft); padding-top: 14px; margin-top: 6px;">
            <p style="font-size: 0.75rem; color: var(--text-400); margin-bottom: 10px;">Ações Críticas do Sistema:</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-secondary" id="btn-force-update-cache" style="color: var(--cyan); border-color: rgba(6,182,212,0.3); justify-content: flex-start;">
                ${icon('refresh', 14)} Sincronizar Versão Mais Recente (Limpar Cache)
              </button>
              ${adminAllowed ? `
              <button class="btn btn-danger" id="btn-wipe-all" style="justify-content: flex-start;">
                ${icon('trash', 14)} Zerar Todos os Dados
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Card: Sincronização em Nuvem (Supabase / Banco de Dados) -->
      <div class="card" id="card-supabase-sync">
        <div class="card-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="card-title">Sincronização em Nuvem</h3>
              <span class="badge ${isCloudActive ? 'badge-paid' : 'badge-pending'}" id="supabase-status-badge">
                ${isCloudActive ? '● Conectado' : '○ Offline'}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" id="btn-pull-supabase" title="Baixa os dados mais recentes do banco em nuvem">
            ${icon('refresh', 14)} Sincronizar Agora
          </button>
          <button type="button" class="btn btn-secondary" id="btn-push-supabase" title="Envia todos os dados deste aparelho para o banco em nuvem">
            ${icon('upload', 14)} Forçar Upload
          </button>
          <button type="button" class="btn btn-secondary" id="btn-test-supabase">
            ${icon('zap', 14)} Testar Conexão
          </button>
        </div>
      </div>

      <!-- Card: Inteligência Artificial (Google Gemini Vision) -->
      ${adminAllowed ? `
      <div class="card" id="card-gemini-ai">
        <div class="card-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="card-title">Leitura de Documentos por IA</h3>
              <span class="badge ${hasGeminiKey ? 'badge-paid' : 'badge-pending'}" id="gemini-status-badge">
                ${hasGeminiKey ? '● IA Ativa' : '○ Chave Pendente'}
              </span>
            </div>
          </div>
        </div>

        <form id="form-settings-gemini">
          <div class="form-group">
            <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <span>Chave de API — Google AI Studio</span>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="font-size: 0.75rem; color: var(--cyan); text-decoration: underline;">
                Obter Chave no Google AI Studio
              </a>
            </label>
            <div style="position: relative;">
              <input type="password" class="form-control" id="set-gemini-key" placeholder="AIzaSy..." value="${escapeHtml(geminiKey || '')}" autocomplete="off" style="font-family: monospace; padding-right: 40px;">
              <button type="button" class="btn btn-sm" id="btn-toggle-gemini-key" title="Ver/Ocultar Chave" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 0.95rem; cursor: pointer; color: var(--text-300);">${icon('eye', 16)}</button>
            </div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary">
              ${icon('save', 14)} Salvar Chave
            </button>
            <button type="button" class="btn btn-secondary" id="btn-test-gemini-ai">
              ${icon('flask', 14)} Testar Conexão
            </button>
          </div>
        </form>
      </div>
      ` : ''}

      <!-- Card: Log de Auditoria -->
      ${adminAllowed ? `
      <div class="card" id="card-audit-log" style="grid-column: 1 / -1;">
        <div class="card-header">
          <div>
            <h3 class="card-title">${icon('history', 17)} Log de Auditoria (Trilha de Segurança)</h3>
            <p class="card-subtitle">Registro cronológico das últimas operações realizadas por operador</p>
          </div>
          <span class="badge badge-pending">${auditLogs.length} registro(s)</span>
        </div>

        ${auditLogs.length === 0 ? `
          <div class="empty-state-box" style="padding: 20px;">
            <p>Nenhuma atividade registrada na trilha de auditoria ainda.</p>
          </div>
        ` : `
          <div class="table-responsive" style="max-height: 290px; overflow-y: auto;">
            <table class="table table-mobile-card-view">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Operador</th>
                  <th>Evento</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map(log => `
                  <tr>
                    <td data-label="Data/Hora" style="white-space: nowrap; font-size: 0.78rem; color: var(--text-300);">
                      <div class="td-cell-val">${new Date(log.timestamp).toLocaleString('pt-BR')}</div>
                    </td>
                    <td data-label="Operador" style="font-size: 0.82rem; font-weight: 700;">
                      <div class="td-cell-val">${escapeHtml(log.operator || 'Administrador')}</div>
                    </td>
                    <td data-label="Evento">
                      <div class="td-cell-val"><span class="badge badge-pending" style="font-size: 0.68rem;">${escapeHtml(log.action)}</span></div>
                    </td>
                    <td data-label="Detalhes" style="font-size: 0.82rem; color: var(--text-200);">
                      <div class="td-cell-val">${escapeHtml(log.details)}</div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
      ` : ''}

    </div>
  `;

  setTimeout(() => {
    container.querySelector('#form-settings-pix')?.addEventListener('submit', (e) => {
      e.preventDefault();
      state.saveSettings({
        businessName: container.querySelector('#set-business-name').value,
        creditorCpfCnpj: container.querySelector('#set-creditor-doc').value,
        creditorCity: container.querySelector('#set-creditor-city').value,
        pixType: container.querySelector('#set-pix-type').value,
        pixKey: container.querySelector('#set-pix-key').value,
        pixHolder: container.querySelector('#set-pix-holder').value,
        defaultPenaltyRate: Number(container.querySelector('#set-penalty-rate').value),
        defaultDailyRate: Number(container.querySelector('#set-daily-rate').value)
      });
      showToast('Configurações salvas com sucesso!');
      window.updateBrandDisplay();
    });

    container.querySelector('#btn-switch-op-banner')?.addEventListener('click', () => {
      openOperatorSwitch();
    });

    // Régua de WhatsApp em 5 estágios
    const wppTextarea = container.querySelector('#set-wpp-template');
    const wppStageLabel = container.querySelector('#wpp-stage-label');
    container.querySelectorAll('#wpp-stage-tabs [data-wpp-stage]').forEach(tab => {
      tab.addEventListener('click', () => {
        if (wppTextarea) stageTemplates[activeStage] = wppTextarea.value;
        activeStage = tab.dataset.wppStage;
        container.querySelectorAll('#wpp-stage-tabs [data-wpp-stage]').forEach(t => t.classList.toggle('active', t === tab));
        const meta = WPP_STAGE_META.find(m => m.id === activeStage);
        if (wppStageLabel && meta) wppStageLabel.textContent = `Mensagem do Estágio: ${meta.label}`;
        if (wppTextarea) wppTextarea.value = stageTemplates[activeStage] || '';
      });
    });

    container.querySelector('#btn-reset-wpp-stage')?.addEventListener('click', () => {
      stageTemplates[activeStage] = DEFAULT_WHATSAPP_STAGE_TEMPLATES[activeStage] || '';
      if (wppTextarea) wppTextarea.value = stageTemplates[activeStage];
      showToast('Texto padrão restaurado no editor. Clique em Salvar para aplicar.', 'info');
    });

    container.querySelector('#form-settings-wpp')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (wppTextarea) stageTemplates[activeStage] = wppTextarea.value;
      state.saveSettings({
        whatsappTemplates: { ...stageTemplates },
        whatsappTemplate: stageTemplates.dueToday || settings.whatsappTemplate
      });
      state.logAudit('UPDATE_WHATSAPP_RULES', 'Régua de cobrança WhatsApp (5 estágios) atualizada', 'settings', 'whatsapp');
      showToast('Régua de cobrança WhatsApp atualizada com sucesso!');
    });

    // Gestão de Operadores & Permissões
    container.querySelector('#form-add-operator')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = container.querySelector('#op-name')?.value?.trim();
      const role = container.querySelector('#op-role')?.value || 'collector';
      const pin = container.querySelector('#op-pin')?.value?.trim();
      if (!name) {
        showToast('Informe o nome do operador.', 'error');
        return;
      }
      try {
        state.saveOperator({ name, role, pin, active: true });
        setPinEnabled(true);
        showToast(`Operador ${name} adicionado! Tela de PIN ativada automaticamente.`, 'success');
        window.refreshCurrentTab();
      } catch (err) {
        showToast(err.message || 'Erro ao adicionar operador', 'error');
      }
    });

    container.querySelectorAll('.btn-toggle-op').forEach(btn => {
      btn.addEventListener('click', () => {
        const op = state.getOperators().find(o => o.id === btn.dataset.opId);
        if (!op) return;
        state.saveOperator({ ...op, active: op.active === false });
        showToast(`Operador ${op.name} ${op.active === false ? 'reativado' : 'desativado'}.`);
        window.refreshCurrentTab();
      });
    });

    container.querySelectorAll('.btn-del-op').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Deseja remover este operador?')) {
          state.deleteOperator(btn.dataset.opId);
          showToast('Operador removido.');
          window.refreshCurrentTab();
        }
      });
    });

    container.querySelector('#btn-export-backup')?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(state.exportBackup());
      const downloadAnchor = document.createElement('a');
      const now = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `backup_emprestimos_${now}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Backup baixado com sucesso!');
    });

    container.querySelector('#btn-export-monthly-pdf')?.addEventListener('click', () => {
      openMonthlyReportModal();
    });

    const fileInput = container.querySelector('#input-import-backup');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          state.importBackup(event.target.result);
          showToast('Backup restaurado com sucesso!');
          window.refreshCurrentTab();
          window.updateBrandDisplay();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      reader.readAsText(file);
    });

    container.querySelector('#btn-force-update-cache')?.addEventListener('click', async () => {
      if (confirm('Deseja recarregar o sistema e baixar a versão mais recente diretamente do servidor?')) {
        showToast('Atualizando sistema e limpando cache local...', 'info');
        if (window.forceCleanAppUpdate) {
          await window.forceCleanAppUpdate();
        } else {
          window.location.reload(true);
        }
      }
    });

    container.querySelector('#btn-wipe-all')?.addEventListener('click', async () => {
      if (confirm('ATENÇÃO: Isso vai apagar TODOS os clientes, empréstimos e parcelas do sistema e do banco na nuvem. O sistema ficará 100% limpo para você começar do zero. Confirmar?')) {
        showToast('Apagando todos os dados do sistema e da nuvem...');
        await state.wipeAllData();
        showToast('Sistema e banco em nuvem zerados com sucesso!', 'success');
        window.refreshCurrentTab();
      }
    });

    const togglePin = container.querySelector('#toggle-enable-pin');
    togglePin?.addEventListener('change', (e) => {
      setPinEnabled(e.target.checked);
      showToast(e.target.checked ? 'Proteção por PIN ativada!' : 'Proteção por PIN desativada!');
    });

    const formPin = container.querySelector('#form-settings-pin');
    formPin?.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentPinInput = container.querySelector('#set-current-pin').value;
      const newPinInput = container.querySelector('#set-new-pin').value;
      const confirmPinInput = container.querySelector('#set-confirm-pin').value;

      const storedPin = getStoredPin();
      if (currentPinInput !== storedPin) {
        showToast('PIN atual incorreto.', 'error');
        return;
      }

      if (!/^\d{4}$/.test(newPinInput)) {
        showToast('O novo PIN deve ter exatamente 4 dígitos numéricos.', 'error');
        return;
      }

      if (newPinInput !== confirmPinInput) {
        showToast('A confirmação do PIN não confere.', 'error');
        return;
      }

      setStoredPin(newPinInput);
      setPinEnabled(true);
      if (togglePin) togglePin.checked = true;
      showToast('Novo PIN salvo com sucesso!', 'success');
      formPin.reset();
    });

    container.querySelector('#btn-lock-session')?.addEventListener('click', () => {
      lockSession();
    });

    // Eventos do Supabase (Banco de Dados em Nuvem)
    container.querySelector('#btn-test-supabase')?.addEventListener('click', async () => {
      showToast('Testando conexão com o banco de dados em nuvem...');
      const res = await testSupabaseConnection();
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(`Falha: ${res.error}`, 'error');
      }
    });

    container.querySelector('#btn-push-supabase')?.addEventListener('click', async () => {
      if (!isSupabaseConfigured()) {
        showToast('Supabase não configurado.', 'error');
        return;
      }
      try {
        showToast('Enviando clientes e contratos para a nuvem...');
        const res = await state.syncToSupabase();
        showToast(`Dados enviados com sucesso! (${res.count.clients} clientes, ${res.count.loans} empréstimos)`, 'success');
      } catch (err) {
        showToast(`Erro ao sincronizar: ${err.message}`, 'error');
      }
    });

    container.querySelector('#btn-pull-supabase')?.addEventListener('click', async () => {
      if (!isSupabaseConfigured()) {
        showToast('Supabase não configurado.', 'error');
        return;
      }
      try {
        showToast('Baixando dados mais recentes da nuvem...');
        await state.syncFromSupabase();
        showToast('Dados sincronizados com sucesso!', 'success');
        window.refreshCurrentTab();
      } catch (err) {
        showToast(`Erro ao baixar dados: ${err.message}`, 'error');
      }
    });


    // --- Configuração da IA Google Gemini ---
    const geminiInput = container.querySelector('#set-gemini-key');
    const toggleGeminiBtn = container.querySelector('#btn-toggle-gemini-key');
    const badgeGemini = container.querySelector('#gemini-status-badge');

    toggleGeminiBtn?.addEventListener('click', () => {
      if (geminiInput.type === 'password') {
        geminiInput.type = 'text';
        toggleGeminiBtn.innerHTML = icon('eyeOff', 16);
      } else {
        geminiInput.type = 'password';
        toggleGeminiBtn.innerHTML = icon('eye', 16);
      }
    });

    container.querySelector('#form-settings-gemini')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const keyVal = geminiInput.value.trim();
      state.setGeminiApiKey(keyVal);
      if (keyVal) {
        badgeGemini.textContent = '● IA Pronta e Ativa';
        badgeGemini.className = 'badge badge-paid';
        showToast('Chave da IA salva com sucesso!', 'success');
      } else {
        badgeGemini.textContent = '○ Chave Pendente';
        badgeGemini.className = 'badge badge-pending';
        showToast('Chave da IA removida.', 'info');
      }
    });

    container.querySelector('#btn-test-gemini-ai')?.addEventListener('click', async () => {
      const keyVal = geminiInput.value.trim() || state.getGeminiApiKey();
      if (!keyVal) {
        showToast('Insira uma chave do Google Gemini antes de testar.', 'warning');
        return;
      }

      showToast('Testando conexão com a IA do Google Gemini...', 'info');
      const testModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      let connectedModel = null;
      let lastErr = null;

      for (const m of testModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${keyVal}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Responda apenas com a palavra OK' }] }]
            })
          });

          if (res.ok) {
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
              connectedModel = m;
              break;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            lastErr = new Error(errData.error?.message || `Erro HTTP ${res.status}`);
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (connectedModel) {
        badgeGemini.textContent = '● IA Pronta e Ativa';
        badgeGemini.className = 'badge badge-paid';
        showToast(`Conexão validada com sucesso via ${connectedModel}! A IA está pronta para ler documentos.`, 'success');
      } else {
        badgeGemini.textContent = 'Erro na Chave';
        badgeGemini.className = 'badge badge-overdue';
        showToast(`Falha no teste da IA: ${lastErr?.message || 'Modelo indisponível'}`, 'error');
      }
    });
  }, 0);

  return container;
}
