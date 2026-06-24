const prisma = require('../../lib/prisma');

module.exports = async function handler(req, res) {
  let id = req.query.id;
  if (!id) {
    // Extract ID from URL if not populated in req.query (e.g. /api/agendamentos/booking-123)
    const urlParts = req.url.split('?')[0].split('/');
    id = urlParts[urlParts.length - 1];
  }

  // Set CORS headers
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

  try {
    if (req.method === 'PATCH') {
      const updates = req.body;
      
      const current = await prisma.agendamento.findUnique({
        where: { id }
      });

      if (!current) {
        return res.status(404).json({ error: 'Agendamento não encontrado.' });
      }

      // Check conflict if changing date/time
      if (updates.date || updates.time) {
        const targetDate = updates.date || current.date;
        const targetTime = updates.time || current.time;

        const conflict = await prisma.agendamento.findFirst({
          where: {
            id: { not: id },
            date: targetDate,
            time: targetTime,
            status: { in: ['approved', 'pending'] }
          }
        });

        if (conflict) {
          return res.status(409).json({ error: 'Este horário já está reservado por outro agendamento.' });
        }
      }

      // Perform update
      const updated = await prisma.agendamento.update({
        where: { id },
        data: {
          clientName: updates.clientName,
          clientEmail: updates.clientEmail,
          clientPhone: updates.clientPhone,
          date: updates.date,
          time: updates.time,
          status: updates.status
        }
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      await prisma.agendamento.delete({
        where: { id }
      });
      return res.status(200).json({ success: true, message: 'Agendamento deletado.' });
    }

    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('[API ERROR]:', error);
    return res.status(500).json({ error: 'Erro ao atualizar/deletar agendamento: ' + error.message });
  }
};
