// subscriptionRoutes.js
const express = require('express');
const { supabase } = require('./supabaseClient');

const router = express.Router();

/**
 * Endpoint manual de ativação de premium.
 *
 * Body esperado:
 * {
 *   "userId": "uuid-do-supabase",
 *   "days": 30
 * }
 *
 * - Calcula premium_until = agora + days
 * - Marca is_premium = true
 */
router.post('/activate', async (req, res) => {
  try {
    const { userId, days } = req.body;

    if (!userId || !days) {
      return res
        .status(400)
        .json({ error: 'userId e days são obrigatórios' });
    }

    const daysInt = parseInt(days, 10);
    if (Number.isNaN(daysInt) || daysInt <= 0) {
      return res
        .status(400)
        .json({ error: 'days deve ser um número inteiro > 0' });
    }

    const now = new Date();
    const premiumUntil = new Date(
      now.getTime() + daysInt * 24 * 60 * 60 * 1000
    );

    const { data: updated, error } = await supabase
      .from('users')
      .update({
        is_premium: true,
        premium_until: premiumUntil.toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao ativar premium:', error);
      return res.status(500).json({ error: 'Erro ao ativar premium' });
    }

    return res.json({
      message: 'Usuário atualizado para premium',
      user: {
        id: updated.id,
        is_premium: updated.is_premium,
        premium_until: updated.premium_until,
      },
    });
  } catch (err) {
    console.error('Erro em /subscriptions/activate:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
