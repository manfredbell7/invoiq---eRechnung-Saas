// routes/payments/index.js — Stripe Integration
// Checkout Sessions, Webhooks, Customer Portal
//
// Sicherheitsmodell:
// - /payments/checkout und /payments/portal laufen hinter echter JWT-Auth
//   (authMiddleware) — vorher wurde nur geprüft, ob der Header mit "Bearer "
//   beginnt, d.h. jeder konnte Checkout-Sessions erzeugen.
// - /payments/webhook verifiziert die Stripe-Signatur über den ROHEN Body.
//   Fastify parst JSON standardmäßig, daher registriert dieses Plugin einen
//   eigenen Content-Type-Parser (encapsulated, gilt nur für /payments/*),
//   der den Buffer aufhebt und zusätzlich JSON parst.
// - Plan-Updates laufen über org_id aus der Session-Metadata (nicht über
//   stripe_customer_id, das bei Erst-Checkout noch gar nicht gesetzt ist).

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';
import { db } from '../../config/db.js';

export const PLANS = {
  free:       { docs_limit: 10,    name: 'Free'       },
  starter:    { docs_limit: 100,   name: 'Starter'    },
  business:   { docs_limit: 500,   name: 'Business'   },
  enterprise: { docs_limit: 99999, name: 'Enterprise' },
};

