import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarAjustes, type Ajuste } from "../src/domain/ajustes.js";

const ok = <T>(r: { ok: true; valor: T } | { ok: false; erros: string[] }): T => {
  if (!r.ok) assert.fail(r.erros.join(" | "));
  return r.valor;
};
const falha = (r: { ok: boolean; erros?: string[] }) => {
  assert.equal(r.ok, false);
  return r.erros ?? [];
};

const cupom = (pontosBase: number): Ajuste => ({ tipo: "cupom-percentual", codigo: "PROMO", pontosBase });
const taxa = (pontosBase: number): Ajuste => ({ tipo: "taxa-servico", pontosBase });

const cupom10 = cupom(1000); // 10% em pontos-base
const taxa10 = taxa(1000);

test("caso da tabela: subtotal 1005, cupom 10% e taxa 10% dão cupom −101, taxa 101 e total 1005", () => {
  const r = ok(aplicarAjustes(1005, [cupom10, taxa10]));
  assert.equal(r.subtotal, 1005);
  assert.equal(r.ajustes.length, 2);
  assert.equal(r.ajustes[0]!.valor, -101); // 10% de 1005 = 100,5 → arredonda para 101
  assert.equal(r.ajustes[1]!.valor, 101); // 10% do subtotal original (1005), não do valor com cupom
  assert.equal(r.total, 1005); // 1005 − 101 + 101
});

test("as linhas fecham: subtotal + soma dos ajustes = total (regra do cupom fiscal)", () => {
  const casos: Array<[number, Ajuste[]]> = [
    [1005, [cupom10, taxa10]],
    [999, [cupom10, taxa10]],
    [333, [cupom(1500), taxa(1200)]],
    [333, [cupom(1250), taxa(1250)]],
    [1, [cupom10, taxa10]],
    [5000, [taxa10]],
    [5000, [cupom10]],
    [1, [cupom(9900)]], // cupom limitado pelo piso
    [10, [cupom(9900)]],
    [10, [cupom(9900), taxa10]],
  ];
  for (const [subtotal, ajustes] of casos) {
    const r = ok(aplicarAjustes(subtotal, ajustes));
    const soma = r.ajustes.reduce((acc, a) => acc + a.valor, 0);
    assert.equal(r.subtotal + soma, r.total, `subtotal ${subtotal} não fecha`);
    assert.ok(Number.isInteger(r.total), "total deve ser inteiro (centavos)");
    assert.ok(r.total >= 1, "total nunca fica abaixo de R$ 0,01");
  }
});

test("ordem de exibição: o cupom vem sempre antes da taxa, qualquer que seja a ordem do array", () => {
  const a = ok(aplicarAjustes(1005, [cupom10, taxa10]));
  const b = ok(aplicarAjustes(1005, [taxa10, cupom10]));
  assert.deepEqual(b.ajustes, a.ajustes);
  assert.deepEqual(
    b.ajustes.map((l) => l.tipo),
    ["cupom-percentual", "taxa-servico"],
  );
  assert.equal(b.total, a.total);
});

test("cupom de 1,00% a 99,00% (100 a 9900 pontos-base) é aceito", () => {
  for (const pb of [100, 9900]) ok(aplicarAjustes(1005, [cupom(pb)]));
});

test("cupom fora da faixa é rejeitado, e a mensagem fala em percentual do negócio", () => {
  const casos: Array<[number, string]> = [
    [0, "0,00%"],
    [99, "0,99%"], // quem esquece a unidade: 99 pontos-base é 0,99%, não 99%
    [10000, "100,00%"],
    [15000, "150,00%"],
    [-500, "-5,00%"],
  ];
  for (const [pb, exibido] of casos) {
    const erros = falha(aplicarAjustes(1005, [cupom(pb)]));
    assert.ok(erros.length > 0, `${pb} deveria ser rejeitado`);
    assert.match(erros[0]!, /cupom/i, "diz qual ajuste está errado");
    assert.match(erros[0]!, /entre 1,00% e 99,00%/, "diz a faixa do cupom");
    assert.ok(erros[0]!.includes(`recebido: ${exibido}`), `mostra o valor recebido (${exibido})`);
  }
});

