// src/js/components/settings.js
// Configurações do Negócio, Chave PIX, Template do WhatsApp e Backup de Dados

import { state } from '../state.js';
import { showToast } from '../utils.js';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view animate-fade-in';

  const settings = state.getSettings();

  container.innerHTML = `
    <div class="grid-auto-fit">
      
      <!-- Card: Dados do Credor e PIX -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">⚙️ Perfil do Negócio & PIX</h3>
            <p class="card-subtitle">Informações que saem nos comprovantes e mensagens</p>
          </div>
        </div>

        <form id="form-settings-pix">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nome da Financeira / Beneficiário *</label>
              <input type="text" class="form-control" id="set-business-name" value="${settings.businessName || ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label">CNPJ / CPF do Beneficiário *</label>
              <input type="text" class="form-control" id="set-creditor-doc" value="${settings.creditorCpfCnpj || ''}" required placeholder="000.000.000-00">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Cidade / Praça do Acordo *</label>
              <input type="text" class="form-control" id="set-creditor-city" value="${settings.creditorCity || ''}" required placeholder="Ex: PORTO VELHO - RO">
            </div>

            <div class="form-group">
              <label class="form-label">Nome do Titular do PIX *</label>
              <input type="text" class="form-control" id="set-pix-holder" value="${settings.pixHolder || ''}" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Tipo da Chave PIX</label>
              <select class="form-control" id="set-pix-type">
                <option value="Celular" ${settings.pixType === 'Celular' ? 'selected' : ''}>Celular</option>
                <option value="CPF/CNPJ" ${settings.pixType === 'CPF/CNPJ' ? 'selected' : ''}>CPF / CNPJ</option>
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
              <label class="form-label">Multa Padrão por Atraso (%)</label>
              <input type="number" class="form-control" id="set-penalty-rate" value="${settings.defaultPenaltyRate || 2.0}" step="0.1" required>
            </div>

            <div class="form-group">
              <label class="form-label">Juros de Mora Diários (%)</label>
              <input type="number" class="form-control" id="set-daily-rate" value="${settings.defaultDailyRate || 0.1}" step="0.01" required>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
            💾 Salvar Configurações
          </button>
        </form>
      </div>

      <!-- Card: Template de Mensagem de Cobrança WhatsApp -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">💬 Modelo de Cobrança (WhatsApp)</h3>
            <p class="card-subtitle">Texto enviado aos clientes ao clicar em cobrar</p>
          </div>
        </div>

        <form id="form-settings-wpp">
          <div class="form-group">
            <label class="form-label">Mensagem Personalizada</label>
            <textarea class="form-control" id="set-wpp-template" rows="7" style="font-family: monospace; font-size: 0.88rem;">${settings.whatsappTemplate || ''}</textarea>
          </div>

          <div style="background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--text-dim); margin-bottom: 16px;">
            <strong>Variáveis disponíveis:</strong><br>
            <code>{cliente}</code> - Nome do cliente<br>
            <code>{parcela_num}</code> - Número da parcela<br>
            <code>{valor_parcela}</code> - Valor formatado em R$<br>
            <code>{data_vencimento}</code> - Data da parcela<br>
            <code>{chave_pix}</code> - Sua chave PIX configurada<br>
            <code>{titular_pix}</code> - Titular da conta
          </div>

          <button type="submit" class="btn btn-primary">
            💾 Atualizar Modelo
          </button>
        </form>
      </div>

      <!-- Card: Backup e Segurança de Dados -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <div>
            <h3 class="card-title">🛡️ Backup e Segurança dos Dados</h3>
            <p class="card-subtitle">Exporte seus dados com segurança ou restaure cópias anteriores</p>
          </div>
        </div>

        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-export-backup">
            📥 Baixar Backup Completo (JSON)
          </button>

          <label class="btn btn-secondary" style="cursor: pointer; margin-bottom: 0;">
            📤 Restaurar Backup de Arquivo
            <input type="file" id="input-import-backup" accept=".json" style="display: none;">
          </label>

          <button class="btn btn-secondary" id="btn-reset-demo" style="color: var(--amber-400);">
            🔄 Recarregar Dados de Exemplo
          </button>

          <button class="btn btn-danger" id="btn-wipe-all">
            🗑️ Zerar Todos os Dados
          </button>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    // Salvar Perfil e PIX
    container.querySelector('#form-settings-pix').addEventListener('submit', (e) => {
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

    // Salvar Template WhatsApp
    container.querySelector('#form-settings-wpp').addEventListener('submit', (e) => {
      e.preventDefault();
      state.saveSettings({
        whatsappTemplate: container.querySelector('#set-wpp-template').value
      });
      showToast('Modelo de mensagem do WhatsApp atualizado!');
    });

    // Exportar Backup
    container.querySelector('#btn-export-backup').addEventListener('click', () => {
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

    // Importar Backup
    const fileInput = container.querySelector('#input-import-backup');
    fileInput.addEventListener('change', (e) => {
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

    // Recarregar Dados de Exemplo
    container.querySelector('#btn-reset-demo').addEventListener('click', () => {
      if (confirm('Deseja recarregar os dados de exemplo do sistema?')) {
        state.loadSeedData();
        showToast('Dados de exemplo recarregados!');
        window.refreshCurrentTab();
        window.updateBrandDisplay();
      }
    });

    // Zerar Todos os Dados
    container.querySelector('#btn-wipe-all').addEventListener('click', () => {
      if (confirm('ATENÇÃO: Deseja apagar TODOS os clientes, empréstimos e parcelas? Esta ação não pode ser desfeita.')) {
        state.data.clients = [];
        state.data.loans = [];
        state.data.installments = [];
        state.save();
        showToast('Todos os dados foram zerados.', 'info');
        window.refreshCurrentTab();
      }
    });

  }, 0);

  return container;
}
