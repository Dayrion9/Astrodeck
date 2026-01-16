// authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase } = require('./supabaseClient');
const { getUserWithNormalizedPremium } = require('./premiumUtils');

const router = express.Router();

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'astrodeck_session';
const COOKIE_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  // Express has res.cookie built-in; no need cookie-parser to set.
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd, // required when sameSite=none
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  });
}

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    is_premium: user.is_premium,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function getTokenFromRequest(req) {
  // Primary: httpOnly cookie
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];

  // Fallback: Authorization header (useful for curl/postman)
  const auth = req.headers.authorization || '';
  const [type, token] = auth.split(' ');
  if (type === 'Bearer' && token) return token;

  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, nome, phone } = req.body;

    if (!email || !password || !username || !nome || !phone) {
      return res.status(400).json({
        error: 'Nome, telefone, email, username e senha são obrigatórios',
      });
    }

        // Normaliza telefone para sempre começar com 55 + dígitos
    const normalizedPhone = String(phone).replace(/\D+/g, '');
    const phoneWith55 = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;

    if (String(nome).trim().length < 2) {
      return res.status(400).json({ error: 'Informe seu nome completo' });
    }

    // 55 + DDD(2) + número (>=8) => mínimo 12 dígitos
    if (phoneWith55.length < 12) {
      return res.status(400).json({ error: 'Informe um telefone válido (55 + DDD + número)' });
    }

if (password.length < 6) {
      return res.status(400).json({
        error: 'A senha deve ter pelo menos 6 caracteres',
      });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`);

    if (checkError) {
      console.error(checkError);
      return res.status(500).json({ error: 'Erro ao verificar usuário' });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email ou username já em uso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        username,
        nome: String(nome).trim(),
        phone: phoneWith55,
        cpf: '76945427056',
        is_premium: false,
        // coins e coins_last_refresh usam defaults da tabela
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }

    const user = await getUserWithNormalizedPremium(insertedUser.id);
    const token = generateToken(user);

    setAuthCookie(res, token);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nome: user.nome ?? null,
        phone: user.phone ?? null,
        is_premium: user.is_premium,
        premium_until: user.premium_until ?? null,
        coins: user.coins ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const { data: dbUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !dbUser) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, dbUser.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = await getUserWithNormalizedPremium(dbUser.id);
    const token = generateToken(user);

    setAuthCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nome: user.nome ?? null,
        phone: user.phone ?? null,
        is_premium: user.is_premium,
        premium_until: user.premium_until ?? null,
        coins: user.coins ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserWithNormalizedPremium(req.user.id);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nome: user.nome ?? null,
        phone: user.phone ?? null,
        is_premium: user.is_premium,
        premium_until: user.premium_until ?? null,
        coins: user.coins ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

module.exports = router;
