// premiumUtils.js
const { supabase } = require('./supabaseClient');
const push = require('./pushService');
const { logLine } = require('./paymentLogger');

/**
 * Atualiza premium_expirado (is_premium / premium_until)
 * e renova moedas diárias conforme regra:
 *
 * - PREMIUM ativo:
 *    - 1x por dia: coins += 3 (acumula)
 *
 * - FREE (ou premium expirado):
 *    - 1x por dia: se coins <= 0 -> coins = 1
 *      (não acumula além de 1)
 *
 * Retorna sempre o usuário atualizado.
 */
async function getUserWithNormalizedPremium(userId) {
  // 1) Busca usuário
  const { data: userRaw, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('Erro ao buscar usuário: ' + error.message);
  }

  if (!userRaw) {
    throw new Error('Usuário não encontrado');
  }

  const now = new Date();
  let user = { ...userRaw };

  // 2) Normaliza premium (expira se premium_until já passou)
  const premiumStillValid =
    user.premium_until && new Date(user.premium_until) > now;

  if (!premiumStillValid && user.is_premium) {
    // premium expirou → derruba flag e zera premium_until
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        is_premium: false,
        premium_until: null,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(
        'Erro ao atualizar premium expirado: ' + updateError.message
      );
    }

    user = updated;
  }

  // 3) Normaliza moedas (coins) com base em is_premium e dia atual
  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10); // 'YYYY-MM-DD'

  let coins = user.coins ?? 0;
  const lastRefresh = user.coins_last_refresh
    ? new Date(user.coins_last_refresh)
    : null;
  const lastRefreshStr = lastRefresh
    ? lastRefresh.toISOString().slice(0, 10)
    : null;

  // Se já refrescou hoje, não faz nada
  if (lastRefreshStr === todayStr) {
    return user;
  }

  const isPremiumActive =
    user.is_premium && user.premium_until && new Date(user.premium_until) > now;

  if (isPremiumActive) {
    // PREMIUM: ganha +3 por dia e acumula
    coins = (coins || 0) + 3;
  } else {
    // FREE: só garante 1 moeda se tiver 0 ou menos (sem acumular)
    if (!coins || coins <= 0) {
      coins = 1;
    }
  }

  const { data: updatedUser, error: coinsError } = await supabase
    .from('users')
    .update({
      coins,
      coins_last_refresh: nowIso,
    })
    .eq('id', user.id)
    .select()
    .single();

  if (coinsError) {
    throw new Error(
      'Erro ao atualizar moedas do usuário: ' + coinsError.message
    );
  }

  // coins_refresh_push
  try {
    const before = Number(user.coins ?? 0);
    const after = Number(updatedUser.coins ?? 0);

    if (after !== before) {
      const diff = after - before;
      const payload = push.buildPayload({
        title: 'Moedas diárias liberadas ✨',
        body: diff > 0 ? `Você recebeu +${diff} moedas.` : 'Seu saldo foi atualizado.',
        url: '/',
        tag: 'coins-refresh',
      });

      // Deduplicação por dia: 1 push por usuário/dia
      await push.sendToUser(updatedUser.id, payload, {
        dedupeKind: 'coins_refresh',
        dedupeRef: todayStr,
      });
    }
  } catch (e) {
    logLine('coins_refresh_push_failed', { message: e?.message || String(e) });
  }

  return updatedUser;
}

module.exports = { getUserWithNormalizedPremium };
