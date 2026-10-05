import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type TextoResultado = { isError?: boolean; content: { type: string; text: string }[] };
const texto = (r: unknown) => (r as TextoResultado).content[0]!.text;

test("fluxo completo via protocolo MCP", async () => {
  const client = new Client({ name: "teste", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] }));

  try {
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === "fechar_pedido"));

    const carrinho = JSON.parse(texto(await client.callTool({ name: "criar_carrinho", arguments: {} })));

    const invalido = (await client.callTool({
      name: "adicionar_ao_carrinho",
      arguments: { carrinhoId: carrinho.carrinhoId, itemId: "x-burger" },
    })) as TextoResultado;
    assert.equal(invalido.isError, true);
    assert.match(texto(invalido), /Ponto da carne/);

    await client.callTool({
      name: "adicionar_ao_carrinho",
      arguments: {
        carrinhoId: carrinho.carrinhoId,
        itemId: "combo-dupla-coxinha",
        quantidade: 2,
        escolhasCombo: [{ slotId: "coxinhas", itemId: "coxinha", quantidade: 2 }],
      },
    });

    const pedido = JSON.parse(texto(await client.callTool({ name: "fechar_pedido", arguments: { carrinhoId: carrinho.carrinhoId } })));
    assert.equal(pedido.totalCentavos, 2800);
    assert.equal(pedido.totalReais, 28);
  } finally {
    await client.close();
  }
});
