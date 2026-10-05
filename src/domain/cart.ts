import { randomUUID } from "node:crypto";
import { precificar } from "./pricing.js";
import type { Catalogo, Centavos, LinhaPrecificada, Resultado, SelecaoItem } from "./types.js";

export interface LinhaCarrinho extends LinhaPrecificada {
  linhaId: string;
  selecao: SelecaoItem;
}

export interface Carrinho {
  id: string;
  linhas: LinhaCarrinho[];
  total: Centavos;
}

export interface Pedido {
  pedidoId: string;
  linhas: LinhaCarrinho[];
  total: Centavos;
  criadoEm: string;
}

/** Armazenamento em memória — suficiente para estudo; troque por Redis/DB se precisar persistir. */
export class CarrinhoStore {
  private carrinhos = new Map<string, LinhaCarrinho[]>();

  constructor(private readonly catalogo: Catalogo) {}

  criar(): Carrinho {
    const id = randomUUID();
    this.carrinhos.set(id, []);
    return this.ver(id)!;
  }

  ver(id: string): Carrinho | undefined {
    const linhas = this.carrinhos.get(id);
    if (!linhas) return undefined;
    return { id, linhas, total: linhas.reduce((s, l) => s + l.total, 0) };
  }

  adicionar(id: string, selecao: SelecaoItem): Resultado<Carrinho> {
    const linhas = this.carrinhos.get(id);
    if (!linhas) return { ok: false, erros: [`Carrinho "${id}" não existe. Use criar_carrinho.`] };

    const r = precificar(this.catalogo, selecao);
    if (!r.ok) return r;

    linhas.push({ ...r.valor, linhaId: randomUUID(), selecao });
    return { ok: true, valor: this.ver(id)! };
  }

  remover(id: string, linhaId: string): Resultado<Carrinho> {
    const linhas = this.carrinhos.get(id);
    if (!linhas) return { ok: false, erros: [`Carrinho "${id}" não existe.`] };
    const idx = linhas.findIndex((l) => l.linhaId === linhaId);
    if (idx === -1) return { ok: false, erros: [`Linha "${linhaId}" não está no carrinho.`] };
    linhas.splice(idx, 1);
    return { ok: true, valor: this.ver(id)! };
  }

  fechar(id: string): Resultado<Pedido> {
    const carrinho = this.ver(id);
    if (!carrinho) return { ok: false, erros: [`Carrinho "${id}" não existe.`] };
    if (!carrinho.linhas.length) return { ok: false, erros: ["Carrinho vazio."] };

    // Reprecifica tudo no fechamento: o catálogo pode ter mudado desde que a linha entrou.
    const erros: string[] = [];
    for (const l of carrinho.linhas) {
      const r = precificar(this.catalogo, l.selecao);
      if (!r.ok) erros.push(...r.erros.map((e) => `${l.nome}: ${e}`));
      else if (r.valor.total !== l.total) erros.push(`${l.nome}: preço mudou, remova e adicione novamente.`);
    }
    if (erros.length) return { ok: false, erros };

    this.carrinhos.delete(id);
    return {
      ok: true,
      valor: { pedidoId: randomUUID(), linhas: carrinho.linhas, total: carrinho.total, criadoEm: new Date().toISOString() },
    };
  }
}
