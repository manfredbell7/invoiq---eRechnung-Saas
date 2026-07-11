// routes/ai/index.js — AI Core: KI-Berater, NL-Interface, Insights, Belegprüfung
//
// POST /v1/ai/chat            Chat mit Tool-Use-Loop (liest ERP-Daten, schlägt Aktionen vor)
// POST /v1/ai/execute-action  Führt einen bestätigten Vorschlag aus (Whitelist, User-Token)
// GET  /v1/ai/insights        Deterministische Kennzahlen + KI-Kommentar
// POST /v1/ai/review/:id      KI-gestützte Belegprüfung (Regeln + KI-Einschätzung)
//
// Sicherheit: Alle Tool- und Aktionsausführungen laufen via fastify.inject()
// über die normalen API-Routen mit dem Authorization-Header des anfragenden
// Users — die KI kann den Mandanten-Scope nicht verlassen.

import { authMiddleware } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { validateEN16931 } from '../../services/xmlEngine.js';
import { checkTaxPlausibility } from '../../services/taxEngine.js';
import {
  AI_MODEL, MAX_TOOL_ITERATIONS, READ_TOOLS, WRITE_TOOLS, ACTION_TARGETS,
  buildProposal, payloadForExecution, buildToolDefinitions, buildSystemPrompt,
} from '../../services/aiAdvisor.js';

let _anthropic = null;
async function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

const AI_UNAVAILABLE = {
  error: 'Der KI-Berater ist derzeit nicht verfügbar (ANTHROPIC_API_KEY nicht konfiguriert). Alle Funktionen stehen weiterhin manuell zur Verfügung.',
};

// Tool-Ergebnisse begrenzen, damit lange Listen das Kontextfenster nicht fluten.
function clip(str, max = 6000) {
  return str.length > max ? str.slice(0, max) + `\n…[gekürzt, ${str.length} Zeichen gesamt]` : str;
}

