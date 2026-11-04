import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

/**
 * Métadonnées OAuth du connecteur (RFC 9728) : indiquent aux assistants que la
 * connexion passe par le serveur d'autorisation de Supabase.
 */
function handler(req: Request) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return new Response("Anima n'est pas configuré.", { status: 503 });
  const origin = new URL(req.url).origin;
  return protectedResourceHandler({ authServerUrls: [`${base}/auth/v1`], resourceUrl: `${origin}/api/mcp` })(req);
}

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
