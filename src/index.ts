import { OdooMCP } from "./mcp";

export { OdooMCP };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Extraer headers de configuración de Odoo
    const odooUrl = request.headers.get("odoo-url");
    const odooDb = request.headers.get("odoo-db");
    const odooUser = request.headers.get("odoo-user");
    const odooPass = request.headers.get("odoo-pass");
    const algoliaApiKey = request.headers.get("algolia-api-key");
    const algoliaAppId = request.headers.get("algolia-app-id");
    const algoliaIndexName = request.headers.get("algolia-index-name");
    const laburenApiKey = request.headers.get("laburen-api-key");
    // Extraer header de tools a usar
    const toUseHeader = request.headers.get("to-use");
    let toolsToUse: string[] = [];

    if (toUseHeader) {
      try {
        toolsToUse = JSON.parse(toUseHeader);
        if (
          !Array.isArray(toolsToUse) ||
          !toolsToUse.every((tool) => typeof tool === "string")
        ) {
          console.warn(
            "⚠️ [fetch] Header 'to-use' debe ser un array de strings. Ignorando configuración."
          );
          toolsToUse = [];
        }
      } catch (error) {
        console.warn(
          "⚠️ [fetch] Error parseando header 'to-use'. Debe ser un JSON válido. Ignorando configuración."
        );
        toolsToUse = [];
      }
    }

    // Configuración de tools a usar desde variables de entorno
    let envToolsToUse: string[] = [];
    if (env.TO_USE) {
      try {
        const parsed = JSON.parse(env.TO_USE);
        if (
          Array.isArray(parsed) &&
          parsed.every((item) => typeof item === "string")
        ) {
          envToolsToUse = parsed;
          console.log("✅ [fetch] Variable TO_USE configurada:", envToolsToUse);
        } else {
          console.warn(
            "⚠️ [fetch] Variable TO_USE debe ser un array de strings. Usando configuración por defecto."
          );
        }
      } catch (error) {
        console.warn(
          "⚠️ [fetch] Error parseando variable TO_USE. Debe ser un JSON válido. Usando configuración por defecto."
        );
      }
    }

    // Crear contexto con configuración
    let context: ExecutionContext;

    // Verificar headers obligatorios de Odoo
    if (!odooUrl || !odooDb || !odooUser || !odooPass) {
      console.log(
        "⚠️ [fetch] Headers de Odoo no encontrados. Intentando usar variables de entorno de Cloudflare Workers."
      );

      // Usar configuración de variables de entorno
      const envConfig = {
        odooUrl: env.ODOO_URL || "https://tu-odoo-instance.com",
        odooDb: env.ODOO_DB || "tu_database",
        odooUser: env.ODOO_USER || "usuario@ejemplo.com",
        odooPass: env.ODOO_PASS || "tu_password",
        odooTimeout: env.ODOO_TIMEOUT || "60000",
        algoliaApiKey: env.ALGOLIA_API_KEY || "",
        algoliaAppId: env.ALGOLIA_APP_ID || "",
        algoliaIndexName: env.ALGOLIA_INDEX_NAME || "",
        laburenApiKey: env.LABUREN_API_KEY || "",
        toolsToUse: envToolsToUse,
      };

      // Inyectar configuración de variables de entorno en las props del ExecutionContext
      context = Object.assign(Object.create(ctx), ctx, {
        props: {
          ...(ctx as any).props,
          ...envConfig,
          toolsToUse: envToolsToUse,
        },
      });

      console.log(
        `🔍 [fetch] Configuración de variables de entorno inyectada: ${envConfig.odooUrl}`
      );

      if (envToolsToUse.length > 0) {
        console.log(`✅ [fetch] Tools a usar: ${envToolsToUse.join(", ")}`);
      } else {
        console.log("✅ [fetch] Todas las tools disponibles (sin filtrado)");
      }
    } else {
      // Inyectar configuración real en las props del ExecutionContext
      context = Object.assign(Object.create(ctx), ctx, {
        props: {
          ...(ctx as any).props,
          odooUrl: odooUrl,
          odooDb: odooDb,
          odooUser: odooUser,
          odooPass: odooPass,
          odooTimeout: request.headers.get("odoo-timeout") || "60000",
          algoliaApiKey: algoliaApiKey,
          algoliaAppId: algoliaAppId,
          algoliaIndexName: algoliaIndexName,
          laburenApiKey: laburenApiKey,
          toolsToUse,
        },
      });

      console.log("🔍 [fetch] Configuración real inyectada desde headers");

      if (toolsToUse.length > 0) {
        console.log(`✅ [fetch] Tools a usar: ${toolsToUse.join(", ")}`);
      } else {
        console.log("✅ [fetch] Todas las tools disponibles (sin filtrado)");
      }
    }

    // Solo MCP endpoints
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return OdooMCP.serveSSE("/sse").fetch(request, env, context);
    }

    if (url.pathname === "/mcp") {
      return OdooMCP.serve("/mcp").fetch(request, env, context);
    }

    return new Response("Not found", { status: 404 });
  },
};
