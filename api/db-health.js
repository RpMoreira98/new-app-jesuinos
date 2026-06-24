const prisma = require('../lib/prisma');

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

  try {
    const configCount = await prisma.businessConfig.count();
    const bookingsCount = await prisma.agendamento.count();

    return res.status(200).json({
      status: "healthy",
      engine: "postgresql",
      stats: {
        configCount,
        bookingsCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "unhealthy",
      engine: "postgresql-failing",
      error: error.message
    });
  }
};
