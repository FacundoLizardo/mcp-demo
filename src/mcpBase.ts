import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OdooClient } from "../odooClient";

/**
 * Clase base para crear servidores MCP con Odoo
 * Proporciona la estructura básica y métodos helpers comunes
 */
export abstract class BaseMCP extends McpAgent {
  protected odoo!: OdooClient;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log("🏗️ [BaseMCP] Constructor llamado");
  }

  server = new McpServer({
    name: "Base MCP",
    version: "1.0.0",
    description: "Base MCP server for Odoo integration",
    timeout: 60000, // Timeout configurable
  });

  // Método helper para obtener configuración del contexto
  protected getConfigFromContext() {
    const contextProps = (this as any).props;
    
    const odooConfig = {
      baseUrl: contextProps.odooUrl || "",
      db: contextProps.odooDb || "",
      username: contextProps.odooUser || "",
      password: contextProps.odooPass || "",
      timeout: parseInt(contextProps.odooTimeout || "60000", 10),
    };

    const algoliaConfig = {
      apiKey: contextProps.algoliaApiKey || "",
      appId: contextProps.algoliaAppId || "",
      indexName: contextProps.algoliaIndexName || "",
    };

    const toolsToUse = contextProps.toolsToUse || [];
    const laburenApiKey = contextProps.laburenApiKey || "";

    return { odooConfig, algoliaConfig, toolsToUse, laburenApiKey };
  }

  // Método helper para obtener cliente Odoo actualizado
  protected getOdooClient() {
    const { odooConfig } = this.getConfigFromContext();
    this.odoo = new OdooClient(odooConfig);
    return this.odoo;
  }

  // Método helper para verificar si una tool debe ser ignorada
  protected shouldIgnoreTool(toolName: string): boolean {
    const { toolsToUse } = this.getConfigFromContext();

    if (toolsToUse.length === 0) {
      return false;
    }

    const shouldIgnore = !toolsToUse.includes(toolName);

    if (shouldIgnore) {
      console.log(`🚫 [BaseMCP] Tool '${toolName}' ignorada`);
    }

    return shouldIgnore;
  }

  // Método helper para crear respuestas de error estandarizadas
  protected createErrorResponse(error: unknown, operation: string) {
    console.error(`💥 [${operation}] Error:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error en ${operation}: ${
            (error as Error).message || error
          }`,
        },
      ],
    };
  }

  // Método helper para crear respuestas exitosas
  protected createSuccessResponse(data: any) {
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  }

  // Método helper para buscar un partner por VAT
  protected async findPartnerByVat(vat: string) {
    const odoo = this.getOdooClient();
    const [partner] = await odoo.executeKw(
      "res.partner",
      "search_read",
      [[["vat", "=", vat]]],
      { fields: ["id", "name", "email", "phone"], limit: 1 }
    );
    return partner;
  }

  // Método helper para buscar producto por código de referencia
  protected async findProductByCode(referenceCode: string) {
    const odoo = this.getOdooClient();
    const [product] = await odoo.executeKw(
      "product.product",
      "search_read",
      [[["default_code", "=", referenceCode]]],
      { 
        fields: ["id", "name", "default_code", "list_price", "qty_available"], 
        limit: 1 
      }
    );
    return product;
  }

  // Método helper para crear una orden de venta básica
  protected async createBasicSaleOrder(partnerId: number) {
    const odoo = this.getOdooClient();
    const orderId = await odoo.executeKw("sale.order", "create", [
      {
        partner_id: partnerId,
      },
    ]);
    return orderId;
  }

  // Método helper para crear línea de orden
  protected async createOrderLine(orderId: number, productId: number, qty: number) {
    const odoo = this.getOdooClient();
    const lineId = await odoo.executeKw("sale.order.line", "create", [
      {
        order_id: orderId,
        product_id: productId,
        product_uom_qty: qty,
      },
    ]);
    return lineId;
  }

  // Método abstracto que debe implementar cada servidor específico
  abstract init(): Promise<void>;

  // Configurar recursos básicos de Odoo
  protected setupBasicResources() {
    this.server.resource("models", "odoo://models", async () => {
      return this.odoo.executeKw("ir.model", "search_read", [
        [],
        ["model", "name"],
      ]);
    });

    this.server.resource("model", "odoo://model/:model", async (req) => {
      const model = req.pathname.split("/").pop()!;
      return this.odoo.executeKw(model, "fields_get", [
        [],
        ["string", "type", "required"],
      ]);
    });

    this.server.resource("record", "odoo://record/:model/:id", async (req) => {
      const [, model, id] = req.pathname.split("/");
      const [rec] = await this.odoo.executeKw(model, "read", [[Number(id)]]);
      return rec ?? {};
    });

    this.server.resource(
      "search",
      "odoo://search/:model/:domain",
      async (req) => {
        const [, model, domainStr] = req.pathname.split("/");
        const domain = JSON.parse(decodeURIComponent(domainStr));
        return this.odoo.executeKw(model, "search_read", [domain]);
      }
    );
  }
}
