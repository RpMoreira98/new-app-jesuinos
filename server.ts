import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/server/storage.js"; // note: use .js or normal import without extension, both work in tsx/esbuild
import { BookingStatus } from "./src/types";
import authRouter from "./src/routes/auth";

// Helper function to check if a booking is in the past
function isTimeInPast(dateStr: string, timeStr: string, sysTime?: Date): boolean {
  const now = sysTime || new Date();
  
  // Format today's date in local server profile YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  
  const bookingDateTime = new Date(year, month - 1, day, hour, min, 0);
  return bookingDateTime.getTime() < now.getTime();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API Routes
  app.use("/api/auth", authRouter);
  
  // Get database health status (SQLITE confirmation)
  app.get("/api/db-health", async (req, res) => {
    try {
      if (typeof (db as any).getHealthInfo === 'function') {
        res.json(await (db as any).getHealthInfo());
      } else {
        res.status(501).json({ error: "Endpoint diagnostics not supported." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao obter status do banco de dados.", details: err.message });
    }
  });

  // Get active business config
  app.get("/api/config", async (req, res) => {
    try {
      const config = await db.getConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao obter configurações." });
    }
  });

  // Update business config
  app.post("/api/config", async (req, res) => {
    try {
      const currentConfig = await db.getConfig();
      const updated = await db.updateConfig({
        ...currentConfig,
        ...req.body
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: "Erro ao atualizar configurações." });
    }
  });

  // Get all bookings
  app.get(["/api/bookings", "/api/agendamentos"], async (req, res) => {
    try {
      const bookings = await db.getBookings();
      res.json(bookings);
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao obter agendamentos." });
    }
  });

  // Create a new booking
  app.post(["/api/bookings", "/api/agendamentos"], async (req, res) => {
    try {
      const { clientName, clientEmail, clientPhone, date, time } = req.body;

      if (!clientName || !clientEmail || !clientPhone || !date || !time) {
        return res.status(400).json({ error: "Todos os campos do cliente e do agendamento são obrigatórios." });
      }

      // 1. Enforce past dates block
      // Note: we can parse server current time or let client validate, but let's secure on the server.
      const currentServerTime = new Date();
      if (isTimeInPast(date, time, currentServerTime)) {
        return res.status(400).json({ error: "Não é possível realizar agendamentos em datas ou horários passados." });
      }

      // 2. Business hours check
      const config = await db.getConfig();
      const dateObj = new Date(date + "T00:00:00");
      const weekday = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

      if (config.closedDays.includes(weekday)) {
        return res.status(400).json({ error: "A barbearia está fechada neste dia da semana." });
      }

      // Check slot falls inside start/end hours
      const [sh, sm] = config.startHour.split(':').map(Number);
      const [eh, em] = config.endHour.split(':').map(Number);
      const [th, tm] = time.split(':').map(Number);

      const startVal = sh * 60 + sm;
      const endVal = eh * 60 + em;
      const timeVal = th * 60 + tm;

      if (timeVal < startVal || timeVal >= endVal) {
        return res.status(400).json({ error: "O horário selecionado está fora do expediente da barbearia." });
      }

      // Check lunch break
      if (config.lunchStart && config.lunchEnd) {
        const [lsh, lsm] = config.lunchStart.split(':').map(Number);
        const [leh, lem] = config.lunchEnd.split(':').map(Number);
        const lunchStartVal = lsh * 60 + lsm;
        const lunchEndVal = leh * 60 + lem;

        if (timeVal >= lunchStartVal && timeVal < lunchEndVal) {
          return res.status(400).json({ error: "O horário selecionado coincide com o intervalo de almoço do barbeiro." });
        }
      }

      // 3. Prevent duplicate bookings / conflicts
      const existingBookings = await db.getBookings();
      const conflict = existingBookings.find(
        (b) => b.date === date && b.time === time && (b.status === "approved" || b.status === "pending")
      );

      if (conflict) {
        return res.status(400).json({ error: "Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário livre." });
      }

      // If all passed, save with "pending" (Pendente de confirmação)
      const newBooking = await db.createBooking({
        clientName,
        clientEmail,
        clientPhone,
        date,
        time,
        status: "pending",
      });

      res.status(201).json(newBooking);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Erro interno do servidor ao criar agendamento." });
    }
  });

  // Update a booking (status, time, date)
  app.patch(["/api/bookings/:id", "/api/agendamentos/:id"], async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const booking = await db.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      // If updating date or time, check for conflicts
      if (updates.date || updates.time) {
        const targetDate = updates.date || booking.date;
        const targetTime = updates.time || booking.time;

        const currentServerTime = new Date();
        if (isTimeInPast(targetDate, targetTime, currentServerTime)) {
          return res.status(400).json({ error: "Não é possível alterar para uma data ou horário passado." });
        }

        const existingBookings = await db.getBookings();
        const conflict = existingBookings.find(
          (b) => b.id !== id && b.date === targetDate && b.time === targetTime && (b.status === "approved" || b.status === "pending")
        );

        if (conflict) {
          return res.status(400).json({ error: "Este horário possui conflito com outra reserva ativa." });
        }
      }

      const updatedBooking = await db.updateBooking(id, updates);
      res.json(updatedBooking);
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao atualizar agendamento." });
    }
  });

  // Delete a booking
  app.delete(["/api/bookings/:id", "/api/agendamentos/:id"], async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db.deleteBooking(id);
      if (deleted) {
        res.json({ success: true, message: "Agendamento deletado." });
      } else {
        res.status(404).json({ error: "Agendamento não encontrado." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao deletar agendamento." });
    }
  });

  // Vite Integration for Serving Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
