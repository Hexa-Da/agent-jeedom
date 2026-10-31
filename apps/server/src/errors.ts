import { AuthenticationError, NetworkError, RateLimitError } from "@cursor/sdk";

export class MissingApiKeyError extends Error {
  constructor() {
    super("La clé API Cursor est absente. Renseignez CURSOR_API_KEY dans le fichier .env (voir le README).");
  }
}

export class BusyError extends Error {
  constructor() {
    super("L'assistant est déjà en train de répondre. Patientez un instant.");
  }
}

/** Message lisible pour un non-technicien ; le détail technique reste dans les logs du serveur. */
export function describeError(err: unknown): string {
  if (err instanceof MissingApiKeyError || err instanceof BusyError) return err.message;
  if (err instanceof AuthenticationError) {
    return "La clé API Cursor est refusée. Prévenez la personne qui a installé l'assistant.";
  }
  if (err instanceof NetworkError) {
    return "Impossible de joindre le service Cursor. Vérifiez la connexion internet puis réessayez.";
  }
  if (err instanceof RateLimitError) {
    return "Trop de demandes en peu de temps. Réessayez dans une minute.";
  }
  return `Une erreur est survenue : ${err instanceof Error ? err.message : String(err)}`;
}
