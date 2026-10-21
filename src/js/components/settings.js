// src/js/components/settings.js
// Configurações do Negócio, Chave PIX, Template do WhatsApp e Backup de Dados - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { showToast } from '../utils.js';
import { openMonthlyReportModal } from './pdfExport.js';
import { isPinEnabled, setPinEnabled, getStoredPin, setStoredPin, lockSession } from './loginScreen.js';
import { isSupabaseConfigured, testSupabaseConnection } from '../supabaseClient.js';
import { icon } from '../icons.js';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view animate-fade-in';

  const settings = state.getSettings();
  const pinActive = isPinEnabled();
  const isCloudActive = isSupabaseConfigured();
  const geminiKey = state.getGeminiApiKey();
  const hasGeminiKey = Boolean(geminiKey);

  container.innerHTML = `
    <div class="settings-grid">
      
      <!-- Card: Dados do Credor e PIX -->
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
              <input type="text" class="form-control" id="set-business-name" value="${settings.businessName || ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label">CNPJ / CPF do Credor *</label>
              <input type="text" class="form-control" id="set-creditor-doc" value="${settings.creditorCpfCnpj || ''}" required placeholder="00.000.000/0000-00">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Cidade / Praça do Acordo *</label>
              <input type="text" class="form-control" id="set-creditor-city" value="${settings.creditorCity || ''}" required placeholder="Ex: PORTO VELHO - RO">
            </div>

            <div class="form-group">
              <label class="form-label">Titular da Conta PIX *</label>
              <input type="text" class="form-control" id="set-pix-holder" value="${settings.pixHolder || ''}" required>
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
              <input type="text" class="form-control" id="set-pix-key" value="${settings.pixKey || ''}" required>
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

      <!-- Card: Template de Mensagem de Cobrança WhatsApp -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Modelo de Mensagem (WhatsApp)</h3>
            <p class="card-subtitle">Texto enviado aos clientes na cobrança de parcelas</p>
          </div>
        </div>

        <form id="form-settings-wpp">
          <div class="form-group">
            <label class="form-label">Mensagem Personalizada</label>
            <textarea class="form-control" id="set-wpp-template" rows="7" style="font-family: inherit; font-size: 0.88rem;">${settings.whatsappTemplate || ''}</textarea>
          </div>

          <div style="background: var(--bg-3); border: 1px solid var(--border-soft); padding: 12px; border-radius: var(--r-sm); font-size: 0.78rem; color: var(--text-300); margin-bottom: 16px;">
            <strong>Variáveis dinâmicas disponíveis:</strong><br>
            <code>{cliente}</code> • <code>{parcela_num}</code> • <code>{valor_parcela}</code> • <code>{data_vencimento}</code> • <code>{chave_pix}</code> • <code>{titular_pix}</code>
          </div>

          <button type="submit" class="btn btn-primary">
            Atualizar Modelo
          </button>
        </form>
      </div>

      <!-- Card: Segurança & PIN de Acesso -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Segurança & PIN de Acesso</h3>
            <p class="card-subtitle">Controle de acesso por código de 4 dígitos</p>
          </div>
        </div>

        <div style="margin-bottom: 18px; padding: 12px; background: var(--bg-3); border: 1px solid var(--border-soft); border-radius: var(--r-sm);">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" id="toggle-enable-pin" ${pinActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--yellow);">
            <span style="font-weight: 600; font-size: 0.9rem;">Exigir PIN ao abrir o aplicativo</span>
          </label>
          <p style="font-size: 0.75rem; color: var(--text-400); margin-top: 4px; margin-left: 28px;">
            Se desmarcado, o sistema abre diretamente no Dashboard sem pedir senha.
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
              Bloquear Agora
            </button>
          </div>
        </form>
      </div>

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

          <label class="btn btn-secondary" style="cursor: pointer; margin-bottom: 0; justify-content: flex-start;">
            ${icon('upload', 15)} Restaurar Cópia de Backup
            <input type="file" id="input-import-backup" accept=".json" style="display: none;">
          </label>

          <div style="border-top: 1px solid var(--border-soft); padding-top: 14px; margin-top: 6px;">
            <p style="font-size: 0.75rem; color: var(--text-400); margin-bottom: 10px;">Ações Críticas do Sistema:</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-secondary" id="btn-force-update-cache" style="color: var(--cyan); border-color: rgba(6,182,212,0.3); justify-content: flex-start;">
                ${icon('refresh', 14)} Sincronizar Versão Mais Recente (Limpar Cache)
              </button>
              <button class="btn btn-danger" id="btn-wipe-all" style="justify-content: flex-start;">
                ${icon('trash', 14)} Zerar Todos os Dados
              </button>
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
              <input type="password" class="form-control" id="set-gemini-key" placeholder="AIzaSy..." value="${geminiKey || ''}" autocomplete="off" style="font-family: monospace; padding-right: 40px;">
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

    container.querySelector('#form-settings-wpp')?.addEventListener('submit', (e) => {
      e.preventDefault();
      state.saveSettings({
        whatsappTemplate: container.querySelector('#set-wpp-template').value
      });
      showToast('Modelo de mensagem do WhatsApp atualizado!');
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
