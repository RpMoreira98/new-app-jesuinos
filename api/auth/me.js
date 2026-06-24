const prisma = require('../../lib/prisma');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jesuinos_backup_ultra_secure_jwt_secret_token_key_2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nenhum cabeçalho ou sinal de autorização detectado.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Assinatura inválida ou tempo de sessão do token expirado.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });

    if (!user) {
      return res.status(401).json({ error: 'O usuário associado a este token não existe no sistema.' });
    }

    return res.status(200).json({
      message: 'Status de autorização com prestígio concedido!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('[API ME ERROR]:', error);
    return res.status(500).json({ error: 'Erro interno ao validar sessão: ' + error.message });
  }
};
