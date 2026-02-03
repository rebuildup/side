import crypto from "node:crypto";
import { Hono } from "hono";
import { createHttpError, handleError, readJson } from "../utils/error.js";
import { requireWorkspace } from "./workspaces.js";
export function createDeckRouter(db, workspaces, decks) {
    const router = new Hono();
    const insertDeck = db.prepare("INSERT INTO decks (id, name, root, workspace_id, created_at) VALUES (?, ?, ?, ?, ?)");
    function createDeck(name, workspaceId) {
        const workspace = requireWorkspace(workspaces, workspaceId);
        const deck = {
            id: crypto.randomUUID(),
            name: name || `Deck ${decks.size + 1}`,
            root: workspace.path,
            workspaceId,
            createdAt: new Date().toISOString(),
        };
        decks.set(deck.id, deck);
        insertDeck.run(deck.id, deck.name, deck.root, deck.workspaceId, deck.createdAt);
        return deck;
    }
    router.get("/", (c) => {
        return c.json(Array.from(decks.values()));
    });
    router.post("/", async (c) => {
        try {
            const body = await readJson(c);
            const workspaceId = body?.workspaceId;
            if (!workspaceId) {
                throw createHttpError("workspaceId is required", 400);
            }
            const deck = createDeck(body?.name, workspaceId);
            return c.json(deck, 201);
        }
        catch (error) {
            return handleError(c, error);
        }
    });
    return router;
}
