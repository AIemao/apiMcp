import type { Centavos, PontosBase, Resultado } from "./types.js";

export type Ajuste =
    | { tipo: "cupom-percentual"; codigo: string; pontosBase: PontosBase } // 1000 = 10%
    | { tipo: "taxa-servico"; pontosBase: PontosBase };

export interface LinhaAjuste {
    tipo: Ajuste["tipo"];
    descricao: string;
    valor: Centavos; // negativo para desconto, positivo para taxa
}

export interface ResumoPedido {
    subtotal: Centavos;
    ajustes: LinhaAjuste[];
    total: Centavos;
}

const PONTOS_BASE_POR_INTEIRO = 10_000; // 100% = 10.000 pontos-base

const FAIXAS: Record<Ajuste["tipo"], { min: PontosBase; max: PontosBase }> = {
    "cupom-percentual": { min: 100, max: 9900 }, // 1,00% a 99,00%
    "taxa-servico": { min: 100, max: 3000 }, // 1,00% a 30,00%
};


/** Pontos-base para texto de negócio: 1250 -> "12,50%". Valor fracionário mostra como veio. */
function formatarPercentual(pontosBase: PontosBase): string {
    const percentual = pontosBase / 100;
    const texto = Number.isInteger(pontosBase) ? percentual.toFixed(2) : String(percentual);
    return `${texto.replace(".", ",")}%`;
}

function nomeDoAjuste(ajuste: Ajuste): string {
    return ajuste.tipo === "cupom-percentual" ? `cupom ${ajuste.codigo}` : "taxa de serviço";
}

/** Acumula todos os problemas do ajuste, sem parar no primeiro. */
function validar(ajuste: Ajuste): string[] {
    const erros: string[] = [];
    const nome = nomeDoAjuste(ajuste);
    const { min, max } = FAIXAS[ajuste.tipo];
    const recebido = formatarPercentual(ajuste.pontosBase);

    // NaN e ±Infinity escapam de qualquer comparação de faixa; param aqui, com mensagem própria.
    if (!Number.isFinite(ajuste.pontosBase)) {
        return [`${nome} deve ser um número finito (recebido: ${ajuste.pontosBase})`];
    }
    if (ajuste.pontosBase < min || ajuste.pontosBase > max) {
        erros.push(
            `${nome} deve estar entre ${formatarPercentual(min)} e ${formatarPercentual(max)} (recebido: ${recebido})`,
        );
    }
    if (!Number.isInteger(ajuste.pontosBase)) {
        erros.push(`${nome} aceita no máximo duas casas decimais no percentual (recebido: ${recebido})`);
    }
    return erros;
}

const UM_POR_PEDIDO: Record<Ajuste["tipo"], string> = {
    "cupom-percentual": "só é aceito um cupom por pedido",
    "taxa-servico": "só é aceita uma taxa de serviço por pedido",
};

function identificar(ajuste: Ajuste): string {
    return ajuste.tipo === "cupom-percentual" ? ajuste.codigo : formatarPercentual(ajuste.pontosBase);
}

/** No máximo um ajuste de cada tipo por pedido: a regra vale para qualquer tipo novo da tabela. */
function validarUmPorTipo(ajustes: Ajuste[]): string[] {
    const erros: string[] = [];
    for (const tipo of Object.keys(UM_POR_PEDIDO) as Ajuste["tipo"][]) {
        const doTipo = ajustes.filter((a) => a.tipo === tipo);
        if (doTipo.length > 1) erros.push(`${UM_POR_PEDIDO[tipo]} (recebido: ${doTipo.map(identificar).join(", ")})`);
    }
    return erros;
}

/** Multiplica primeiro (inteiros, exato) e divide uma única vez, arredondando meio centavo para cima. */
function percentualDe(subtotal: Centavos, pontosBase: PontosBase): Centavos {
    return Math.floor((subtotal * pontosBase + PONTOS_BASE_POR_INTEIRO / 2) / PONTOS_BASE_POR_INTEIRO);
}

type Cupom = Extract<Ajuste, { tipo: "cupom-percentual" }>;
type Taxa = Extract<Ajuste, { tipo: "taxa-servico" }>;

function linhaDaTaxa(subtotal: Centavos, taxa: Taxa): LinhaAjuste | null {
    const valor = percentualDe(subtotal, taxa.pontosBase);
    if (valor === 0) return null; // taxa que arredonda para zero não aparece
    return { tipo: taxa.tipo, descricao: `Taxa de serviço (${formatarPercentual(taxa.pontosBase)})`, valor };
}

function linhaDoCupom(subtotal: Centavos, cupom: Cupom, limiteDesconto: Centavos): LinhaAjuste {
    const cheio = percentualDe(subtotal, cupom.pontosBase);
    const desconto = Math.min(cheio, limiteDesconto);
    const limitado = desconto < cheio ? ", limitado" : "";
    // `-0` quebraria o assert estrito e apareceria como "-R$ 0,00": zero fica sem sinal.
    const valor = desconto === 0 ? 0 : -desconto;
    const descricao = `Cupom ${cupom.codigo} (${formatarPercentual(cupom.pontosBase)}${limitado})`;
    return { tipo: cupom.tipo, descricao, valor };
}

export function aplicarAjustes(subtotal: Centavos, ajustes: Ajuste[]): Resultado<ResumoPedido> {
    const cupons = ajustes.filter((a): a is Cupom => a.tipo === "cupom-percentual");
    const taxas = ajustes.filter((a): a is Taxa => a.tipo === "taxa-servico");

    const erros = [...ajustes.flatMap(validar), ...validarUmPorTipo(ajustes)];
    if (erros.length > 0) return { ok: false, erros };

    // Cupom e taxa são calculados de forma independente, sempre sobre o subtotal original.
    const linhasTaxa = taxas.map((t) => linhaDaTaxa(subtotal, t)).filter((l): l is LinhaAjuste => l !== null);
    const somaTaxas = linhasTaxa.reduce((soma, l) => soma + l.valor, 0);

    // Piso de R$ 0,01: a SEFAZ rejeita nota com total zerado. Quem cede é o cupom, que é o único
    // ajuste que reduz o total; assim o total continua sendo só a soma das linhas, sem correção
    // por fora que faria as linhas deixarem de fechar.
    const limiteDesconto = Math.max(subtotal + somaTaxas - 1, 0);
    const linhasCupom = cupons.map((c) => linhaDoCupom(subtotal, c, limiteDesconto));

    const linhas = [...linhasCupom, ...linhasTaxa]; // cupom sempre antes da taxa na exibição
    const total = subtotal + linhas.reduce((soma, linha) => soma + linha.valor, 0);

    // Rede de segurança que falha alto em vez de corrigir em silêncio.
    if (subtotal >= 1 && total < 1) throw new Error(`invariante violada: total ${total} abaixo de R$ 0,01`);

    return { ok: true, valor: { subtotal, ajustes: linhas, total } };
}
