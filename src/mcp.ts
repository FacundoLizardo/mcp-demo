import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OdooClient } from "./odooClient";
// Importa aquí tus tools específicos
// import * as Tools from "./tools";

export class OdooMCP extends McpAgent {
  private odoo!: OdooClient;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log("🏗️ [OdooMCP] Constructor llamado");
  }

  server = new McpServer({
    name: "Odoo MCP",
    version: "0.2.0",
    description: "Expose Odoo models & helpers over MCP",
    timeout: 60000, // Timeout de 60 segundos para MCP
  });

  // Método helper para obtener configuración del contexto
  private getConfigFromContext() {
    const contextProps = (this as any).props;
    console.log(
      "🔍 [OdooMCP] Context props:",
      JSON.stringify(contextProps, null, 2)
    );

    const odooConfig = {
      baseUrl: contextProps.odooUrl || "",
      db: contextProps.odooDb || "",
      username: contextProps.odooUser || "",
      password: contextProps.odooPass || "",
      timeout: parseInt(contextProps.odooTimeout || "60000", 10), // Timeout configurable
    };

    const algoliaConfig = {
      apiKey: contextProps.algoliaApiKey || "",
      appId: contextProps.algoliaAppId || "",
      indexName: contextProps.algoliaIndexName || "",
    };

    // Obtener tools a usar del contexto
    const toolsToUse = contextProps.toolsToUse || [];

    // Obtener laburenApiKey del contexto
    const laburenApiKey = contextProps.laburenApiKey || "";

    return { odooConfig, algoliaConfig, toolsToUse, laburenApiKey };
  }

  // Método helper para obtener cliente Odoo actualizado
  private getOdooClient() {
    const { odooConfig } = this.getConfigFromContext();
    this.odoo = new OdooClient(odooConfig);
    return this.odoo;
  }

  // Método helper para obtener configuración de Algolia
  private getAlgoliaConfig() {
    const { algoliaConfig } = this.getConfigFromContext();
    return algoliaConfig;
  }

  // Método helper para verificar si una tool debe ser ignorada
  private shouldIgnoreTool(toolName: string): boolean {
    const { toolsToUse } = this.getConfigFromContext();

    // Si no hay toolsToUse configuradas, todas las tools están disponibles
    if (toolsToUse.length === 0) {
      return false;
    }

    // Si hay toolsToUse configuradas, solo las que están en la lista están disponibles
    const shouldIgnore = !toolsToUse.includes(toolName);

    if (shouldIgnore) {
      console.log(
        `🚫 [OdooMCP] Tool '${toolName}' ignorada - no está en la lista de tools a usar`
      );
    }

    return shouldIgnore;
  }

  async init() {
    console.log("🔧 [OdooMCP] init() llamado");

    // Inicializar con configuración del contexto (ya validada en index.ts)
    const { odooConfig, toolsToUse } = this.getConfigFromContext();
    this.odoo = new OdooClient(odooConfig);
    console.log(
      "✅ [OdooMCP] Cliente Odoo inicializado con configuración del contexto"
    );

    // Log de tools a usar
    if (toolsToUse.length > 0) {
      console.log(`✅ [OdooMCP] Tools a usar: ${toolsToUse.join(", ")}`);
    } else {
      console.log("✅ [OdooMCP] Todas las tools disponibles (sin filtrado)");
    }

    /*──────────────── EJEMPLO: search_product_by_reference_code ────────────────*/
    if (!this.shouldIgnoreTool("search_product_by_reference_code")) {
      this.server.tool(
        "search_product_by_reference_code",
        "Search for a product by its exact reference code. Returns detailed product information including price, stock, and optional fields like brand and description.",
        { reference_code: z.string() },
        async ({ reference_code }, context) => {
          try {
            const odoo = this.getOdooClient();
            
            // Ejemplo de búsqueda de producto
            const [product] = await odoo.executeKw(
              "product.product",
              "search_read",
              [[["default_code", "=", reference_code]]],
              { 
                fields: ["id", "name", "default_code", "list_price", "qty_available"],
                limit: 1 
              }
            );

            if (!product) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: "Product not found" }),
                  },
                ],
              };
            }

            return {
              content: [{ type: "text", text: JSON.stringify(product) }],
            };
          } catch (error) {
            console.error("💥 [search_product_by_reference_code] Error:", error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error al buscar producto: ${
                    (error as Error).message || error
                  }`,
                },
              ],
            };
          }
        }
      );
    }

    /*──────────────── EJEMPLO: create_sale_order ─────────────*/
    if (!this.shouldIgnoreTool("create_sale_order")) {
      this.server.tool(
        "create_sale_order",
        "Create a complete sales order with multiple product lines. Automatically identifies customer by tax ID and can optionally confirm the order. Returns order ID for tracking.",
        {
          tax_id: z.string(),
          confirm: z.boolean().optional(),
          lines: z.array(
            z.object({
              reference_code: z.string(),
              qty: z.number().positive().default(1),
            })
          ),
        },
        async ({ tax_id, confirm = false, lines }, context) => {
          try {
            const odoo = this.getOdooClient();
            
            // Buscar partner
            const [partner] = await odoo.executeKw(
              "res.partner",
              "search_read",
              [[["vat", "=", tax_id]]],
              { fields: ["id"], limit: 1 }
            );

            if (!partner) {
              throw new Error("Partner not found");
            }

            // Crear orden
            const orderId = await odoo.executeKw("sale.order", "create", [
              {
                partner_id: partner.id,
              },
            ]);

            // Crear líneas
            for (const line of lines) {
              const [prod] = await odoo.executeKw(
                "product.product",
                "search_read",
                [[["default_code", "=", line.reference_code]]],
                { fields: ["id"], limit: 1 }
              );

              if (!prod) {
                throw new Error(`Product ${line.reference_code} missing`);
              }

              await odoo.executeKw("sale.order.line", "create", [
                {
                  order_id: orderId,
                  product_id: prod.id,
                  product_uom_qty: line.qty,
                },
              ]);
            }

            const result = {
              order_id: orderId,
              confirmed: confirm,
            };

            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
            };
          } catch (error) {
            console.error("💥 [create_sale_order] Error:", error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error al crear orden de venta: ${
                    (error as Error).message || error
                  }`,
                },
              ],
            };
          }
        }
      );
    }

    /*────────────── resources URI ───────────────*/
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
