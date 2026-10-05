/** Valores monetários sempre em centavos (inteiros) para evitar erro de ponto flutuante. */
export type Centavos = number;

export interface Categoria {
  id: string;
  nome: string;
}

export interface OpcaoModificador {
  id: string;
  nome: string;
  precoAdicional: Centavos;
  disponivel: boolean;
}

/** Grupo de adicionais/escolhas. min/max contam a soma das quantidades escolhidas no grupo. */
export interface GrupoModificador {
  id: string;
  nome: string;
  min: number;
  max: number;
  /** Limite de repetições da mesma opção (ex.: no máximo 2x granola). Padrão: 1. */
  maxPorOpcao?: number;
  opcoes: OpcaoModificador[];
}

interface ItemBase {
  id: string;
  nome: string;
  descricao: string;
  categoriaId: string;
  preco: Centavos;
  disponivel: boolean;
}

export interface ItemSimples extends ItemBase {
  tipo: "simples";
  gruposModificadores: GrupoModificador[];
}

export interface ItemPermitidoNoSlot {
  itemId: string;
  /** Acréscimo ao trocar por esse item (ex.: trocar batata pequena por grande). */
  precoAdicional: Centavos;
}

/** Etapa de um combo / venda orientada (ex.: "Escolha a bebida"). */
export interface SlotCombo {
  id: string;
  nome: string;
  min: number;
  max: number;
  itensPermitidos: ItemPermitidoNoSlot[];
}

export interface ItemCombo extends ItemBase {
  tipo: "combo";
  slots: SlotCombo[];
}

export type Item = ItemSimples | ItemCombo;

export interface Catalogo {
  categorias: Categoria[];
  itens: Item[];
}

// ---------- Seleção feita pelo cliente / agente ----------

export interface SelecaoModificador {
  grupoId: string;
  opcaoId: string;
  quantidade: number;
}

export interface SelecaoSlot {
  slotId: string;
  itemId: string;
  quantidade: number;
  modificadores?: SelecaoModificador[] | undefined;
}

export interface SelecaoItem {
  itemId: string;
  quantidade: number;
  modificadores?: SelecaoModificador[] | undefined;
  escolhasCombo?: SelecaoSlot[] | undefined;
}

// ---------- Resultado de precificação ----------

export interface LinhaPrecificada {
  itemId: string;
  nome: string;
  quantidade: number;
  /** Preço de UMA unidade já com adicionais e escolhas do combo. */
  precoUnitario: Centavos;
  /** precoUnitario * quantidade — o pai multiplica tudo que está dentro dele. */
  total: Centavos;
  detalhes: string[];
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: string[] };
