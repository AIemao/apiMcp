# catalogo-mcp

Servidor MCP de estudo que expõe um cardápio de autoatendimento com **adicionais**, **combos/venda orientada** e **carrinho**, para ser usado por agentes (Copilot, Claude Code, Claude Desktop etc.).

O objetivo não é o catálogo em si, e sim praticar duas coisas: modelar regras reais de autoatendimento com testes, e desenhar ferramentas que um modelo consiga usar bem.

## Rodando

```bash
npm install
npm test          # 10 testes de domínio + 1 e2e falando MCP de verdade
npm run inspector # abre o MCP Inspector para chamar as tools na mão
npm run build && npm start
```

## Conectando

**VS Code / Copilot** — `.vscode/mcp.json`:

```json
{
  "servers": {
    "catalogo": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "${workspaceFolder}/src/server.ts"]
    },
    "mercadopago": {
      "type": "http",
      "url": "https://mcp.mercadopago.com/mcp"
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add catalogo -- npx tsx /caminho/catalogo-mcp/src/server.ts
claude mcp add --transport http mercadopago https://mcp.mercadopago.com/mcp
```

Com os dois conectados, um prompt de teste ponta a ponta:

> Monte um pedido com 2 Combos X-Burger (bem passado, cheddar, batata G e suco) e feche o pedido. Depois gere uma cobrança Pix em ambiente de teste no Mercado Pago com o total, usando o pedidoId como referência externa.

## Tools

| Tool | Tipo | O que faz |
|---|---|---|
| `listar_categorias` | leitura | Categorias do cardápio |
| `listar_itens` | leitura | Filtra por categoria/texto; esconde indisponíveis por padrão |
| `detalhar_item` | leitura | Grupos de adicionais ou etapas do combo |
| `simular_preco` | leitura | Valida e precifica sem mexer no carrinho |
| `criar_carrinho` | escrita | Novo carrinho |
| `adicionar_ao_carrinho` | escrita | Valida tudo antes; se falhar, nada muda |
| `ver_carrinho` | leitura | Linhas e total |
| `remover_do_carrinho` | escrita | Remove por `linhaId` |
| `fechar_pedido` | escrita | Reprecifica, fecha e devolve total em centavos e reais |

## Decisões de design

- **Dinheiro em centavos inteiros.** Formatação em R$ só na saída.
- **Quantidade do pai multiplica tudo.** `total = precoUnitario * quantidade`, onde o unitário já inclui adicionais e escolhas do combo. O teste do combo de filho único cobre exatamente esse caso.
- **Opção repetida em duas entradas é erro**, não soma silenciosa. Repetição legítima usa `quantidade` e é limitada por `maxPorOpcao`.
- **Erros são acumulados e acionáveis.** O modelo recebe todos os problemas de uma vez, com os ids válidos, e consegue se corrigir sem várias idas e voltas.
- **Reprecificação no fechamento.** O catálogo pode mudar entre adicionar e fechar.
- **`annotations`** (`readOnlyHint`, `destructiveHint`) ajudam o cliente a decidir o que pedir confirmação.
- **Logs em stderr.** Em transporte stdio, qualquer `console.log` corrompe o protocolo.

## Próximos passos sugeridos

1. Expor o catálogo também como **resource** (`catalogo://itens/{id}`) além de tools.
2. Adicionar **descontos** (percentual e valor fixo por item e por pedido) com testes de arredondamento.
3. Trocar o `Map` por SQLite e o stdio por **Streamable HTTP**, para vários clientes ao mesmo tempo.
4. Adicionar `outputSchema` nas tools e devolver `structuredContent`.
5. Um prompt MCP (`server.registerPrompt`) com o roteiro de atendimento do totem.
