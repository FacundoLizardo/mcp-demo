import { v4 as uuid } from "uuid";

export interface OdooConfig {
  baseUrl: string;
  db: string;
  username: string;
  password: string;
  timeout?: number;
}

export class OdooClient {
  private uid: number | null = null;
  private readonly cfg: OdooConfig;

  constructor(cfg: OdooConfig) {
    this.cfg = { timeout: 60000, ...cfg }; // Aumentado a 60 segundos
  }

  /* ---------- helpers ---------- */
  private async jsonRpc(service: string, method: string, args: any[]) {
    const payload = {
      jsonrpc: "2.0",
      id: uuid(),
      method: "call",
      params: { service, method, args },
    };

    const resp = await fetch(`${this.cfg.baseUrl}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cf: { timeout: this.cfg.timeout },
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data = await resp.json<any>();
    if (data.error) {
      throw new Error(data.error.data?.message ?? "Odoo RPC error");
    }

    return data.result;
  }

  private async login() {
    if (this.uid != null) {
      return;
    }

    this.uid = await this.jsonRpc("common", "login", [
      this.cfg.db,
      this.cfg.username,
      this.cfg.password,
    ]);
  }

  /* ---------- API públicos ---------- */
  async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ) {
    await this.login();
    return this.jsonRpc("object", "execute_kw", [
      this.cfg.db,
      this.uid,
      this.cfg.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }
}
