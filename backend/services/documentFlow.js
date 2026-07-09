// services/documentFlow.js — Belegarten, Statuslogik und Konvertierungsregeln
// des SAP-nahen Belegflusses. Pure Funktionen — unit-testbar ohne DB.

export const DOC_TYPES = ['request', 'quote', 'order', 'delivery'];

export const DOC_TYPE_LABELS = {
  request:  'Anfrage',
  quote:    'Angebot',
  order:    'Auftrag',
  delivery: 'Lieferung',
  invoice:  'Rechnung',
};

export const DOC_NUMBER_PREFIX = {
  request: 'ANF', quote: 'ANG', order: 'AUF', delivery: 'LIE',
};

// Zulässige Status je Belegart
export const DOC_STATUS = {
  request:  ['offen', 'beantwortet', 'abgelehnt', 'storniert'],
  quote:    ['entwurf', 'gesendet', 'angenommen', 'abgelehnt', 'abgelaufen', 'storniert'],
  order:    ['offen', 'bestaetigt', 'geliefert', 'fakturiert', 'storniert'],
  delivery: ['offen', 'geliefert', 'fakturiert', 'storniert'],
};

export const INITIAL_STATUS = {
  request: 'offen', quote: 'entwurf', order: 'offen', delivery: 'offen',
};

// Manuell auslösbare Statusübergänge (Konvertierungen setzen Status separat)
export const TRANSITIONS = {
  request: {
    offen:       ['beantwortet', 'abgelehnt', 'storniert'],
    beantwortet: ['storniert'],
    abgelehnt:   [],
    storniert:   [],
  },
  quote: {
    entwurf:    ['gesendet', 'storniert'],
    gesendet:   ['angenommen', 'abgelehnt', 'abgelaufen', 'storniert'],
    angenommen: ['storniert'],
    abgelehnt:  [],
    abgelaufen: ['gesendet'],   // erneut versendet (Nachfassen)
    storniert:  [],
  },
  order: {
    offen:      ['bestaetigt', 'storniert'],
    bestaetigt: ['geliefert', 'storniert'],
    geliefert:  ['fakturiert'],
    fakturiert: [],
    storniert:  [],
  },
  delivery: {
    offen:      ['geliefert', 'storniert'],
    geliefert:  ['fakturiert'],
    fakturiert: [],
    storniert:  [],
  },
};

// Konvertierungsregeln: welcher Beleg darf in welchen Folgebeleg?
// (SAP: "Anlegen mit Bezug")
export const CONVERSIONS = {
  request:  ['quote'],
  quote:    ['order'],
  order:    ['delivery', 'invoice'],
  delivery: ['invoice'],
};

// Status der Quelle nach erfolgreicher Konvertierung
export const SOURCE_STATUS_AFTER_CONVERT = {
  'request->quote':    'beantwortet',
  'quote->order':      'angenommen',
  'order->delivery':   'geliefert',
  'order->invoice':    'fakturiert',
  'delivery->invoice': 'fakturiert',
};

// Quellstatus, aus denen eine Konvertierung fachlich zulässig ist
export const CONVERTIBLE_FROM = {
  'request->quote':    ['offen'],
  'quote->order':      ['gesendet', 'angenommen'],
  'order->delivery':   ['offen', 'bestaetigt'],
  'order->invoice':    ['offen', 'bestaetigt', 'geliefert'],
  'delivery->invoice': ['offen', 'geliefert'],
};

export function isValidDocType(t) { return DOC_TYPES.includes(t); }

export function canTransition(docType, from, to) {
  return (TRANSITIONS[docType]?.[from] || []).includes(to);
}

export function canConvert(sourceType, sourceStatus, targetType) {
  if (!(CONVERSIONS[sourceType] || []).includes(targetType)) {
    return { ok: false, reason: `${DOC_TYPE_LABELS[sourceType]} kann nicht in ${DOC_TYPE_LABELS[targetType] || targetType} überführt werden.` };
  }
  const allowed = CONVERTIBLE_FROM[`${sourceType}->${targetType}`] || [];
  if (!allowed.includes(sourceStatus)) {
    return { ok: false, reason: `${DOC_TYPE_LABELS[sourceType]} im Status "${sourceStatus}" kann nicht in ${DOC_TYPE_LABELS[targetType]} überführt werden (zulässig aus: ${allowed.join(', ')}).` };
  }
  return { ok: true };
}
