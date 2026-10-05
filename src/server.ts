#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { catalogo } from "./data/catalogo.js";
import { CarrinhoStore, type Carrinho } from "./domain/cart.js";
import { buscarItem, formatarReais, precificar } from "./domain/pricing.js";
import type { Item, Resultado } from "./domain/types.js";

const server = new McpServer({ name: "catalogo-autoatendimento", version: "0.1.0" });
const store = new CarrinhoStore(catalogo);

// ---------- helpers de resposta ----------

const json = (dados: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(dados, null, 2) }] });

/** Erro de negócio volta como isError + texto acionável, para o modelo conseguir se corrigir sozinho. */
const erro = (erros: string[]) => ({
  isError: true,
  content: [{ type: "text" as const, text: `Não foi possível concluir:\n- ${erros.join("\n- ")}` }],
});

const responder = <T>(r: Resultado<T>, mapear: (v: T) => unknown) => (r.ok ? json(mapear(r.valor)) : erro(r.erros));

const resumoCarrinho = (c: Carrinho) => ({
  carrinhoId: c.id,
  linhas: c.linhas.map((l) => ({
    linhaId: l.linhaId,
    item: l.nome,
    quantidade: l.quantidade,
    precoUnitario: formatarReais(l.precoUnitario),
    total: formatarReais(l.total),
    detalhes: l.detalhes,
  })),
  totalCentavos: c.total,
  total: formatarReais(c.total),
});

const resumoItem = (i: Item) => ({
  id: i.id,
  nome: i.nome,
  tipo: i.tipo,
  preco: formatarReais(i.preco),
  disponivel: i.disponivel,
});

// ---------- schemas de entrada (reaproveitados) ----------

const modificadorSchema = z.object({
  grupoId: z.string().describe("id do grupo, ver detalhar_item"),
  opcaoId: z.string().describe("id da opção dentro do grupo"),
  quantidade: z.number().int().min(1).default(1),
});

const selecaoSchema = {
  itemId: z.string(),
  quantidade: z.number().int().min(1).default(1).describe("Quantidade do item PAI; multiplica adicionais e escolhas do combo."),
  modificadores: z.array(modificadorSchema).optional().describe("Só para itens simples."),
  escolhasCombo: z
    .array(
      z.object({
        slotId: z.string(),
        itemId: z.string(),
        quantidade: z.number().int().min(1).default(1),
        modificadores: z.array(modificadorSchema).optional(),
      }),
    )
    .optional()
    .describe("Só para combos: uma entrada por item escolhido em cada etapa."),
};

// ---------- tools de leitura ----------

server.registerTool(
  "listar_categorias",
  {
    title: "Listar categorias",
    description: "Lista as categorias do cardápio.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => json(catalogo.categorias),
);

server.registerTool(
  "listar_itens",
  {
    title: "Listar itens",
    description: "Lista itens do cardápio, opcionalmente filtrando por categoria ou texto. Retorna resumo; use detalhar_item para ver adicionais e etapas de combo.",
    inputSchema: {
      categoriaId: z.string().optional(),
      busca: z.string().optional().describe("Trecho do nome, sem diferenciar maiúsculas."),
      incluirIndisponiveis: z.boolean().default(false),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ categoriaId, busca, incluirIndisponiveis }) => {
    const termo = busca?.toLowerCase();
    const itens = catalogo.itens.filter(
      (i) =>
        (!categoriaId || i.categoriaId === categoriaId) &&
        (!termo || i.nome.toLowerCase().includes(termo)) &&
        (incluirIndisponiveis || i.disponivel),
    );
    return json(itens.map(resumoItem));
  },
);

server.registerTool(
  "detalhar_item",
  {
    title: "Detalhar item",
    description: "Retorna o item completo: grupos de adicionais (com min/max) ou etapas do combo. Consulte antes de adicionar ao carrinho.",
    inputSchema: { itemId: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ itemId }) => {
    const item = buscarItem(catalogo, itemId);
    return item ? json(item) : erro([`Item "${itemId}" não existe. Use listar_itens.`]);
  },
);

server.registerTool(
  "simular_preco",
  {
    title: "Simular preço",
    description: "Valida uma seleção e calcula o preço sem alterar carrinho. Útil para conferir antes de adicionar.",
    inputSchema: selecaoSchema,
    annotations: { readOnlyHint: true },
  },
  async (selecao) =>
    responder(precificar(catalogo, selecao), (l) => ({
      ...l,
      precoUnitarioFormatado: formatarReais(l.precoUnitario),
      totalFormatado: formatarReais(l.total),
    })),
);

// ---------- tools de escrita ----------

server.registerTool(
  "criar_carrinho",
  { title: "Criar carrinho", description: "Cria um carrinho vazio e retorna seu id.", inputSchema: {} },
  async () => json(resumoCarrinho(store.criar())),
);

server.registerTool(
  "adicionar_ao_carrinho",
  {
    title: "Adicionar ao carrinho",
    description: "Valida a seleção (regras de min/max, disponibilidade, etapas de combo) e adiciona ao carrinho. Em caso de erro, nada é alterado.",
    inputSchema: { carrinhoId: z.string(), ...selecaoSchema },
  },
  async ({ carrinhoId, ...selecao }) => responder(store.adicionar(carrinhoId, selecao), resumoCarrinho),
);

server.registerTool(
  "ver_carrinho",
  {
    title: "Ver carrinho",
    description: "Mostra linhas e total do carrinho.",
    inputSchema: { carrinhoId: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ carrinhoId }) => {
    const c = store.ver(carrinhoId);
    return c ? json(resumoCarrinho(c)) : erro([`Carrinho "${carrinhoId}" não existe.`]);
  },
);

server.registerTool(
  "remover_do_carrinho",
  {
    title: "Remover do carrinho",
    description: "Remove uma linha do carrinho pelo linhaId (ver ver_carrinho).",
    inputSchema: { carrinhoId: z.string(), linhaId: z.string() },
    annotations: { destructiveHint: true },
  },
  async ({ carrinhoId, linhaId }) => responder(store.remover(carrinhoId, linhaId), resumoCarrinho),
);

server.registerTool(
  "fechar_pedido",
  {
    title: "Fechar pedido",
    description:
      "Reprecifica e fecha o carrinho, gerando um pedido. Retorna totalCentavos e totalReais para gerar a cobrança " +
      "(ex.: Pix em sandbox no MCP do Mercado Pago), usando pedidoId como referência externa.",
    inputSchema: { carrinhoId: z.string() },
  },
  async ({ carrinhoId }) =>
    responder(store.fechar(carrinhoId), (p) => ({
      pedidoId: p.pedidoId,
      criadoEm: p.criadoEm,
      totalCentavos: p.total,
      totalReais: Number((p.total / 100).toFixed(2)),
      total: formatarReais(p.total),
      itens: p.linhas.map((l) => ({
        titulo: l.nome,
        quantidade: l.quantidade,
        precoUnitarioReais: Number((l.precoUnitario / 100).toFixed(2)),
        detalhes: l.detalhes,
      })),
    })),
);

// ---------- start ----------

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout é do protocolo; logs vão para stderr.
console.error("catalogo-mcp rodando via stdio");
