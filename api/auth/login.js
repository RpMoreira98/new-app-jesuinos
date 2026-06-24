const prisma = require('../../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jesuinos_backup_ultra_secure_jwt_secret_token_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Os campos de email e senha são obrigatórios.' });
    }

    // Seed/Upsert default admin users on demand to guarantee access
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Jesuino@AdminSec2026$', 10);
    const rodrigoHash = await bcrypt.hash(process.env.RODRIGO_PASSWORD || 'Rodrigo@SecurePass2026!', 10);

    // Upsert admin user
    await prisma.user.upsert({
      where: { email: 'admin@jesuinosbarbearia.com.br' },
      update: { password: adminHash },
      create: {
        id: 'user-1',
        name: 'Jesuino Admin',
        email: 'admin@jesuinosbarbearia.com.br',
        password: adminHash,
        createdAt: new Date()
      }
    });

    // Upsert rodrigo user
    await prisma.user.upsert({
      where: { email: 'rodrigopontes126@gmail.com' },
      update: { password: rodrigoHash },
      create: {
        id: 'user-2',
        name: 'Rodrigo Pontes (Admin)',
        email: 'rodrigopontes126@gmail.com',
        password: rodrigoHash,
        createdAt: new Date()
      }
    });

    console.log('[PRISMA] Admin users seeded/updated on demand in serverless function');

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      message: 'Autenticação bem-sucedida! Bem-vindo(a).',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('[API LOGIN ERROR]:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login: ' + error.message });
  }
};
