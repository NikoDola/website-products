import { dispatch, response } from "../../../src/shared/router.mjs";
import { seed } from "../../../src/shared/platform.mjs";
import { secretEqual } from "../../../src/shared/security.mjs";
import { runMonitoring } from "../../../src/shared/monitor.mjs";
import { syncStripe } from "../../../src/shared/stripe.mjs";
export function d1Adapter(binding) {
  return {
    async all(sql, args = []) { return (await binding.prepare(sql).bind(...args).all()).results; },
    async first(sql, args = []) { return binding.prepare(sql).bind(...args).first(); },
    async run(sql, args = []) { const result = await binding.prepare(sql).bind(...args).run(); return { changes: result.meta.changes }; },
    async batch(statements) { return binding.batch(statements.map(({ sql, args = [] }) => binding.prepare(sql).bind(...args))); }
  };
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path !== "/api/webhooks/stripe") {
      if (!env.PLATFORM_API_TOKEN || env.PLATFORM_API_TOKEN.length < 32) return response({ error: "Service is not configured." }, 503);
      if (request.headers.has("origin") || !await secretEqual(request.headers.get("authorization")?.replace(/^Bearer /, ""), env.PLATFORM_API_TOKEN)) return response({ error: "Unauthorized." }, 401);
    }
    const db = d1Adapter(env.DB);
    // Idempotent initial registration, never writes fake health or financial data.
    await seed(db);
    const actor = (request.headers.get("x-platform-actor") || "owner").slice(0, 200);
    return dispatch(request, db, env, actor);
  },
  async scheduled(controller, env) {
    const db = d1Adapter(env.DB); await seed(db);
    try {
      if (controller.cron === "17 * * * *") {
        if (env.STRIPE_SECRET_KEY) await syncStripe(db, env);
      } else await runMonitoring(db, env);
    } catch (error) {
      if (error.status !== 409) throw error;
    }
  }
};
