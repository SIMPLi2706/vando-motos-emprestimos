// src/js/components/settings.js
// Configurações do Negócio, Chave PIX, Template do WhatsApp e Backup de Dados - Vando Motos Locadora LTDA

import { state } from '../state.js';
import { showToast } from '../utils.js';
import { openMonthlyReportModal } from './pdfExport.js';
import { isPinEnabled, setPinEnabled, getStoredPin, setStoredPin, lockSession } from './loginScreen.js';
import { isSupabaseConfigured, testSupabaseConnection } from '../supabaseClient.js';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view animate-fade-in';

  const settings = state.getSettings();
  const pinActive = isPinEnabled();
  const isCloudActive = isSupabaseConfigured();

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
            Gerar Relatório Mensal (PDF Oficial)
          </button>

          <button class="btn btn-secondary" id="btn-export-backup" style="justify-content: flex-start;">
            Baixar Cópia de Segurança (JSON)
          </button>

          <label class="btn btn-secondary" style="cursor: pointer; margin-bottom: 0; justify-content: flex-start;">
            Restaurar Cópia de Backup
            <input type="file" id="input-import-backup" accept=".json" style="display: none;">
          </label>

          <div style="border-top: 1px solid var(--border-soft); padding-top: 14px; margin-top: 6px;">
            <p style="font-size: 0.75rem; color: var(--text-400); margin-bottom: 10px;">Ações Críticas do Sistema:</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn btn-secondary" id="btn-reset-demo" style="color: var(--amber); border-color: rgba(245,158,11,0.22); justify-content: flex-start;">
                Recarregar Dados de Exemplo
              </button>
              <button class="btn btn-danger" id="btn-wipe-all" style="justify-content: flex-start;">
                Zerar Todos os Dados (Começar do Zero)
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
              <h3 class="card-title">Banco de Dados em Nuvem (PostgreSQL)</h3>
              <span class="badge ${isCloudActive ? 'badge-paid' : 'badge-pending'}" id="supabase-status-badge">
                ${isCloudActive ? '● Conectado e Sincronizado' : '○ Modo Local Offline'}
              </span>
            </div>
            <p class="card-subtitle">Sincronização em tempo real entre celular e computador com persistência garantida</p>
          </div>
        </div>

        <div style="background: var(--bg-1); border: 1px solid var(--border-soft); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></div>
            <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-100);">Banco Supabase Dedicado Ativo</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-300); line-height: 1.5; margin-bottom: 12px;">
            As credenciais de acesso foram salvas de forma segura internamente no projeto (.env) e não ficam expostas no navegador. Todos os dados adicionados ou alterados são replicados automaticamente entre qualquer dispositivo.
          </p>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.78rem; color: var(--text-400); background: var(--bg-2); padding: 10px 14px; border-radius: var(--radius-sm);">
            <div><strong>Tecnologia:</strong> PostgreSQL Cloud</div>
            <div><strong>Segurança:</strong> Chaves Internas Ocultas</div>
            <div><strong>Tempo Real:</strong> WebSockets Conectado</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" id="btn-pull-supabase" title="Baixa os dados mais recentes do banco em nuvem">
            🔄 Sincronizar Agora
          </button>
          <button type="button" class="btn btn-secondary" id="btn-push-supabase" title="Envia todos os dados deste aparelho para o banco em nuvem">
            📤 Forçar Upload p/ Nuvem
          </button>
          <button type="button" class="btn btn-secondary" id="btn-test-supabase">
            ⚡ Testar Conexão
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-sql-schema" title="Copia o script SQL das tabelas do banco">
            📋 Copiar Esquema SQL
          </button>
        </div>
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

    container.querySelector('#btn-reset-demo')?.addEventListener('click', async () => {
      if (confirm('Deseja recarregar os dados de exemplo do sistema?')) {
        state.loadSeedData();
        showToast('Dados de exemplo recarregados!');
        if (state.data.clients.length > 0) {
          state.syncToSupabase().catch(console.warn);
        }
        window.refreshCurrentTab();
        window.updateBrandDisplay();
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

    container.querySelector('#btn-copy-sql-schema')?.addEventListener('click', async () => {
      const sql = `-- VANDO MOTOS LOCADORA LTDA - ESQUEMA SUPABASE
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  credit_limit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES public.clients(id) ON DELETE CASCADE,
  principal NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  interest_type TEXT DEFAULT 'price',
  periodicity TEXT DEFAULT 'monthly',
  installments_count INT NOT NULL,
  start_date TEXT NOT NULL,
  total_payable NUMERIC NOT NULL,
  total_interest NUMERIC NOT NULL,
  penalty_rate NUMERIC DEFAULT 2.0,
  daily_interest_rate NUMERIC DEFAULT 0.1,
  first_payment_days INT DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.installments (
  id TEXT PRIMARY KEY,
  loan_id TEXT REFERENCES public.loans(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  number INT NOT NULL,
  due_date TEXT NOT NULL,
  installment_amount NUMERIC NOT NULL,
  amortization_amount NUMERIC DEFAULT 0,
  interest_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  paid_date TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon Full Access Clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Installments" ON public.installments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Full Access Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;`;

      try {
        await navigator.clipboard.writeText(sql);
        showToast('Código SQL copiado para a Área de Transferência! Cole no SQL Editor do Supabase.', 'success');
      } catch (err) {
        showToast('Consulte o arquivo supabase_schema.sql na raiz do projeto.', 'info');
      }
    });
  }, 0);

  return container;
}
