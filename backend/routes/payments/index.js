// routes/payments/index.js — Stripe Integration
// Checkout Sessions, Webhooks, Customer Portal

const PLANS = {
  free:       { price_id: null,                              docs_limit: 10,   name: 'Free'     },
  starter:    { price_id: process.env.STRIPE_PRICE_STARTER,  docs_limit: 100,  name: 'Starter'  },
  business:   { price_id: process.env.STRIPE_PRICE_BUSINESS, docs_limit: 500,  name: 'Business' },
  enterprise: { price_id: process.env.STRIPE_PRICE_ENTERPRISE,docs_limit: 99999,name: 'Enterprise'},
};

export async function paymentRoutes(fastify) {

  // Lazy-load Stripe only if key is set
  const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2024-06-20' });
  };

  // ── GET /payments/plans — public pricing info ──────────────
  fastify.get('/payments/plans', async (req, reply) => {
    return reply.send({
      plans: [
        { id:'free',       name:'Free',       price_monthly:0,   price_yearly:0,   docs_limit:10,   features:['XRechnung Basic','Inbound-Empfang','PDF Download','1 Nutzer'] },
        { id:'starter',    name:'Starter',    price_monthly:29,  price_yearly:25,  docs_limit:100,  features:['Alle Formate','Automatischer Inbound','API Basic','GoBD-Archiv 10J','3 Nutzer'] },
        { id:'business',   name:'Business',   price_monthly:99,  price_yearly:85,  docs_limit:500,  features:['ERP-Integration','Workflow-Automatisierung','Batch-Verarbeitung','10 Nutzer'] },
        { id:'enterprise', name:'Enterprise', price_monthly:299, price_yearly:250, docs_limit:99999,features:['Alles','Multi-Mandanten','Account Manager','SLA','Telefon-Support'] },
      ],
      overage_price: 0.50,
    });
  });

  // ── POST /payments/checkout — create Stripe session ────────
  fastify.post('/payments/checkout', {
    preHandler: async (req, reply) => {
      const auth = req.headers['authorization'];
      if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized' });
    },
  }, async (req, reply) => {
    const { plan, billing = 'monthly' } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return reply.code(400).send({ error: 'Ungültiger Plan' });
    }
    if (plan === 'free') {
      return reply.code(400).send({ error: 'Free Plan benötigt kein Checkout' });
    }

    const stripe = getStripe();
    if (!stripe) {
      // Demo mode — return mock URL
      return reply.send({
        demo: true,
        message: 'Stripe nicht konfiguriert. Setze STRIPE_SECRET_KEY in Railway.',
        checkout_url: `https://invoiq.io/demo-checkout?plan=${plan}&billing=${billing}`,
      });
    }

    const priceId = billing === 'yearly'
      ? process.env[`STRIPE_PRICE_${plan.toUpperCase()}_YEARLY`]
      : process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];

    if (!priceId) {
      return reply.code(400).send({ error: `Kein Stripe Price ID für ${plan} (${billing}) konfiguriert` });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card', 'sepa_debit'],
        locale: 'de',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL || 'https://invoiq.io'}?checkout=success&plan=${plan}`,
        cancel_url:  `${process.env.FRONTEND_URL || 'https://invoiq.io'}?checkout=cancelled`,
        metadata: { plan, billing },
        subscription_data: {
          metadata: { plan, billing },
          trial_period_days: 14,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true }, // USt-IdNr für B2B
        customer_update: { address: 'auto' },
        automatic_tax: { enabled: true },
      });

      return reply.send({ checkout_url: session.url, session_id: session.id });

    } catch (err) {
      fastify.log.error(err, 'Stripe checkout error');
      return reply.code(500).send({ error: 'Checkout konnte nicht erstellt werden' });
    }
  });

  // ── POST /payments/portal — customer billing portal ────────
  fastify.post('/payments/portal', {
    preHandler: async (req, reply) => {
      const auth = req.headers['authorization'];
      if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized' });
    },
  }, async (req, reply) => {
    const stripe = getStripe();
    if (!stripe) {
      return reply.send({ demo: true, portal_url: 'https://billing.stripe.com/demo' });
    }

    const { customer_id } = req.body || {};
    if (!customer_id) return reply.code(400).send({ error: 'customer_id fehlt' });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customer_id,
        return_url: `${process.env.FRONTEND_URL || 'https://invoiq.io'}/settings`,
      });
      return reply.send({ portal_url: session.url });
    } catch (err) {
      return reply.code(500).send({ error: 'Portal konnte nicht geöffnet werden' });
    }
  });

  // ── POST /payments/webhook — Stripe event handler ──────────
  fastify.post('/payments/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const stripe = getStripe();
    if (!stripe) return reply.send({ received: true });

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      fastify.log.error(err, 'Webhook signature failed');
      return reply.code(400).send({ error: 'Webhook signature verification failed' });
    }

    fastify.log.info({ type: event.type }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const plan = session.metadata?.plan;
        const customerId = session.customer;
        fastify.log.info({ plan, customerId }, 'Checkout completed');
        // TODO: Update org.plan in DB, send welcome email
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        fastify.log.info({ status: sub.status }, 'Subscription updated');
        break;
      }
      case 'customer.subscription.deleted': {
        fastify.log.info('Subscription cancelled');
        // TODO: Downgrade org to free plan
        break;
      }
      case 'invoice.payment_failed': {
        fastify.log.warn('Payment failed — send dunning email');
        break;
      }
    }

    return reply.send({ received: true });
  });
}