test("taxa de serviço de 1,00% a 30,00% (100 a 3000 pontos-base) é aceita", () => {
  for (const pb of [100, 3000]) ok(aplicarAjustes(1005, [taxa(pb)]));
});

test("taxa fora da faixa é rejeitada, e a mensagem diz que o erro é da taxa", () => {
  const casos: Array<[number, string]> = [
    [3001, "30,01%"],
    [3500, "35,00%"],
    [99, "0,99%"],
  ];
  for (const [pb, exibido] of casos) {
    const erros = falha(aplicarAjustes(1005, [taxa(pb)]));
    assert.ok(erros.length > 0, `${pb} deveria ser rejeitado`);
    assert.match(erros[0]!, /taxa de serviço/i, "diz qual ajuste está errado");
    assert.match(erros[0]!, /entre 1,00% e 30,00%/, "diz a faixa da taxa");
    assert.ok(erros[0]!.includes(`recebido: ${exibido}`), `mostra o valor recebido (${exibido})`);
  }
});

test("as faixas não se misturam: 50% vale como cupom, mas não como taxa", () => {
  ok(aplicarAjustes(1005, [cupom(5000)]));
  const erros = falha(aplicarAjustes(1005, [taxa(5000)]));
  assert.match(erros[0]!, /taxa de serviço/i);
  assert.match(erros[0]!, /entre 1,00% e 30,00%/);
});

test("precisão: 12,5% (1250) é aceito e 12,345% (1234.5) é rejeitado, por cupom e por taxa", () => {
  ok(aplicarAjustes(1005, [cupom(1250), taxa(1250)]));
  for (const ajuste of [cupom(1234.5), taxa(1234.5)]) {
    const erros = falha(aplicarAjustes(1005, [ajuste]));
    assert.match(erros[0]!, /duas casas decimais/, "explica a precisão máxima");
  }
});

test("erros são acumulados: fora da faixa e com casas demais devolve os dois", () => {
  const erros = falha(aplicarAjustes(1005, [cupom(15000.5)]));
  assert.equal(erros.length, 2);
  assert.ok(erros.some((e) => /entre 1,00% e 99,00%/.test(e)), "erro de faixa");
  assert.ok(erros.some((e) => /duas casas decimais/.test(e)), "erro de precisão");
});

test("erros são acumulados entre ajustes: cupom e taxa inválidos devolvem um erro de cada", () => {
  const erros = falha(aplicarAjustes(1005, [cupom(0), taxa(5000)]));
  assert.equal(erros.length, 2);
  assert.ok(erros.some((e) => /cupom/i.test(e)));
  assert.ok(erros.some((e) => /taxa de serviço/i.test(e)));
});

test("NaN e infinito são rejeitados com um único erro claro, sem falar em casas decimais", () => {
  for (const pb of [NaN, Infinity, -Infinity]) {
    for (const ajuste of [cupom(pb), taxa(pb)]) {
      const erros = falha(aplicarAjustes(1005, [ajuste]));
      assert.equal(erros.length, 1, `${pb}: deve ter um erro só`);
      assert.match(erros[0]!, /número finito/);
      assert.ok(erros[0]!.includes(`recebido: ${pb}`), `mostra o valor recebido (${pb})`);
      assert.doesNotMatch(erros[0]!, /casas decimais/);
    }
  }
});

test("piso de R$ 0,01: o cupom é limitado, não o total, e as linhas continuam fechando", () => {
  // subtotal 1: 99% = 0,99 → 1, mas o cupom só pode tirar 0 para o total ficar em 1
  const a = ok(aplicarAjustes(1, [cupom(9900)]));
  assert.equal(a.ajustes.length, 1);
  assert.equal(a.ajustes[0]!.valor, 0); // zero sem sinal, como no ajuste zerado
  assert.equal(a.total, 1);

  // subtotal 10: 99% = 9,9 → 10, limitado a 9
  const b = ok(aplicarAjustes(10, [cupom(9900)]));
  assert.equal(b.ajustes[0]!.valor, -9);
  assert.equal(b.total, 1);
});

