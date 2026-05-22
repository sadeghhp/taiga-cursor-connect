import { TaigaError } from "./taiga-client.js";
import { SchemaValidationError } from "./schemas.js";

export function formatTaigaError(err: unknown): string {
  if (err instanceof TaigaError || err instanceof SchemaValidationError) {
    const status = err instanceof TaigaError ? err.status : undefined;
    return status ? `${err.message} (HTTP ${status})` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
