import { TaigaError } from "./http/client.js";
import { SchemaValidationError } from "./schemas.js";
export function formatTaigaError(err) {
    if (err instanceof TaigaError || err instanceof SchemaValidationError) {
        const status = err instanceof TaigaError ? err.status : undefined;
        return status ? `${err.message} (HTTP ${status})` : err.message;
    }
    return err instanceof Error ? err.message : String(err);
}
