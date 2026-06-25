import { db } from "../../src/server/storage.js";

export default async function handler(req, res) {
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
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const bookings = await db.getBookings();
      return res.status(200).json(bookings);
    }

    if (req.method === "POST") {
      const { clientName, clientEmail, clientPhone, date, time } = req.body;
      if (!clientName || !clientEmail || !clientPhone || !date || !time) {
        return res
          .status(400)
          .json({ error: "Preencha todos os campos obrigatórios." });
      }

      const newBooking = await db.createBooking({
        clientName,
        clientEmail,
        clientPhone,
        date,
        time,
        status: "pending",
      });

      return res.status(201).json(newBooking);
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error("[API ERROR]:", error);
    return res.status(500).json({ error: "Erro interno: " + error.message });
  }
}
