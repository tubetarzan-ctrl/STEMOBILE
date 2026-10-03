"use client";
import Dexie, { type Table } from "dexie";

// Offline POS store (§5.6). Catalog + prices cached; sales queued with a
// client-generated UUID as the idempotency key, synced in order on reconnect.

export type CatalogItem = {
  id: string; sku: string; barcode: string | null; name: string; grade: string; price: number; min_price: number;
  on_hand: number; is_serialized: boolean; search: string;
};
export type QueuedSale = {
  idempotency_key: string; created_at: number; payload: Record<string, unknown>;
  status: "queued" | "syncing" | "failed"; error?: string; attempts: number;
};

class PosDB extends Dexie {
  catalog!: Table<CatalogItem, string>;
  queue!: Table<QueuedSale, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super("startech-pos");
    this.version(1).stores({ catalog: "id, sku, barcode, search", queue: "idempotency_key, created_at, status", meta: "key" });
  }
}

let db: PosDB | null = null;
export function posDb(): PosDB {
  db ??= new PosDB();
  return db;
}