test("piso de R$ 0,01: a taxa conta no limite, então o cupom não é cortado à toa", () => {
  // subtotal 10: cupom 99% = 10, taxa 10% = 1. Limite = 10 + 1 − 1 = 10, cupom inteiro.
  const r = ok(aplicarAjustes(10, [cupom(9900), taxa10]));
  assert.equal(r.ajustes[0]!.valor, -10);
  assert.equal(r.ajustes[1]!.valor, 1);
  assert.equal(r.total, 1);
});

test("só é aceito um cupom por pedido", () => {
  const erros = falha(aplicarAjustes(1005, [cupom(9900), cupom(9900)]));
  assert.equal(erros.length, 1);
  assert.match(erros[0]!, /um cupom por pedido/);
});

test("só é aceita uma taxa de serviço por pedido", () => {
  const erros = falha(aplicarAjustes(1005, [taxa(1000), taxa(500)]));
  assert.equal(erros.length, 1);
  assert.match(erros[0]!, /uma taxa de serviço por pedido/);
});

test("dois cupons e duas taxas juntos devolvem os dois erros (erros acumulados)", () => {
  const erros = falha(aplicarAjustes(1005, [cupom(1000), taxa(1000), cupom(500), taxa(500)]));
  assert.equal(erros.length, 2);
  assert.ok(erros.some((e) => /um cupom por pedido/.test(e)));
  assert.ok(erros.some((e) => /uma taxa de serviço por pedido/.test(e)));
});

test("cupom limitado pelo piso avisa o corte na descrição", () => {
  const r = ok(aplicarAjustes(10, [cupom(9900)])); // 99% = 10, limitado a 9
  assert.equal(r.ajustes[0]!.descricao, "Cupom PROMO (99,00%, limitado)");
});

test("cupom que não foi cortado não diz 'limitado'", () => {
  const tabela = ok(aplicarAjustes(1005, [cupom10, taxa10]));
  assert.equal(tabela.ajustes[0]!.descricao, "Cupom PROMO (10,00%)");
  // 99% de 10 = 10 e a taxa de 1 sustenta o piso: cupom inteiro, sem corte
  const comTaxa = ok(aplicarAjustes(10, [cupom(9900), taxa10]));
  assert.doesNotMatch(comTaxa.ajustes[0]!.descricao, /limitado/);
});

test("12,5% sobre 4 centavos dá exatamente meio centavo e arredonda para cima", () => {
  // 4 × 1250 / 10000 = 0,5 exato → 1 (arredondamento comercial), no cupom e na taxa
  const r = ok(aplicarAjustes(4, [cupom(1250), taxa(1250)]));
  assert.equal(r.ajustes[0]!.valor, -1);
  assert.equal(r.ajustes[1]!.valor, 1);
  assert.equal(r.total, 4);
});

test("ajuste que arredonda para zero: cupom aparece com valor 0 e a taxa é omitida", () => {
  // subtotal 4: 10% = 0,4 → 0 nas duas contas
  const r = ok(aplicarAjustes(4, [cupom10, taxa10]));
  assert.equal(r.ajustes.length, 1);
  assert.equal(r.ajustes[0]!.tipo, "cupom-percentual"); // zero não tem sinal: o tipo identifica a linha
  assert.equal(r.ajustes[0]!.valor, 0); // assert estrito (Object.is): -0 reprovaria aqui
  assert.equal(r.total, 4);
});

test("sem ajustes: o total é igual ao subtotal", () => {
  const r = ok(aplicarAjustes(1005, []));
  assert.equal(r.total, 1005);
  assert.deepEqual(r.ajustes, []);
});
