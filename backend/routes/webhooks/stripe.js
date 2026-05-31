// backend/routes/webhooks/stripe.js
// Stripe Webhook Handler für Subscription Events

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function stripeWebhookRoutes(fastify) {
  // ── STRIPE WEBHOOK ENDPOINT ──────────────────────────────────────────
  // WICHTIG: rawBody wird benötigt für Stripe Signature Verification
  fastify.post('/stripe', {
    config: {
      // Fastify rawBody plugin wird benötigt
      rawBody: true,
    },
  }, async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Verify Stripe signature
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      fastify.log.error(`Webhook signature verification failed: ${err.message}`);
      return reply.code(400).send({ error: 'Webhook signature verification failed' });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          fastify.log.info({ sessionId: session.id }, 'Checkout session completed');
          
          // TODO: Create or update organization with subscription
          // const { customer, subscription, metadata } = session;
          // await db.updateOrganization(metadata.org_id, {
          //   stripe_customer_id: customer,
          //   stripe_subscription_id: subscription,
          //   plan: metadata.plan,
          //   plan_doc_limit: getPlanLimit(metadata.plan),
          // });
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          fastify.log.info({ subscriptionId: subscription.id }, 'Subscription updated');
          
          // TODO: Update organization plan
          // const customer = await stripe.customers.retrieve(subscription.customer);
          // const orgId = customer.metadata.org_id;
          // await db.updateOrganization(orgId, {
          //   plan: subscription.items.data[0].price.metadata.plan_name,
          //   plan_status: subscription.status,
          // });
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          fastify.log.info({ subscriptionId: subscription.id }, 'Subscription cancelled');
          
          // TODO: Downgrade to free plan
          // const customer = await stripe.customers.retrieve(subscription.customer);
          // const orgId = customer.metadata.org_id;
          // await db.updateOrganization(orgId, {
          //   plan: 'free',
          //   plan_doc_limit: 10,
          //   plan_status: 'cancelled',
          // });
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          fastify.log.info({ invoiceId: invoice.id }, 'Invoice payment succeeded');
          // TODO: Log payment, send receipt email
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          fastify.log.warn({ invoiceId: invoice.id }, 'Invoice payment failed');
          // TODO: Send payment failure notification
          break;
        }

        default:
          fastify.log.info({ eventType: event.type }, 'Unhandled Stripe event');
      }

      return reply.code(200).send({ received: true });
    } catch (err) {
      fastify.log.error(`Error handling Stripe webhook: ${err.message}`);
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });
}
