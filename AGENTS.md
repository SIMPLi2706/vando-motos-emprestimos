# Diretrizes e Regras do Projeto — Gestão de Crédito e Finanças

## REGRA CRÍTICA MANDATÓRIA: NUNCA CRIAR OU INJETAR DADOS NO SISTEMA
1. **PROIBIDO CRIAR CLIENTES, EMPRÉSTIMOS OU PARCELAS FICTÍCIAS**:
   - Este sistema é utilizado em produção real com clientes e valores reais do usuário.
   - Sempre que qualquer desenvolvedor, agente ou script atualizar, corrigir ou buildar o código, é **TERMINANTEMENTE PROIBIDO** criar clientes, empréstimos, parcelas ou pagamentos automáticos de teste (como Bruno, Carlos, Mariana, Roberto, etc.).
   - O estado inicial da base de dados e do LocalStorage para `clients`, `loans` e `installments` DEVE SER SEMPRE uma lista vazia (`[]`).
   - Respeite integralmente todas as exclusões feitas pelo usuário; nunca recrie registros que foram apagados.
   - Não adicione bots, seeds automáticos ou dados mockados ao sistema.
