import type { IncomingHttpHeaders } from "node:http";

/**
 * Le serveur n'écoute que sur 127.0.0.1, mais un site web quelconque ouvert dans le navigateur
 * pourrait tenter de lui parler (DNS rebinding, requêtes cross-site). On n'accepte donc que
 * les requêtes dont l'hôte et l'origine sont ceux du chat local.
 */
export function isRequestAllowed(headers: IncomingHttpHeaders, port: number): boolean {
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!headers.host || !allowedHosts.includes(headers.host)) return false;
  const origin = headers.origin;
  if (origin === undefined) return true;
  return allowedHosts.some((host) => origin === `http://${host}`);
}