export async function aiRoutes(fastify) {

  // ── CHAT (Natural-Language-ERP) ─────────────────────────────
  fastify.post('/chat', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array', minItems: 1, maxItems: 40,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string', maxLength: 8000 },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const client = await getClient();
    if (!client) return reply.code(503).send(AI_UNAVAILABLE);

    const authHeader = req.headers.authorization;
    const messages = req.body.messages.map(m => ({ role: m.role, content: m.content }));
    const tools = buildToolDefinitions();
    const system = buildSystemPrompt(req.org);
    const actions = [];

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 4000,
          thinking: { type: 'adaptive' },
          system,
          tools,
          messages,
        });

        if (response.stop_reason !== 'tool_use') {
          if (response.stop_reason === 'refusal') {
            return { reply: 'Diese Anfrage kann ich nicht bearbeiten. Bitte formulieren Sie sie anders oder nutzen Sie die manuelle Bedienung.', actions };
          }
          const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
          return { reply: text || 'Keine Antwort erzeugt.', actions };
        }

        // Assistant-Turn (inkl. thinking-Blöcke unverändert) zurückgeben
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          let resultText;

          if (READ_TOOLS[block.name]) {
            // Lese-Tool: über die echte API-Route mit User-Token ausführen
            const res = await fastify.inject({
              method: 'GET',
              url: READ_TOOLS[block.name].path(block.input || {}),
              headers: { authorization: authHeader },
            });
            resultText = res.statusCode < 400
              ? clip(res.body)
              : `Fehler ${res.statusCode}: ${clip(res.body, 500)}`;
          } else if (WRITE_TOOLS[block.name]) {
            // Schreib-Tool: nur Vorschlag erzeugen, nie ausführen
            const proposal = buildProposal(block.name, block.input || {});
            actions.push(proposal);
            resultText = JSON.stringify({
              status: 'vorschlag_erstellt',
              hinweis: 'Der Vorschlag wird dem Nutzer jetzt zur Bestätigung angezeigt. Er wurde NICHT ausgeführt. Fasse ihn kurz zusammen und weise auf etwaige Warnungen hin.',
              summary: proposal.summary,
              totals: proposal.totals || null,
              warnings: proposal.warnings || [],
            });
          } else {
            resultText = `Unbekanntes Tool: ${block.name}`;
          }

          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
        }
        messages.push({ role: 'user', content: toolResults });
      }

      return { reply: 'Die Anfrage war zu umfangreich (Tool-Limit erreicht). Bitte konkreter formulieren.', actions };
    } catch (err) {
      req.log.error(err, 'ai/chat error');
      return reply.code(502).send({ error: 'KI-Dienst momentan nicht erreichbar — bitte erneut versuchen.' });
    }
  });

  // ── EXECUTE-ACTION (bestätigter Vorschlag) ──────────────────
  fastify.post('/execute-action', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['type', 'payload'],
        properties: {
          type: { type: 'string', enum: Object.keys(ACTION_TARGETS) },
          payload: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const { type, payload } = req.body;
    const target = ACTION_TARGETS[type];
    const body = payloadForExecution(type, payload);
    if (!body) return reply.code(400).send({ error: 'Ungültiger Aktions-Payload' });

    const res = await fastify.inject({
      method: target.method,
      url: target.url,
      headers: {
        authorization: req.headers.authorization,
        'content-type': 'application/json',
      },
      payload: body,
    });

    const parsed = (() => { try { return JSON.parse(res.body); } catch { return { raw: res.body }; } })();
    if (res.statusCode >= 400) {
      return reply.code(res.statusCode).send({ error: parsed.error || 'Ausführung fehlgeschlagen', details: parsed });
    }

    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      invoice_id: parsed.id || null,
      action: 'ai_action_executed',
      details: { type, summary: `KI-Vorschlag bestätigt und ausgeführt (${type})` },
    }).catch(() => {});

    return reply.code(201).send({ success: true, type, result: parsed });
  });

  // ── INSIGHTS (Kennzahlen + KI-Kommentar) ────────────────────
  fastify.get('/insights', { preHandler: authMiddleware }, async (req) => {
    const authHeader = req.headers.authorization;
    const [statsRes, cashRes] = await Promise.all([
      fastify.inject({ method: 'GET', url: '/v1/invoices/stats', headers: { authorization: authHeader } }),
      fastify.inject({ method: 'GET', url: '/v1/invoices/cashflow-stats', headers: { authorization: authHeader } }),
    ]);
    const stats = statsRes.statusCode < 400 ? JSON.parse(statsRes.body) : null;
    const cashflow = cashRes.statusCode < 400 ? JSON.parse(cashRes.body) : null;

    const client = await getClient();
    if (!client) return { stats, cashflow, ai_available: false, commentary: null };

    try {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 1200,
        thinking: { type: 'adaptive' },
        system: buildSystemPrompt(req.org),
        messages: [{
          role: 'user',
          content: `Hier die aktuellen Kennzahlen und der Cash-Flow der Organisation als JSON. Gib eine kompakte Management-Einschätzung (max. 5 Sätze) und danach 2–3 konkrete, priorisierte Handlungsempfehlungen als Liste. Keine Floskeln.\n\nKennzahlen: ${JSON.stringify(stats)}\n\nCash-Flow: ${JSON.stringify(cashflow)}`,
        }],
      });
      const commentary = response.stop_reason === 'refusal' ? null
        : response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      return { stats, cashflow, ai_available: true, commentary };
    } catch (err) {
      req.log.warn(err, 'ai/insights: KI-Kommentar fehlgeschlagen');
      return { stats, cashflow, ai_available: false, commentary: null };
    }
  });

  // ── BELEGPRÜFUNG (Regeln + KI) ──────────────────────────────
  fastify.post('/review/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const invoice = await db.findInvoiceById(req.params.id, req.org.id);
    if (!invoice) return reply.code(404).send({ error: 'Rechnung nicht gefunden' });

    const items = typeof invoice.line_items === 'string'
      ? JSON.parse(invoice.line_items || '[]') : (invoice.line_items || []);

    // Deterministische Prüfungen — immer verfügbar
    const en16931 = validateEN16931({ ...invoice, line_items: items });
    const tax = checkTaxPlausibility({
      items: items.map(it => ({ ...it, tax_code: it.tax_code || (parseFloat(it.vat_rate) === 7 ? 'S7' : parseFloat(it.vat_rate) === 0 ? 'E0' : 'S19') })),
      partner: { vat_id: invoice.buyer_vat_id, country: invoice.buyer_country || 'DE' },
    });

    const client = await getClient();
    let aiAssessment = null;
    if (client) {
      try {
        const response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 1500,
          thinking: { type: 'adaptive' },
          system: buildSystemPrompt(req.org),
          messages: [{
            role: 'user',
            content: `Prüfe diese Rechnung fachlich auf Auffälligkeiten (Anomalien bei Beträgen, unplausible Positionen, fehlende Pflichtangaben, Steuerlogik). Regelbasierte Befunde liegen bereits vor — ergänze nur, was darüber hinausgeht, max. 4 Sätze plus ggf. Stichpunkte.\n\nRechnung: ${JSON.stringify({ ...invoice, xml_content: undefined, line_items: items })}\n\nRegelbefunde EN16931: ${JSON.stringify(en16931)}\nSteuerplausibilität: ${JSON.stringify(tax)}`,
          }],
        });
        aiAssessment = response.stop_reason === 'refusal' ? null
          : response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      } catch (err) {
        req.log.warn(err, 'ai/review: KI-Einschätzung fehlgeschlagen');
      }
    }

    return {
      invoice_number: invoice.invoice_number,
      en16931,
      tax_plausibility: tax,
      ai_assessment: aiAssessment,
      ai_available: !!aiAssessment,
    };
  });
}
