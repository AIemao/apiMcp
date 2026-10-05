import type { Catalogo } from "../domain/types.js";

/**
 * Catálogo fictício de uma lanchonete + açaiteria.
 * Os casos foram escolhidos para exercitar regras reais de autoatendimento:
 * - Açaí: adicionais com min/max e repetição da mesma opção (maxPorOpcao).
 * - Combo Burger: várias etapas, troca com acréscimo e adicional dentro do filho.
 * - Combo Dupla Coxinha: combo com UM único filho (caso clássico de multiplicação pelo pai).
 * - Item indisponível para testar validação.
 */
export const catalogo: Catalogo = {
  categorias: [
    { id: "lanches", nome: "Lanches" },
    { id: "acai", nome: "Açaí" },
    { id: "bebidas", nome: "Bebidas" },
    { id: "acompanhamentos", nome: "Acompanhamentos" },
    { id: "combos", nome: "Combos" },
  ],
  itens: [
    {
      tipo: "simples",
      id: "x-burger",
      nome: "X-Burger",
      descricao: "Pão, hambúrguer 150g, queijo e molho da casa.",
      categoriaId: "lanches",
      preco: 2490,
      disponivel: true,
      gruposModificadores: [
        {
          id: "extras-burger",
          nome: "Turbine seu lanche",
          min: 0,
          max: 3,
          opcoes: [
            { id: "bacon", nome: "Bacon", precoAdicional: 500, disponivel: true },
            { id: "cheddar", nome: "Cheddar", precoAdicional: 400, disponivel: true },
            { id: "ovo", nome: "Ovo", precoAdicional: 300, disponivel: false },
          ],
        },
        {
          id: "ponto-carne",
          nome: "Ponto da carne",
          min: 1,
          max: 1,
          opcoes: [
            { id: "mal-passado", nome: "Mal passado", precoAdicional: 0, disponivel: true },
            { id: "ao-ponto", nome: "Ao ponto", precoAdicional: 0, disponivel: true },
            { id: "bem-passado", nome: "Bem passado", precoAdicional: 0, disponivel: true },
          ],
        },
      ],
    },
    {
      tipo: "simples",
      id: "coxinha",
      nome: "Coxinha",
      descricao: "Coxinha de frango com catupiry.",
      categoriaId: "lanches",
      preco: 800,
      disponivel: true,
      gruposModificadores: [],
    },
    {
      tipo: "simples",
      id: "acai-500",
      nome: "Açaí 500ml",
      descricao: "Açaí puro batido na hora.",
      categoriaId: "acai",
      preco: 2200,
      disponivel: true,
      gruposModificadores: [
        {
          id: "complementos",
          nome: "Complementos (até 4)",
          min: 0,
          max: 4,
          maxPorOpcao: 2,
          opcoes: [
            { id: "granola", nome: "Granola", precoAdicional: 250, disponivel: true },
            { id: "leite-po", nome: "Leite em pó", precoAdicional: 300, disponivel: true },
            { id: "banana", nome: "Banana", precoAdicional: 200, disponivel: true },
            { id: "nutella", nome: "Creme de avelã", precoAdicional: 600, disponivel: true },
          ],
        },
      ],
    },
    {
      tipo: "simples",
      id: "refri-lata",
      nome: "Refrigerante lata",
      descricao: "350ml.",
      categoriaId: "bebidas",
      preco: 700,
      disponivel: true,
      gruposModificadores: [
        {
          id: "gelo",
          nome: "Gelo e limão",
          min: 0,
          max: 2,
          opcoes: [
            { id: "gelo", nome: "Com gelo", precoAdicional: 0, disponivel: true },
            { id: "limao", nome: "Com limão", precoAdicional: 0, disponivel: true },
          ],
        },
      ],
    },
    {
      tipo: "simples",
      id: "suco-natural",
      nome: "Suco natural 400ml",
      descricao: "Laranja ou limão.",
      categoriaId: "bebidas",
      preco: 1100,
      disponivel: true,
      gruposModificadores: [],
    },
    {
      tipo: "simples",
      id: "batata-p",
      nome: "Batata frita P",
      descricao: "Porção pequena.",
      categoriaId: "acompanhamentos",
      preco: 1000,
      disponivel: true,
      gruposModificadores: [],
    },
    {
      tipo: "simples",
      id: "batata-g",
      nome: "Batata frita G",
      descricao: "Porção grande.",
      categoriaId: "acompanhamentos",
      preco: 1600,
      disponivel: true,
      gruposModificadores: [],
    },
    {
      tipo: "combo",
      id: "combo-burger",
      nome: "Combo X-Burger",
      descricao: "X-Burger + acompanhamento + bebida.",
      categoriaId: "combos",
      preco: 3990,
      disponivel: true,
      slots: [
        { id: "lanche", nome: "Lanche", min: 1, max: 1, itensPermitidos: [{ itemId: "x-burger", precoAdicional: 0 }] },
        {
          id: "acompanhamento",
          nome: "Acompanhamento",
          min: 1,
          max: 1,
          itensPermitidos: [
            { itemId: "batata-p", precoAdicional: 0 },
            { itemId: "batata-g", precoAdicional: 400 },
          ],
        },
        {
          id: "bebida",
          nome: "Bebida",
          min: 1,
          max: 1,
          itensPermitidos: [
            { itemId: "refri-lata", precoAdicional: 0 },
            { itemId: "suco-natural", precoAdicional: 300 },
          ],
        },
      ],
    },
    {
      tipo: "combo",
      id: "combo-dupla-coxinha",
      nome: "Dupla de Coxinha",
      descricao: "Duas coxinhas por um preço especial (combo de filho único).",
      categoriaId: "combos",
      preco: 1400,
      disponivel: true,
      slots: [
        { id: "coxinhas", nome: "Coxinhas", min: 2, max: 2, itensPermitidos: [{ itemId: "coxinha", precoAdicional: 0 }] },
      ],
    },
    {
      tipo: "simples",
      id: "milkshake",
      nome: "Milkshake",
      descricao: "Fora de estoque hoje.",
      categoriaId: "bebidas",
      preco: 1800,
      disponivel: false,
      gruposModificadores: [],
    },
  ],
};
