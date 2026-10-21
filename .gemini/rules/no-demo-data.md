# Regra Permanente: Proibido Injetar Dados Fictícios

- O sistema roda em produção com clientes e finanças reais.
- NUNCA crie clientes fictícios, empréstimos ou parcelas de teste.
- NUNCA re-injete dados após o usuário apagar.
- Todas as listas (`clients`, `loans`, `installments`) devem permanecer vazias caso não haja dados cadastrados manualmente pelo usuário.
