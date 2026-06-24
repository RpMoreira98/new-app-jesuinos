const prisma = require('../../lib/prisma');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const DEFAULT_CONFIG = {
    startHour: "08:00",
    endHour: "19:00",
    slotDurationMinutes: 60,
    lunchStart: "12:00",
    lunchEnd: "13:00",
    closedDays: [0], // Sunday is closed
  };

  try {
    if (req.method === 'GET') {
      let config = await prisma.businessConfig.findUnique({
        where: { id: 'main' }
      });

      if (!config) {
        // Create default config if missing
        config = await prisma.businessConfig.create({
          data: {
            id: 'main',
            startHour: DEFAULT_CONFIG.startHour,
            endHour: DEFAULT_CONFIG.endHour,
            slotDurationMinutes: DEFAULT_CONFIG.slotDurationMinutes,
            lunchStart: DEFAULT_CONFIG.lunchStart,
            lunchEnd: DEFAULT_CONFIG.lunchEnd,
            closedDays: JSON.stringify(DEFAULT_CONFIG.closedDays)
          }
        });
      }

      // Format response (parse closedDays back to array)
      const formattedConfig = {
        startHour: config.startHour,
        endHour: config.endHour,
        slotDurationMinutes: config.slotDurationMinutes,
        lunchStart: config.lunchStart,
        lunchEnd: config.lunchEnd,
        closedDays: Array.isArray(config.closedDays) ? config.closedDays : JSON.parse(config.closedDays || '[]')
      };

      return res.status(200).json(formattedConfig);
    }

    if (req.method === 'POST') {
      const updates = req.body;

      const current = await prisma.businessConfig.findUnique({
        where: { id: 'main' }
      }) || DEFAULT_CONFIG;

      const updated = {
        ...current,
        ...updates
      };

      const saved = await prisma.businessConfig.upsert({
        where: { id: 'main' },
        update: {
          startHour: updated.startHour,
          endHour: updated.endHour,
          slotDurationMinutes: updated.slotDurationMinutes,
          lunchStart: updated.lunchStart,
          lunchEnd: updated.lunchEnd,
          closedDays: typeof updated.closedDays === 'string' ? updated.closedDays : JSON.stringify(updated.closedDays)
        },
        create: {
          id: 'main',
          startHour: updated.startHour,
          endHour: updated.endHour,
          slotDurationMinutes: updated.slotDurationMinutes,
          lunchStart: updated.lunchStart,
          lunchEnd: updated.lunchEnd,
          closedDays: typeof updated.closedDays === 'string' ? updated.closedDays : JSON.stringify(updated.closedDays)
        }
      });

      const formattedConfig = {
        startHour: saved.startHour,
        endHour: saved.endHour,
        slotDurationMinutes: saved.slotDurationMinutes,
        lunchStart: saved.lunchStart,
        lunchEnd: saved.lunchEnd,
        closedDays: Array.isArray(saved.closedDays) ? saved.closedDays : JSON.parse(saved.closedDays || '[]')
      };

      return res.status(200).json(formattedConfig);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('[API CONFIG ERROR]:', error);
    return res.status(500).json({ error: 'Erro ao obter ou salvar configurações: ' + error.message });
  }
};
