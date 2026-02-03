/**
 * Agent Management API Routes
 *
 * REST API endpoints for managing AI agents.
 * Provides agent listing, details, terminal launch, and config management.
 */

import { Hono } from "hono";
import type { AgentId } from "../agents/types.js";
import type { AgentInterface } from "../agents/base/AgentInterface.js";
import { createHttpError, handleError, readJson } from "../utils/error.js";

/**
 * Agent registry - stores available agent instances
 */
const agentRegistry = new Map<AgentId, AgentInterface>();

/**
 * Register an agent
 */
export function registerAgent(agent: AgentInterface): void {
  agentRegistry.set(agent.id, agent);
}

/**
 * Unregister an agent
 */
export function unregisterAgent(agentId: AgentId): void {
  agentRegistry.delete(agentId);
}

/**
 * Get an agent by ID
 */
export function getAgent(agentId: AgentId): AgentInterface | undefined {
  return agentRegistry.get(agentId);
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentInterface[] {
  return Array.from(agentRegistry.values());
}

/**
 * Create agent router
 */
export function createAgentRouter() {
  const router = new Hono();

  /**
   * GET /api/agents - List all available agents
   */
  router.get("/", async (c) => {
    try {
      const agents = await Promise.all(
        getAllAgents().map(async (agent) => {
          const available = await agent.isAvailable();
          return {
            id: agent.id,
            name: agent.name,
            icon: agent.icon,
            description: agent.description,
            enabled: available,
          };
        })
      );

      return c.json(agents);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/agents/:id - Get agent details
   */
  router.get("/:id", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const available = await agent.isAvailable();
      const config = await agent.getConfig();

      return c.json({
        id: agent.id,
        name: agent.name,
        icon: agent.icon,
        description: agent.description,
        enabled: available,
        config: {
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          // Don't expose API key
        },
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/agents/:id/terminal - Start agent terminal
   */
  router.post("/:id/terminal", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{
        cwd?: string;
        env?: Record<string, string>;
        command?: string;
        title?: string;
        rows?: number;
        cols?: number;
      }>(c));

      const terminal = await agent.startTerminal({
        cwd: body?.cwd,
        env: body?.env,
        command: body?.command,
        title: body?.title,
        rows: body?.rows,
        cols: body?.cols,
      });

      return c.json(terminal, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/agents/:id/config - Get agent config
   */
  router.get("/:id/config", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const config = await agent.getConfig();

      // Don't expose API key in response
      const safeConfig = { ...config };
      if (safeConfig.apiKey) {
        safeConfig.apiKey = "••••••••••••";
      }

      return c.json(safeConfig);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * PUT /api/agents/:id/config - Update agent config
   */
  router.put("/:id/config", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{
        apiKey?: string;
        apiEndpoint?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
        [key: string]: unknown;
      }>(c));

      // Handle password placeholder
      if (body.apiKey === "••••••••••••") {
        delete body.apiKey;
      }

      await agent.updateConfig(body);

      return c.json({ success: true });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/agents/:id/mcps - List agent's MCP servers
   */
  router.get("/:id/mcps", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const mcps = await agent.listMCPs();
      return c.json(mcps);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/agents/:id/mcps - Add MCP server to agent
   */
  router.post("/:id/mcps", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{
        id?: string;
        name: string;
        command: string;
        args?: string[];
        env?: Record<string, string>;
        enabled?: boolean;
      }>(c));

      const mcpId = body.id || body.name;
      await agent.addMCP({
        id: mcpId,
        name: body.name,
        command: body.command,
        args: body.args,
        env: body.env,
        enabled: body.enabled,
      });

      return c.json({ success: true, id: mcpId });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * DELETE /api/agents/:id/mcps/:mcpId - Remove MCP server from agent
   */
  router.delete("/:id/mcps/:mcpId", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const mcpId = c.req.param("mcpId");
      await agent.removeMCP(mcpId);

      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/agents/:id/skills - List agent's Skills
   */
  router.get("/:id/skills", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const skills = await agent.listSkills();
      return c.json(skills);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/agents/:id/skills - Add Skill to agent
   */
  router.post("/:id/skills", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{
        id?: string;
        name: string;
        description?: string;
        enabled?: boolean;
        config?: Record<string, unknown>;
      }>(c));

      const skillId = body.id || body.name;
      await agent.addSkill({
        id: skillId,
        name: body.name,
        description: body.description,
        enabled: body.enabled,
        config: body.config,
      });

      return c.json({ success: true, id: skillId });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * DELETE /api/agents/:id/skills/:skillId - Remove Skill from agent
   */
  router.delete("/:id/skills/:skillId", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const skillId = c.req.param("skillId");
      await agent.removeSkill(skillId);

      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/agents/:id/send - Send message to agent
   */
  router.post("/:id/send", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{ content: string }>(c));

      const result = await agent.sendMessage(body.content);

      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/agents/:id/execute - Execute task with agent
   */
  router.post("/:id/execute", async (c) => {
    try {
      const agentId = c.req.param("id") as AgentId;
      const agent = getAgent(agentId);

      if (!agent) {
        throw createHttpError("Agent not found", 404);
      }

      const body = (await readJson<{
        type: "prompt" | "command" | "code" | "custom";
        content: string;
        options?: Record<string, unknown>;
      }>(c));

      const result = await agent.executeTask({
        id: `${agentId}-${Date.now()}`,
        type: body.type,
        content: body.content,
        options: body.options,
      });

      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}

/**
 * Agent router instance (created after agents are registered)
 */
export let agentRouter: ReturnType<typeof createAgentRouter>;

/**
 * Initialize agent router (call after registering all agents)
 */
export function initializeAgentRouter() {
  agentRouter = createAgentRouter();
  return agentRouter;
}
