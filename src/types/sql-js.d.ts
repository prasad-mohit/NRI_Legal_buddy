declare module "sql.js" {
  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
  export default initSqlJs;
  export type { Database, Statement, SqlJsStatic };
}

declare module "sql.js/dist/sql-asm.js" {
  import type { SqlJsStatic } from "sql.js";
  function initSqlJsSync(): SqlJsStatic;
  export = initSqlJsSync;
}
