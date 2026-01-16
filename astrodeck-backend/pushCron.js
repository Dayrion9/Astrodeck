// pushCron.js
const cron = require('node-cron');
const { supabase } = require('./supabaseClient');
const push = require('./pushService');
const { logLine } = require('./paymentLogger');

function start() {
  const tz = process.env.CRON_TZ || 'America/Sao_Paulo';
  const schedule = process.env.PREMIUM_EXPIRY_CRON || '0 10 * * *'; // todo dia 10:00

  cron.schedule(
    schedule,
    async () => {
      try {
        const now = new Date();
        const from = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const to = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('users')
          .select('id, premium_until, is_premium')
          .eq('is_premium', true)
          .gte('premium_until', from.toISOString())
          .lt('premium_until', to.toISOString());

        if (error) throw error;

        for (const u of data || []) {
          const ref = String(u.premium_until || '').slice(0, 10);
          const payload = push.buildPayload({
            title: 'Seu Premium está para expirar',
            body: 'Faltam ~3 dias. Renove para continuar com acesso completo ✨',
            url: '/premium',
            tag: 'premium-expiry',
          });

          await push.sendToUser(u.id, payload, { dedupeKind: 'premium_expiring', dedupeRef: ref });
        }

        logLine('cron_premium_expiry_done', { count: (data || []).length });
      } catch (e) {
        logLine('cron_premium_expiry_error', { message: e?.message || String(e) });
      }
    },
    { timezone: tz }
  );

  console.log(`[pushCron] ativo. schedule="${schedule}" tz="${tz}"`);
}

module.exports = { start };
