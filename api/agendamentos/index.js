// Importa o PrismaClient diretamente para garantir que não haja quebra de caminhos relativos na Vercel
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === "GET") {
      const agendamentos = await prisma.agendamento.findMany({
        orderBy: [{ date: "asc" }, { time: "asc" }],
      });
      return res.status(200).json(agendamentos);
    }

    if (req.method === "POST") {
      const { clientName, clientEmail, clientPhone, date, time } = req.body;

      if (!clientName || !clientEmail || !clientPhone || !date || !time) {
        return res.status(400).json({
          error:
            "Preencha todos os campos obrigatórios (nome, email, telefone, data e horário).",
        });
      }

      // Check for conflict
      const conflict = await prisma.agendamento.findFirst({
        where: {
          date: date,
          time: time,
          status: {
            in: ["approved", "pending"],
          },
        },
      });

      if (conflict) {
        return res.status(409).json({
          error: "Este horário já está reservado. Por favor, escolha outro.",
        });
      }

      const id = `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newBooking = await prisma.agendamento.create({
        data: {
          id,
          clientName,
          clientEmail,
          clientPhone,
          date,
          time,
          status: "pending",
          createdAt: new Date(),
        },
      });

      return res.status(201).json(newBooking);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error("[API ERROR]:", error);
    return res.status(500).json({
      error: "Erro interno no servidor de agendamentos: " + error.message,
    });
  }
};
