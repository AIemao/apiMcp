# Diário de estudos — catalogo-mcp

Uma entrada por sessão, a mais recente no topo. As perguntas de fixação de uma sessão são respondidas no início da próxima.

---

## 2026-10-05 — Setup do projeto

**Objetivo:** subir um servidor MCP de catálogo e conectar no VS Code.
**O que aprendi:** estrutura de um servidor MCP com o SDK oficial (tools com schema zod, transporte stdio); separar domínio do protocolo; por que logs vão para stderr; normalizar quebras de linha com `.gitattributes`.
**Onde mexi:** estrutura inicial, `.gitattributes`, `.vscode/mcp.json`.
**Errei/travei em:** arquivos baixados soltos sem a estrutura de pastas; aviso de LF/CRLF no `git add`.
**Perguntas de fixação:**
1. Por que um `console.log` dentro de uma tool quebraria o servidor?
2. Qual a diferença entre devolver um erro de negócio com `isError: true` e lançar uma exceção?
3. Por que o preço é guardado em centavos inteiros?
**Próximo passo:** implementar descontos com teste primeiro, usando a skill tutor-estudo.
