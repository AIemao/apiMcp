import type {
  Catalogo,
  Centavos,
  GrupoModificador,
  Item,
  ItemCombo,
  ItemSimples,
  LinhaPrecificada,
  Resultado,
  SelecaoItem,
  SelecaoModificador,
  SelecaoSlot,
} from "./types.js";

export const formatarReais = (c: Centavos): string =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function buscarItem(catalogo: Catalogo, itemId: string): Item | undefined {
  return catalogo.itens.find((i) => i.id === itemId);
}

/** Valida e precifica os modificadores de um item simples. Acumula erros em vez de parar no primeiro. */
function precificarModificadores(
  item: ItemSimples,
  selecao: SelecaoModificador[] = [],
  prefixo: string,
  erros: string[],
  detalhes: string[],
): Centavos {
  let soma = 0;

  for (const sel of selecao) {
    if (!item.gruposModificadores.some((g) => g.id === sel.grupoId)) {
      erros.push(`${prefixo}grupo "${sel.grupoId}" não existe em "${item.nome}".`);
    }
  }

  for (const grupo of item.gruposModificadores) {
    const doGrupo = selecao.filter((s) => s.grupoId === grupo.id);
    soma += precificarGrupo(grupo, doGrupo, `${prefixo}${item.nome} › ${grupo.nome}: `, erros, detalhes);
  }
  return soma;
}

function precificarGrupo(
  grupo: GrupoModificador,
  selecao: SelecaoModificador[],
  prefixo: string,
  erros: string[],
  detalhes: string[],
): Centavos {
  let soma = 0;
  let totalNoGrupo = 0;
  const vistos = new Set<string>();
  const maxPorOpcao = grupo.maxPorOpcao ?? 1;

  for (const sel of selecao) {
    // Opção repetida em duas entradas é ambígua (e é a origem clássica de "adicional duplicado").
    if (vistos.has(sel.opcaoId)) {
      erros.push(`${prefixo}opção "${sel.opcaoId}" informada mais de uma vez; use o campo quantidade.`);
      continue;
    }
    vistos.add(sel.opcaoId);

    const opcao = grupo.opcoes.find((o) => o.id === sel.opcaoId);
    if (!opcao) {
      erros.push(`${prefixo}opção "${sel.opcaoId}" não existe. Válidas: ${grupo.opcoes.map((o) => o.id).join(", ")}.`);
      continue;
    }
    if (!opcao.disponivel) {
      erros.push(`${prefixo}"${opcao.nome}" está indisponível.`);
      continue;
    }
    if (!Number.isInteger(sel.quantidade) || sel.quantidade < 1 || sel.quantidade > maxPorOpcao) {
      erros.push(`${prefixo}"${opcao.nome}" aceita de 1 a ${maxPorOpcao} unidade(s).`);
      continue;
    }

    totalNoGrupo += sel.quantidade;
    soma += opcao.precoAdicional * sel.quantidade;
    detalhes.push(`${sel.quantidade}x ${opcao.nome}${opcao.precoAdicional ? ` (+${formatarReais(opcao.precoAdicional)})` : ""}`);
  }

  if (totalNoGrupo < grupo.min || totalNoGrupo > grupo.max) {
    erros.push(`${prefixo}escolha entre ${grupo.min} e ${grupo.max} (escolhido: ${totalNoGrupo}).`);
  }
  return soma;
}

function precificarEscolhasCombo(
  catalogo: Catalogo,
  combo: ItemCombo,
  escolhas: SelecaoSlot[] = [],
  erros: string[],
  detalhes: string[],
): Centavos {
  let soma = 0;

  for (const e of escolhas) {
    if (!combo.slots.some((s) => s.id === e.slotId)) {
      erros.push(`Etapa "${e.slotId}" não existe no combo "${combo.nome}".`);
    }
  }

  for (const slot of combo.slots) {
    const doSlot = escolhas.filter((e) => e.slotId === slot.id);
    let totalNoSlot = 0;

    for (const e of doSlot) {
      const permitido = slot.itensPermitidos.find((p) => p.itemId === e.itemId);
      const filho = buscarItem(catalogo, e.itemId);
      if (!permitido || !filho) {
        erros.push(`${slot.nome}: item "${e.itemId}" não é permitido. Válidos: ${slot.itensPermitidos.map((p) => p.itemId).join(", ")}.`);
        continue;
      }
      if (filho.tipo !== "simples") {
        erros.push(`${slot.nome}: combo dentro de combo não é suportado.`);
        continue;
      }
      if (!filho.disponivel) {
        erros.push(`${slot.nome}: "${filho.nome}" está indisponível.`);
        continue;
      }
      if (!Number.isInteger(e.quantidade) || e.quantidade < 1) {
        erros.push(`${slot.nome}: quantidade de "${filho.nome}" deve ser inteiro >= 1.`);
        continue;
      }

      totalNoSlot += e.quantidade;
      const detalhesFilho: string[] = [];
      const adicionaisFilho = precificarModificadores(filho, e.modificadores, `${slot.nome} › `, erros, detalhesFilho);
      // Preço base do filho já está embutido no preço do combo; cobra só acréscimo + adicionais.
      soma += (permitido.precoAdicional + adicionaisFilho) * e.quantidade;
      detalhes.push(
        `${slot.nome}: ${e.quantidade}x ${filho.nome}` +
          (permitido.precoAdicional ? ` (+${formatarReais(permitido.precoAdicional)})` : "") +
          (detalhesFilho.length ? ` [${detalhesFilho.join(", ")}]` : ""),
      );
    }

    if (totalNoSlot < slot.min || totalNoSlot > slot.max) {
      erros.push(`${combo.nome} › ${slot.nome}: escolha entre ${slot.min} e ${slot.max} (escolhido: ${totalNoSlot}).`);
    }
  }
  return soma;
}

/** Valida a seleção inteira e devolve a linha precificada ou a lista completa de erros. */
export function precificar(catalogo: Catalogo, selecao: SelecaoItem): Resultado<LinhaPrecificada> {
  const item = buscarItem(catalogo, selecao.itemId);
  if (!item) return { ok: false, erros: [`Item "${selecao.itemId}" não existe. Use listar_itens.`] };
  if (!item.disponivel) return { ok: false, erros: [`"${item.nome}" está indisponível.`] };
  if (!Number.isInteger(selecao.quantidade) || selecao.quantidade < 1) {
    return { ok: false, erros: ["quantidade deve ser inteiro >= 1."] };
  }

  const erros: string[] = [];
  const detalhes: string[] = [];
  let unitario = item.preco;

  if (item.tipo === "simples") {
    if (selecao.escolhasCombo?.length) erros.push(`"${item.nome}" não é combo; remova escolhasCombo.`);
    unitario += precificarModificadores(item, selecao.modificadores, "", erros, detalhes);
  } else {
    if (selecao.modificadores?.length) erros.push(`"${item.nome}" é combo; informe adicionais dentro de escolhasCombo.`);
    unitario += precificarEscolhasCombo(catalogo, item, selecao.escolhasCombo, erros, detalhes);
  }

  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    valor: {
      itemId: item.id,
      nome: item.nome,
      quantidade: selecao.quantidade,
      precoUnitario: unitario,
      total: unitario * selecao.quantidade,
      detalhes,
    },
  };
}
