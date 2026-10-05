import type { Centavos, Resultado } from "./types.js";

export type Ajuste =
    | { tipo: "cupom-percentual"; codigo: string; percentual: number } // 10 = 10%
    | { tipo: "taxa-servico"; percentual: number };

export interface LinhaAjuste {
    descricao: string;
    valor: Centavos; // negativo para desconto, positivo para taxa
}

export interface ResumoPedido {
    subtotal: Centavos;
    ajustes: LinhaAjuste[];
    total: Centavos;
}

export function aplicarAjustes(subtotal: Centavos, ajustes: Ajuste[]): Resultado<ResumoPedido> {
    throw new Error("não implementado");
}