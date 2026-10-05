import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogo } from "../src/data/catalogo.js";
import { precificar } from "../src/domain/pricing.js";
import { CarrinhoStore } from "../src/domain/cart.js";

const ok = <T>(r: { ok: true; valor: T } | { ok: false; erros: string[] }): T => {
  if (!r.ok) assert.fail(r.erros.join(" | "));
  return r.valor;
};
const falha = (r: { ok: boolean; erros?: string[] }) => {
  assert.equal(r.ok, false);
  return r.erros ?? [];
};

test("item simples com adicionais soma corretamente", () => {
  const l = ok(
    precificar(catalogo, {
      itemId: "x-burger",
      quantidade: 1,
      modificadores: [
        { grupoId: "ponto-carne", opcaoId: "ao-ponto", quantidade: 1 },
        { grupoId: "extras-burger", opcaoId: "bacon", quantidade: 1 },
      ],
    }),
  );
  assert.equal(l.precoUnitario, 2490 + 500);
});

test("grupo obrigatório sem escolha é rejeitado", () => {
  const erros = falha(precificar(catalogo, { itemId: "x-burger", quantidade: 1 }));
  assert.match(erros[0]!, /Ponto da carne/);
});

test("mesma opção em duas entradas é rejeitada (adicional duplicado)", () => {
  const erros = falha(
    precificar(catalogo, {
      itemId: "acai-500",
      quantidade: 1,
      modificadores: [
        { grupoId: "complementos", opcaoId: "granola", quantidade: 1 },
        { grupoId: "complementos", opcaoId: "granola", quantidade: 1 },
      ],
    }),
  );
  assert.ok(erros.some((e) => e.includes("mais de uma vez")));
});

test("maxPorOpcao permite 2x granola mas não 3x", () => {
  const dois = ok(
    precificar(catalogo, {
      itemId: "acai-500",
      quantidade: 1,
      modificadores: [{ grupoId: "complementos", opcaoId: "granola", quantidade: 2 }],
    }),
  );
  assert.equal(dois.precoUnitario, 2200 + 500);
  falha(
    precificar(catalogo, {
      itemId: "acai-500",
      quantidade: 1,
      modificadores: [{ grupoId: "complementos", opcaoId: "granola", quantidade: 3 }],
    }),
  );
});

test("opção indisponível é rejeitada", () => {
  const erros = falha(
    precificar(catalogo, {
      itemId: "x-burger",
      quantidade: 1,
      modificadores: [
        { grupoId: "ponto-carne", opcaoId: "ao-ponto", quantidade: 1 },
        { grupoId: "extras-burger", opcaoId: "ovo", quantidade: 1 },
      ],
    }),
  );
  assert.ok(erros.some((e) => e.includes("indisponível")));
});

const comboBurger = {
  itemId: "combo-burger",
  quantidade: 2,
  escolhasCombo: [
    {
      slotId: "lanche",
      itemId: "x-burger",
      quantidade: 1,
      modificadores: [
        { grupoId: "ponto-carne", opcaoId: "bem-passado", quantidade: 1 },
        { grupoId: "extras-burger", opcaoId: "cheddar", quantidade: 1 },
      ],
    },
    { slotId: "acompanhamento", itemId: "batata-g", quantidade: 1 },
    { slotId: "bebida", itemId: "suco-natural", quantidade: 1 },
  ],
};

test("combo: acréscimos e adicionais do filho entram no unitário, quantidade do pai multiplica tudo", () => {
  const l = ok(precificar(catalogo, comboBurger));
  const unit = 3990 + 400 /* cheddar */ + 400 /* batata G */ + 300; /* suco */
  assert.equal(l.precoUnitario, unit);
  assert.equal(l.total, unit * 2);
});

test("combo de filho único: total = preço do combo * quantidade do pai", () => {
  const l = ok(
    precificar(catalogo, {
      itemId: "combo-dupla-coxinha",
      quantidade: 3,
      escolhasCombo: [{ slotId: "coxinhas", itemId: "coxinha", quantidade: 2 }],
    }),
  );
  assert.equal(l.precoUnitario, 1400);
  assert.equal(l.total, 4200);
});

test("combo com etapa incompleta lista todos os erros de uma vez", () => {
  const erros = falha(
    precificar(catalogo, {
      itemId: "combo-burger",
      quantidade: 1,
      escolhasCombo: [{ slotId: "bebida", itemId: "batata-p", quantidade: 1 }],
    }),
  );
  assert.ok(erros.length >= 3, erros.join("\n"));
});

test("carrinho: adiciona, remove e fecha com total consistente", () => {
  const store = new CarrinhoStore(catalogo);
  const c = store.criar();
  ok(store.adicionar(c.id, comboBurger));
  const depois = ok(store.adicionar(c.id, { itemId: "coxinha", quantidade: 2 }));
  assert.equal(depois.linhas.length, 2);

  const removido = ok(store.remover(c.id, depois.linhas[1]!.linhaId));
  assert.equal(removido.linhas.length, 1);

  const pedido = ok(store.fechar(c.id));
  assert.equal(pedido.total, (3990 + 400 + 400 + 300) * 2);
  assert.equal(store.ver(c.id), undefined, "carrinho deve sumir após fechar");
});

test("carrinho: seleção inválida não altera o carrinho", () => {
  const store = new CarrinhoStore(catalogo);
  const c = store.criar();
  falha(store.adicionar(c.id, { itemId: "milkshake", quantidade: 1 }));
  assert.equal(store.ver(c.id)!.linhas.length, 0);
});
