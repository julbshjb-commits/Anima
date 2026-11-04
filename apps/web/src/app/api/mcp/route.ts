import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAnimaTools } from "@/lib/mcp/tools";
import { verifyToken } from "@/lib/mcp/auth";

/**
 * Connecteur Anima (MCP) : l'adresse à ajouter dans Claude, Réglages, Connecteurs.
 * Sans jeton OAuth valide, la réponse 401 indique où se connecter
 * (/.well-known/oauth-protected-resource).
 */
const handler = createMcpHandler(registerAnimaTools, {
  serverInfo: { name: "Anima", version: "1.0.0" },
  instructions:
    "Anima est l'espace de vie de la personne : M'organiser (tâches, agenda), Notes, Bibliothèque, Journaux, Cercles, Fichiers. Réponds en français. Appelle anima_espaces pour savoir quels espaces sont ouverts. N'écris dans un journal que si la personne le demande explicitement.",
});

const authed = withMcpAuth(handler, verifyToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
