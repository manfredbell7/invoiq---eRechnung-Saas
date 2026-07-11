// services/aiAdvisor.js — KI-Berater-Kern (Natural-Language-ERP)
//
// Architekturprinzip: Die KI schlägt vor, der Mensch bestätigt.
//   · LESE-Tools werden serverseitig ausgeführt — via fastify.inject() gegen
//     die bestehenden, authentifizierten API-Routen (identische Tenancy- und
//     Berechtigungsprüfung wie bei manueller Bedienung, kein KI-Sonderweg).
//   · SCHREIB-Tools (propose_*) werden NIE direkt ausgeführt: sie erzeugen
//     einen Aktionsvorschlag mit vorgerechneten Summen (taxEngine), den der
//     User im Frontend bestätigen muss. Erst /v1/ai/execute-action führt die
//     Aktion aus — wieder über die normalen API-Routen mit dem User-Token.
//
// Modell: claude-opus-4-8 (adaptives Thinking, offizielles @anthropic-ai/sdk).

import { randomUUID } from 'crypto';
import { computeTotals, checkTaxPlausibility, TAX_CODES } from './taxEngine.js';

export const AI_MODEL = 'claude-opus-4-8';
export const MAX_TOOL_ITERATIONS = 8;

// ── LESE-TOOLS: name → GET-Pfad-Builder ──────────────────────
export const READ_TOOLS = {
  get_kennzahlen: {
    description: 'Liefert die aktuellen Kennzahlen der Organisation: Anzahl Ausgangs-/Eingangsrechnungen, Fehler, Compliance-Score, Wochenverlauf, Formatverteilung, Planlimit.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    path: () => '/v1/invoices/stats',
  },
  get_cashflow: {
    description: 'Liefert offene Forderungen und Verbindlichkeiten, fällige Beträge dieser Woche und eine 30-Tage-Cash-Flow-Prognose (tagesweise, aus Fälligkeitsdaten berechnet).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    path: () => '/v1/invoices/cashflow-stats',
  },
  list_invoices: {
    description: 'Listet Rechnungen der Organisation. Optional filterbar nach Status (draft/validated/sent/paid) und Volltextsuche (Rechnungsnummer, Empfänger).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Optional: draft, validated, sent oder paid' },
        search: { type: 'string', description: 'Optional: Suchbegriff' },
        limit:  { type: 'integer', description: 'Max. Anzahl (Standard 20)' },
      },
      additionalProperties: false,
    },
    path: (i) => `/v1/invoices?limit=${Math.min(i.limit || 20, 50)}`
      + (i.status ? `&status=${encodeURIComponent(i.status)}` : '')
      + (i.search ? `&search=${encodeURIComponent(i.search)}` : ''),
  },
  list_customers: {
    description: 'Listet die Kundenstammdaten (Name, USt-IdNr., Adresse, E-Mail, Zahlungsziel).',
    input_schema: {
      type: 'object',
      properties: { search: { type: 'string', description: 'Optional: Namenssuche' } },
      additionalProperties: false,
    },
    path: (i) => `/v1/customers${i.search ? `?search=${encodeURIComponent(i.search)}` : ''}`,
  },
  list_items: {
    description: 'Listet den Artikel-/Leistungsstamm (Artikelnummer, Bezeichnung, Preis, Einheit, Steuerkennzeichen).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    path: () => '/v1/business/items',
  },
  list_documents: {
    description: 'Listet Vertriebsbelege (Anfrage/Angebot/Auftrag/Lieferung) mit Status und Summen.',
    input_schema: {
      type: 'object',
      properties: {
        doc_type: { type: 'string', description: 'Optional: request, quote, order oder delivery' },
      },
      additionalProperties: false,
    },
    path: (i) => `/v1/business/documents${i.doc_type ? `?doc_type=${encodeURIComponent(i.doc_type)}` : ''}`,
  },
  get_tax_codes: {
    description: 'Liefert den Steuerkennzeichen-Katalog (S19, S7, E0, RC, IG) mit Sätzen, UNTDID-Kategorien und rechtlichen Hinweisen.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    path: () => '/v1/business/tax-codes',
  },
};

// ── SCHREIB-TOOLS: erzeugen nur Vorschläge ───────────────────
const LINE_ITEMS_SCHEMA = {
  type: 'array',
  description: 'Positionen des Belegs',
  items: {
    type: 'object',
    required: ['description', 'quantity', 'unit_price'],
    properties: {
      description: { type: 'string' },
      quantity: { type: 'number' },
      unit_price: { type: 'number', description: 'Nettopreis pro Einheit in EUR' },
      tax_code: { type: 'string', description: 'Steuerkennzeichen: S19 (19%), S7 (7%), E0 (steuerfrei), RC (Reverse-Charge), IG (innergem. Lieferung). Standard: S19' },
    },
    additionalProperties: false,
  },
};