export async function paymentRoutes(fastify) {

  // Raw-Body für Stripe-Signaturprüfung aufheben (nur in diesem Plugin-Scope).
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    req.rawBody = body;
    try {
      done(null, body.length ? JSON.parse(body.toString('utf8')) : {});
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Lazy-load Stripe only if key is set (ESM-compatible)
  const getStripe = async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const { default: Stripe } = await import('stripe');
    return new Stripe(key, { apiVersion: '2024-06-20' });
  };

  // ── GET /payments/plans — public pricing info ────────────
  fastify.get('/payments/plans', async (req, reply) => {
    return reply.send({
      plans: [
        { id:'free',       name:'Free',       price_monthly:0,   price_yearly:0,   docs_limit:10,    features:['XRechnung Basic','Inbound-Empfang','PDF Download','1 Nutzer'] },
        { id:'starter',    name:'Starter',    price_monthly:29,  price_yearly:25,  docs_limit:100,   features:['Alle Formate','Automatischer Inbound','API Basic','GoBD-Archiv 10J','3 Nutzer'] },
        { id:'business',   name:'Business',   price_monthly:99,  price_yearly:85,  docs_limit:500,   features:['ERP-Integration','Workflow-Automatisierung','Batch-Verarbeitung','10 Nutzer'] },
        { id:'enterprise', name:'Enterprise', price_monthly:299, price_yearly:250, docs_limit:99999,features:['Alles','Multi-Mandanten','Account Manager','SLA','Telefon-Support'] },
      ],
      overage_price: 0.50,
    });
  });

  // ── POST /payments/checkout — create Stripe session ────────
  fastify.post('/payments/checkout', { preHandler: authMiddleware }, async (req, reply) => {
    const { plan, billing = 'monthly' } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return reply.code(400).send({ error: 'Ungültiger Plan' });
    }
    if (plan === 'free') {
      return reply.code(400).send({ error: 'Free Plan benötigt kein Checkout' });
    }

    const stripe = await getStripe();
    if (!stripe) {
      return reply.code(503).send({
        error: 'Zahlungen sind derzeit nicht verfügbar. Bitte kontaktieren Sie den Support.',
      });
    }

    const priceId = billing === 'yearly'
      ? process.env[`STRIPE_PRICE_${plan.toUpperCase()}_YEARLY`]
      : process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];

    if (!priceId) {
      return reply.code(503).send({ error: `Der Plan "${PLANS[plan].name}" (${billing}) ist derzeit nicht buchbar.` });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card', 'sepa_debit'],
        locale: 'de',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL || 'https://invoiq.de'}?checkout=success&plan=${plan}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://invoiq.de'}?checkout=cancelled`,
        client_reference_id: req.org.id,
        customer: req.org.stripe_customer_id || undefined,
        customer_email: req.org.stripe_customer_id ? undefined : req.user?.email,
        metadata: { org_id: req.org.id, plan, billing },
        subscription_data: {
          metadata: { org_id: req.org.id, plan, billing },
          trial_period_days: 14,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: true },
      });
      return reply.send({ checkout_url: session.url, session_id: session.id });
    } catch (err) {
      fastify.log.error(err, 'Stripe checkout error');
      return reply.code(502).send({ error: 'Checkout konnte nicht erstellt werden. Bitte später erneut versuchen.' });
    }
  });

  // ── POST /payments/portal — customer billing portal ────────
  fastify.post('/payments/portal', { preHandler: authMiddleware }, async (req, reply) => {
    const stripe = await getStripe();
    if (!stripe) {
      return reply.code(503).send({ error: 'Abrechnungsportal derzeit nicht verfügbar.' });
    }
    // customer_id NIE vom Client übernehmen — sonst kann jeder fremde
    // Stripe-Portale öffnen. Immer aus der eigenen Org lesen.
    const customerId = req.org.stripe_customer_id;
    if (!customerId) {
      return reply.code(400).send({ error: 'Kein aktives Abonnement gefunden. Bitte zuerst einen Plan buchen.' });
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL || 'https://invoiq.de'}/settings`,
      });
      return reply.send({ portal_url: session.url });
    } catch (err) {
      fastify.log.error(err, 'Stripe portal error');
      return reply.code(502).send({ error: 'Portal konnte nicht geöffnet werden' });
    }
  });

  // ── POST /payments/webhook — Stripe event handler ────────
  fastify.post('/payments/webhook', async (req, reply) => {
    const stripe = await getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
      fastify.log.warn('Stripe webhook empfangen, aber Stripe ist nicht konfiguriert');
      return reply.code(503).send({ error: 'Stripe nicht konfiguriert' });
    }

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      fastify.log.error(err, 'Webhook signature failed');
      return reply.code(400).send({ error: 'Webhook signature verification failed' });
    }

    fastify.log.info({ type: event.type }, 'Stripe webhook received');

    const applyPlan = async (orgId, plan, patch = {}) => {
      const docsLimit = PLANS[plan]?.docs_limit ?? PLANS.free.docs_limit;
      const { error } = await supabase.from('organizations').update({
        plan,
        plan_doc_limit: docsLimit,
        updated_at: new Date().toISOString(),
        ...patch,
      }).eq('id', orgId);
      if (error) fastify.log.error({ orgId, plan, error: error.message }, 'Plan-Update fehlgeschlagen');
      else await db.createAuditLog({ org_id: orgId, action: 'plan_changed', details: { plan, ...patch } });
    };

    const findOrgByCustomer = async (customerId) => {
      const { data } = await supabase.from('organizations').select('id').eq('stripe_customer_id', customerId).single();
      return data?.id || null;
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.org_id || session.client_reference_id;
        const plan  = session.metadata?.plan;
        if (orgId && plan && PLANS[plan]) {
          await applyPlan(orgId, plan, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          });
        } else {
          fastify.log.error({ orgId, plan }, 'checkout.session.completed ohne org_id/plan Metadata');
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const orgId = sub.metadata?.org_id || await findOrgByCustomer(sub.customer);
        if (!orgId) break;
        const plan = sub.metadata?.plan;
        if (['active', 'trialing'].includes(sub.status) && plan && PLANS[plan]) {
          await applyPlan(orgId, plan, { stripe_subscription_id: sub.id });
        } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
          await applyPlan(orgId, 'free', { stripe_subscription_id: null });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const orgId = sub.metadata?.org_id || await findOrgByCustomer(sub.customer);
        if (orgId) await applyPlan(orgId, 'free', { stripe_subscription_id: null });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const orgId = await findOrgByCustomer(inv.customer);
        if (orgId) await db.createAuditLog({ org_id: orgId, action: 'payment_failed', details: { stripe_invoice: inv.id } });
        fastify.log.warn({ customer: inv.customer }, 'Stripe payment failed');
        break;
      }
    }

    return reply.send({ received: true });
  });
}
