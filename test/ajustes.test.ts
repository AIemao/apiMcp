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

const cupom10: Ajuste = { tipo: "cupom-percentual", codigo: "PROMO10", percentual: 10 };
const taxa10: Ajuste = { tipo: "taxa-servico", percentual: 10 };

test("caso da tabela: subtotal 1005, cupom 10% e taxa 10% dão cupom −101, taxa 90 e total 994", () => {
  const r = ok(aplicarAjustes(1005, [cupom10, taxa10]));
  assert.equal(r.subtotal, 1005);
  assert.equal(r.ajustes.length, 2);
  assert.equal(r.ajustes[0]!.valor, -101); // 10% de 1005 = 100,5 → arredonda para 101
  assert.equal(r.ajustes[1]!.valor, 90); // 10% de 904 (já com cupom) = 90,4 → 90
  assert.equal(r.total, 994);
});

test("as linhas fecham: subtotal + soma dos ajustes = total (regra do cupom fiscal)", () => {
  const casos: Array<[number, Ajuste[]]> = [
    [1005, [cupom10, taxa10]],
    [999, [cupom10, taxa10]],
    [333, [{ tipo: "cupom-percentual", codigo: "X", percentual: 15 }, { tipo: "taxa-servico", percentual: 12 }]],
    [1, [cupom10, taxa10]],
    [5000, [taxa10]],
    [5000, [cupom10]],
  ];
  for (const [subtotal, ajustes] of casos) {
    const r = ok(aplicarAjustes(subtotal, ajustes));
    const soma = r.ajustes.reduce((acc, a) => acc + a.valor, 0);
    assert.equal(r.subtotal + soma, r.total, `subtotal ${subtotal} não fecha`);
    assert.ok(Number.isInteger(r.total), "total deve ser inteiro (centavos)");
  }
});

test("a ordem não depende do array: taxa antes do cupom dá o mesmo resultado", () => {
  const a = ok(aplicarAjustes(1005, [cupom10, taxa10]));
  const b = ok(aplicarAjustes(1005, [taxa10, cupom10]));
  assert.equal(b.total, a.total);
  assert.deepEqual(b.ajustes, a.ajustes);
  assert.equal(b.ajustes[0]!.valor, -101, "cupom continua sendo a primeira linha");
});

test("percentual inválido é rejeitado com erro acionável", () => {
  for (const percentual of [150, -5]) {
    const erros = falha(aplicarAjustes(1005, [{ tipo: "cupom-percentual", codigo: "RUIM", percentual }]));
    assert.ok(erros.length > 0);
    assert.match(erros[0]!, /percentual/i, "diz qual campo está errado");
    assert.match(erros[0]!, new RegExp(String(percentual)), "mostra o valor recebido");
    assert.match(erros[0]!, /0.*100/, "diz a faixa válida");
  }
});

test("sem ajustes: o total é igual ao subtotal", () => {
  const r = ok(aplicarAjustes(1005, []));
  assert.equal(r.total, 1005);
  assert.deepEqual(r.ajustes, []);
});