export const WRITE_TOOLS = {
  propose_invoice: {
    description: 'Schlägt eine neue Ausgangsrechnung vor. Wird dem Nutzer mit vorgerechneten Summen zur Bestätigung angezeigt — NICHT direkt erstellt. Nutze zuvor list_customers, um Kundendaten zu übernehmen, und list_items für Preise.',
    input_schema: {
      type: 'object',
      required: ['buyer_name', 'line_items'],
      properties: {
        buyer_name: { type: 'string', description: 'Name des Rechnungsempfängers' },
        buyer_address: { type: 'string' },
        buyer_city: { type: 'string' },
        buyer_country: { type: 'string', description: 'ISO-Code, Standard DE' },
        buyer_vat_id: { type: 'string' },
        buyer_email: { type: 'string' },
        due_date: { type: 'string', description: 'Fälligkeitsdatum YYYY-MM-DD' },
        format: { type: 'string', description: 'xrechnung (Standard), zugferd, peppol oder facturx' },
        line_items: LINE_ITEMS_SCHEMA,
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  propose_document: {
    description: 'Schlägt einen neuen Vertriebsbeleg vor (Anfrage, Angebot, Auftrag oder Lieferung) — wird dem Nutzer zur Bestätigung angezeigt, NICHT direkt erstellt.',
    input_schema: {
      type: 'object',
      required: ['doc_type', 'partner_name', 'items'],
      properties: {
        doc_type: { type: 'string', enum: ['request', 'quote', 'order', 'delivery'] },
        partner_name: { type: 'string' },
        valid_until: { type: 'string', description: 'Nur Angebot: gültig bis YYYY-MM-DD' },
        payment_terms_days: { type: 'integer' },
        reference: { type: 'string' },
        notes: { type: 'string' },
        items: LINE_ITEMS_SCHEMA,
      },
      additionalProperties: false,
    },
  },
  propose_customer: {
    description: 'Schlägt das Anlegen eines neuen Kunden im Stammdatensatz vor — wird dem Nutzer zur Bestätigung angezeigt.',
    input_schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        zip: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
        vat_id: { type: 'string' },
        payment_terms_days: { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
};

// Vorschlagstyp → Ziel-Endpoint für die bestätigte Ausführung.
// Whitelist: execute-action akzeptiert ausschließlich diese Typen.
export const ACTION_TARGETS = {
  create_invoice:  { method: 'POST', url: '/v1/invoices' },
  create_document: { method: 'POST', url: '/v1/business/documents' },
  create_customer: { method: 'POST', url: '/v1/customers' },
};

const PROPOSAL_TYPE = {
  propose_invoice:  'create_invoice',
  propose_document: 'create_document',
  propose_customer: 'create_customer',
};

const DOC_LABELS = { request: 'Anfrage', quote: 'Angebot', order: 'Auftrag', delivery: 'Lieferung' };

// Baut aus einem propose_*-Toolaufruf einen prüfbaren Aktionsvorschlag:
// Summen werden deterministisch vorgerechnet (taxEngine), Plausibilität geprüft.
export function buildProposal(toolName, input) {
  const type = PROPOSAL_TYPE[toolName];
  if (!type) return null;

  const proposal = { id: randomUUID(), type, payload: { ...input } };

  if (type === 'create_invoice' || type === 'create_document') {
    const items = (input.line_items || input.items || []).map(it => ({
      description: String(it.description || ''),
      quantity: parseFloat(it.quantity) || 0,
      unit_price: parseFloat(it.unit_price) || 0,
      tax_code: it.tax_code || 'S19',
    }));
    const totals = computeTotals(items);
    const partner = {
      vat_id: input.buyer_vat_id || null,
      country: input.buyer_country || 'DE',
    };
    proposal.totals = {
      net: totals.amount_net, tax: totals.amount_tax, gross: totals.amount_gross,
      breakdown: totals.tax_breakdown,
    };
    proposal.warnings = checkTaxPlausibility({ items, partner, totals });
    const who = input.buyer_name || input.partner_name;
    proposal.summary = type === 'create_invoice'
      ? `Rechnung an ${who} über ${totals.amount_gross.toFixed(2)} € brutto (${items.length} Position${items.length === 1 ? '' : 'en'})`
      : `${DOC_LABELS[input.doc_type] || input.doc_type} für ${who} über ${totals.amount_gross.toFixed(2)} € brutto`;
  } else if (type === 'create_customer') {
    proposal.summary = `Kunde „${input.name}" anlegen${input.vat_id ? ` (USt-IdNr. ${input.vat_id})` : ''}`;
    proposal.warnings = [];
  }

  return proposal;
}

// Vorschlags-Payload → Request-Body für den Ziel-Endpoint.
export function payloadForExecution(type, payload) {
  if (type === 'create_invoice') {
    const items = (payload.line_items || []).map(it => {
      const code = TAX_CODES[it.tax_code] ? it.tax_code : 'S19';
      return {
        description: it.description,
        quantity: parseFloat(it.quantity) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
        vat_rate: TAX_CODES[code].rate,
        tax_code: code,
      };
    });
    return {
      invoice_number: payload.invoice_number
        || `RE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      invoice_date: payload.invoice_date || new Date().toISOString().slice(0, 10),
      ...(payload.due_date ? { due_date: payload.due_date } : {}),
      format: payload.format || 'xrechnung',
      buyer_name: payload.buyer_name,
      ...(payload.buyer_address ? { buyer_address: payload.buyer_address } : {}),
      ...(payload.buyer_city ? { buyer_city: payload.buyer_city } : {}),
      ...(payload.buyer_country ? { buyer_country: payload.buyer_country } : {}),
      ...(payload.buyer_vat_id ? { buyer_vat_id: payload.buyer_vat_id } : {}),
      ...(payload.buyer_email ? { buyer_email: payload.buyer_email } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
      line_items: items,
      status: 'draft',
    };
  }
  if (type === 'create_document') {
    return {
      doc_type: payload.doc_type,
      partner_name: payload.partner_name,
      ...(payload.valid_until ? { valid_until: payload.valid_until } : {}),
      ...(payload.payment_terms_days !== undefined ? { payment_terms_days: payload.payment_terms_days } : {}),
      ...(payload.reference ? { reference: payload.reference } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
      items: payload.items || payload.line_items || [],
    };
  }
  if (type === 'create_customer') {
    const { line_items, items, ...rest } = payload;
    return rest;
  }
  return null;
}

// Anthropic-Tool-Definitionen (Lese- + Schreib-Tools) für den Request.
export function buildToolDefinitions() {
  const defs = [];
  for (const [name, t] of Object.entries(READ_TOOLS)) {
    defs.push({ name, description: t.description, input_schema: t.input_schema });
  }
  for (const [name, t] of Object.entries(WRITE_TOOLS)) {
    defs.push({ name, description: t.description, input_schema: t.input_schema });
  }
  return defs;
}

export function buildSystemPrompt(org) {
  const today = new Date().toISOString().slice(0, 10);
  return `Du bist der eingebaute ERP-Berater von invoiq, einer deutschen E-Rechnungs- und ERP-Plattform (EN 16931, XRechnung, ZUGFeRD, Peppol, GoBD).

Kontext: Organisation „${org.name || 'unbenannt'}", Plan ${org.plan || 'free'}, heutiges Datum ${today}. Alle Beträge in EUR, Antworten auf Deutsch.

Deine Rolle:
- Beantworte Fragen zu Rechnungen, Belegen, Kunden, Kennzahlen und Cash-Flow — nutze dafür die Lese-Tools statt zu raten.
- Setze natürliche Sprache in Aktionen um: für „Erstelle Rechnung für X über Y" nutze propose_invoice. Prüfe vorher per list_customers, ob der Kunde existiert, und übernimm dessen Stammdaten (Adresse, USt-IdNr.). Nutze list_items für Preise, wenn Artikel erwähnt werden.
- Schreibaktionen werden dem Nutzer nur VORGESCHLAGEN — er bestätigt sie in der Oberfläche. Sage nie, du hättest etwas erstellt; sage, dass der Vorschlag zur Bestätigung bereitliegt.
- Steuerlogik: S19 Standard, S7 ermäßigt, RC bei §13b-Leistungen an Unternehmer, IG bei EU-Lieferungen mit USt-IdNr., E0 steuerfrei. Weise auf fehlende USt-IdNr. bei IG hin.
- Bei betriebswirtschaftlichen Fragen (Liquidität, offene Posten, Anomalien) argumentiere mit den Zahlen aus den Tools und gib konkrete, priorisierte Empfehlungen.
- Antworte kompakt und fachlich; keine erfundenen Daten, keine Rechtsberatung (verweise bei komplexen Steuerfragen auf den Steuerberater).`;
}
