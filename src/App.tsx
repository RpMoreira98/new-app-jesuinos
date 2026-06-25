import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scissors,
  Lock,
  User,
  Calendar,
  Clock,
  Check,
  X,
  ChevronRight,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Settings,
  Sliders,
  ListFilter,
  AlertCircle,
  Phone,
  Info,
  Eye,
  Power,
  Database,
} from "lucide-react";
import { Booking, BusinessConfig, Client, BookingStatus } from "./types";
import Header from "./components/Header";
import BookingForm from "./components/BookingForm";
import {
  formatDateWithDayName,
  formatPortugueseDate,
  isSlotAndDateInPast,
} from "./utils";

export default function App() {
  // Navigation & User views
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<"queue" | "settings">("queue");

  // Administrative Authentication
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(
    () => {
      return localStorage.getItem("jesuinos_admin_logged") === "true";
    },
  );
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [intendedTab, setIntendedTab] = useState<"queue" | "settings">("queue");

  // Storage & state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [config, setConfig] = useState<BusinessConfig>({
    startHour: "08:00",
    endHour: "19:00",
    slotDurationMinutes: 60,
    lunchStart: "12:00",
    lunchEnd: "13:00",
    closedDays: [0], // Sundays
  });

  const [currentUser, setCurrentUser] = useState<Client | null>(null);

  // Loading & Action states
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successToast, setSuccessToast] = useState<string>("");
  const [dbHealth, setDbHealth] = useState<any>(null);

  // Admin Config form state
  const [cfgStart, setCfgStart] = useState("08:00");
  const [cfgEnd, setCfgEnd] = useState("19:00");
  const [cfgSlot, setCfgSlot] = useState(60);
  const [cfgLunchStart, setCfgLunchStart] = useState("12:00");
  const [cfgLunchEnd, setCfgLunchEnd] = useState("13:00");
  const [cfgClosedSundays, setCfgClosedSundays] = useState(true);

  // Rescheduling active dialog state
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleError, setRescheduleError] = useState<string>("");

  // Auto notification state for newly incoming bookings for the Barber
  const [lastViewedCount, setLastViewedCount] = useState<number>(0);
  const [newBookingAlerts, setNewBookingAlerts] = useState<Booking[]>([]);

  // Initialize and load persistent user and restore JWT session if active
  useEffect(() => {
    const token = localStorage.getItem("jesuinos_jwt_token");
    if (token) {
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            localStorage.removeItem("jesuinos_jwt_token");
            localStorage.removeItem("jesuinos_admin_logged");
            setIsAdminAuthenticated(false);
            setIsAdmin(false);
            throw new Error("Sessão JWT expirada");
          }
        })
        .then((data) => {
          const emailVal = data.user.email;
          const isAdminUser =
            emailVal === "admin@jesuinosbarbearia.com.br" ||
            emailVal === "rodrigopontes126@gmail.com";
          if (isAdminUser) {
            setIsAdminAuthenticated(true);
            localStorage.setItem("jesuinos_admin_logged", "true");
            setIsAdmin(true);
          } else {
            const clientObj: Client = {
              name: data.user.name,
              email: data.user.email,
              phone: "",
            };
            setCurrentUser(clientObj);
            localStorage.setItem("jesuinos_client", JSON.stringify(clientObj));
          }
        })
        .catch((err) => {
          console.log("Restauração de sessão JWT falhou:", err.message);
        });
    }

    const savedUser = localStorage.getItem("jesuinos_client");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error reading saved user");
      }
    }

    // Initial fetch
    fetchConfig();
    fetchBookings();
    fetchDbHealth();

    // Read previous viewed count for alert indicators
    const lastCount = localStorage.getItem("jesuinos_last_count_viewed");
    if (lastCount) {
      setLastViewedCount(parseInt(lastCount, 10));
    }
  }, []);

  // Poll server for new requests in real time to avoid conflicts and show barber notifications
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookingsSilent();
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [bookings.length, lastViewedCount]);

  const fetchDbHealth = async () => {
    try {
      const res = await fetch("/api/db-health");
      if (res.ok) {
        const data = await res.json();
        setDbHealth(data);
      }
    } catch (e) {
      console.error("Error loading db health", e);
    }
  };

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Sync config state values
        setCfgStart(data.startHour);
        setCfgEnd(data.endHour);
        setCfgSlot(data.slotDurationMinutes);
        setCfgLunchStart(data.lunchStart || "");
        setCfgLunchEnd(data.lunchEnd || "");
        setCfgClosedSundays(data.closedDays.includes(0));
      }
    } catch (e) {
      console.error("Error loading config", e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/agendamentos");
      if (res.ok) {
        const data = await res.json();
        // Sort bookings by date and time ascending
        const sorted = data.sort((a: Booking, b: Booking) => {
          const keyA = `${a.date}T${a.time}`;
          const keyB = `${b.date}T${b.time}`;
          return keyA.localeCompare(keyB);
        });
        setBookings(sorted);

        // Detect if there are bookings the admin hasn't seen
        if (isAdmin) {
          localStorage.setItem(
            "jesuinos_last_count_viewed",
            sorted.length.toString(),
          );
          setLastViewedCount(sorted.length);
        } else {
          // If we are on client view and any new pending arrived since last seen
          const pendings = sorted.filter(
            (b: Booking) => b.status === "pending",
          );
          const lastViewed = parseInt(
            localStorage.getItem("jesuinos_last_count_viewed") || "0",
            10,
          );
          if (sorted.length > lastViewed) {
            const newRequests = sorted.slice(lastViewed);
            setNewBookingAlerts(
              newRequests.filter((b: Booking) => b.status === "pending"),
            );
          }
        }
      }
    } catch (e) {
      console.error("Error loading bookings", e);
    } finally {
      setLoadingBookings(false);
      fetchDbHealth();
    }
  };

  const fetchBookingsSilent = async () => {
    try {
      const res = await fetch("/api/agendamentos");
      if (res.ok) {
        const data = await res.json();
        const sorted = data.sort((a: Booking, b: Booking) => {
          const keyA = `${a.date}T${a.time}`;
          const keyB = `${b.date}T${b.time}`;
          return keyA.localeCompare(keyB);
        });

        // If there is indeed an update
        if (JSON.stringify(sorted) !== JSON.stringify(bookings)) {
          setBookings(sorted);

          if (isAdmin) {
            localStorage.setItem(
              "jesuinos_last_count_viewed",
              sorted.length.toString(),
            );
            setLastViewedCount(sorted.length);
          } else {
            const lastViewed = parseInt(
              localStorage.getItem("jesuinos_last_count_viewed") || "0",
              10,
            );
            if (sorted.length > lastViewed) {
              const freshOnes = sorted
                .slice(lastViewed)
                .filter((b: Booking) => b.status === "pending");
              if (freshOnes.length > 0) {
                setNewBookingAlerts((prev) => [...prev, ...freshOnes]);
              }
            }
          }
        }
      }
    } catch (e) {
      // Slient fail
    }
  };

  const handleAdminModalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Por favor, preencha todos os campos do formulário.");
      return;
    }

    const emailVal = loginEmail.trim().toLowerCase();
    const passwordVal = loginPassword.trim();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(data.error || "Credenciais inválidas.");
        return;
      }

      // Guard JWT Token
      localStorage.setItem("jesuinos_jwt_token", data.token);

      const isAdminUser =
        emailVal === "admin@jesuinosbarbearia.com.br" ||
        emailVal === "rodrigopontes126@gmail.com";

      if (isAdminUser) {
        setIsAdminAuthenticated(true);
        localStorage.setItem("jesuinos_admin_logged", "true");
        setIsAdmin(true);
        setAdminTab(intendedTab);
        setShowLoginModal(false);
        triggerToast(
          `Acesso administrativo concedido via JWT! Bem-vindo, ${data.user.name}.`,
        );
      } else {
        setIsAdmin(false);
        setShowLoginModal(false);

        const clientObj: Client = {
          name: data.user.name,
          email: data.user.email,
          phone: "",
        };

        setCurrentUser(clientObj);
        localStorage.setItem("jesuinos_client", JSON.stringify(clientObj));
        triggerToast(`Identificado via JWT como cliente: ${data.user.name}`);
      }
    } catch (err) {
      console.error(err);
      setLoginError("Erro de conexão ao servidor de autenticação.");
    }
  };

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  // Create booking client side interface API trigger
  const handleCreateBooking = async (
    bookingData: Omit<Booking, "id" | "createdAt" | "status">,
  ): Promise<Booking | null> => {
    try {
      const res = await fetch("/api/agendamentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao realizar agendamento.");
      }

      const resData = await res.json();
      // Reload bookings to update calendars immediately
      await fetchBookings();
      triggerToast("Agendamento criado com sucesso!");
      return resData;
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  // Update Booking Status (Aprovar, Rejeitar, Cancelar)
  const handleUpdateStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error || "Erro ao atualizar agendamento.");
        return;
      }

      await fetchBookings();

      let statusLabel = "";
      if (newStatus === "approved") statusLabel = "aprovado";
      if (newStatus === "rejected") statusLabel = "rejeitado";
      if (newStatus === "cancelled") statusLabel = "cancelado";

      triggerToast(`Agendamento ${statusLabel} com sucesso!`);
    } catch (err) {
      setErrorMessage("Erro ao conectar com o servidor.");
    }
  };

  // Save admin settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const params = {
      startHour: cfgStart,
      endHour: cfgEnd,
      slotDurationMinutes: Number(cfgSlot),
      lunchStart: cfgLunchStart || null,
      lunchEnd: cfgLunchEnd || null,
      closedDays: cfgClosedSundays ? [0] : [],
    };

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error || "Erro ao atualizar expediente.");
        return;
      }

      const updated = await res.json();
      setConfig(updated);
      triggerToast("Expediente atualizado com sucesso!");
      setAdminTab("queue"); // return to schedule queue
    } catch (err) {
      setErrorMessage("Erro de conexão ao salvar configurações.");
    }
  };

  // Reschedule submission
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRescheduleError("");

    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError("Escolha nova data e horário.");
      return;
    }

    try {
      const res = await fetch(`/api/agendamentos/${reschedulingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: rescheduleDate,
          time: rescheduleTime,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setRescheduleError(err.error || "Erro ao alterar horário.");
        return;
      }

      await fetchBookings();
      triggerToast("Horário alterado com sucesso!");
      setReschedulingId(null);
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (err) {
      setRescheduleError("Erro de servidor.");
    }
  };

  // Purge/delete a booking (e.g. for cleaning up dashboard)
  const handleDeleteBooking = async (id: string) => {
    if (
      !window.confirm(
        "Tem certeza de que deseja excluir permanentemente este agendamento?",
      )
    )
      return;
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchBookings();
        triggerToast("Agendamento excluído da base.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper formatting for admin client lists
  const formatPhoneCleanAndLink = (
    phone: string,
    templateOption: "approved" | "cancelled" | "new",
    booking: Booking,
  ) => {
    const cleaned = phone.replace(/\D/g, "");
    let finalPhone = cleaned;
    if (cleaned.length === 11 || cleaned.length === 10) {
      finalPhone = "55" + cleaned;
    }

    let text = "";
    const formattedDate = formatPortugueseDate(booking.date);

    if (templateOption === "approved") {
      text = `Olá ${booking.clientName}, seu horário na Jesuino's foi confirmado para ${formattedDate} às ${booking.time}. Pode comparecer no horário marcado.`;
    } else if (templateOption === "cancelled") {
      text = `Olá ${booking.clientName}, infelizmente precisamos alterar seu horário. Entre em contato conosco para reagendar.`;
    } else {
      text = `Olá ${booking.clientName}, sou o Jesuino. Recebemos seu pedido de agendamento para o dia ${formattedDate} às ${booking.time}. Poderia me falar se prefere fazer barba também?`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
  };

  // Statistics calculation for Dashboard summary widgets
  const getStats = () => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === "pending").length;
    const approved = bookings.filter((b) => b.status === "approved").length;
    const cancelled = bookings.filter(
      (b) => b.status === "cancelled" || b.status === "rejected",
    ).length;
    return { total, pending, approved, cancelled };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0B0B0B] text-neutral-100 flex flex-col font-sans selection:bg-gold-500 selection:text-neutral-950">
      {/* Visual Success Toast alert */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-[100] flex items-center gap-3 bg-neutral-900 border border-gold-500 text-stone-100 px-5 py-3.5 rounded-xl shadow-2xl"
          >
            <div className="h-5 w-5 bg-gold-500/10 border border-gold-500/20 text-gold-500 rounded-full flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <span className="font-display text-xs font-semibold tracking-wide">
              {successToast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Framework Wrap adhering to 'Sleek Interface' with outer bounds */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
        {/* SIDENAV BAR (Width 20, background #070707, elegant gold border highlight) */}
        <aside className="w-full lg:w-20 bg-[#070707] flex lg:flex-col items-center justify-between lg:justify-start py-4 lg:py-8 px-4 lg:px-0 border-b lg:border-b-0 lg:border-r border-[#D4AF37]/20 shrink-0">
          <div className="flex lg:flex-col items-center gap-2 lg:gap-10 w-full lg:w-auto">
            {/* Elegant brand logo */}
            <div
              onClick={() => setIsAdmin(false)}
              onDoubleClick={() => {
                if (!isAdminAuthenticated) {
                  setLoginError("");
                  setLoginEmail("");
                  setLoginPassword("");
                  setIntendedTab("queue");
                  setShowLoginModal(true);
                  triggerToast(
                    "Acesso secreto ativado! Insira suas credenciais.",
                  );
                }
              }}
              className="w-11 h-11 flex items-center justify-center border-2 border-[#D4AF37] rounded-xl bg-neutral-950 cursor-pointer shadow-lg shadow-[#D4AF37]/15 hover:scale-105 active:scale-95 transition-all text-center"
              title="Voltar à tela de agendamento"
            >
              <span className="text-[#D4AF37] font-serif text-xl font-black tracking-tighter">
                J
              </span>
            </div>

            {/* Side icon navigators triggers */}
            <div className="flex lg:flex-col gap-5 sm:gap-8 lg:gap-6 ml-auto lg:ml-0 lg:mt-8">
              {/* Sched link */}
              <button
                onClick={() => {
                  setIsAdmin(false);
                }}
                className={`p-2.5 rounded-lg transition-all relative ${
                  !isAdmin
                    ? "text-[#D4AF37] bg-neutral-900/60 border border-gold-500/30"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
                title="Agendar Corte (Cliente)"
              >
                <Calendar className="w-5 h-5" />
                {!isAdmin && (
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-gold-500 rounded-full"></span>
                )}
              </button>

              {/* Queue link - Only visible if admin is authenticated */}
              {isAdminAuthenticated && (
                <button
                  onClick={() => {
                    setIsAdmin(true);
                    setAdminTab("queue");
                    localStorage.setItem(
                      "jesuinos_last_count_viewed",
                      bookings.length.toString(),
                    );
                    setLastViewedCount(bookings.length);
                  }}
                  className={`p-2.5 rounded-lg transition-all relative ${
                    isAdmin && adminTab === "queue"
                      ? "text-[#D4AF37] bg-neutral-900/60 border border-gold-500/30"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                  title="Fila de Espera (Barbeiro)"
                >
                  <Sliders className="w-5 h-5" />
                  {bookings.filter((b) => b.status === "pending").length >
                    0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-[9px] font-mono text-white px-1.5 rounded-full font-bold">
                      {bookings.filter((b) => b.status === "pending").length}
                    </span>
                  )}
                </button>
              )}

              {/* Config link - Only visible if admin is authenticated */}
              {isAdminAuthenticated && (
                <button
                  onClick={() => {
                    setIsAdmin(true);
                    setAdminTab("settings");
                  }}
                  className={`p-2.5 rounded-lg transition-all relative ${
                    isAdmin && adminTab === "settings"
                      ? "text-[#D4AF37] bg-neutral-900/60 border border-gold-500/30"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                  title="Configurações de Expediente"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Info Trigger */}
          <div className="hidden lg:flex flex-col mt-auto items-center gap-4">
            <div
              className="w-9 h-9 rounded-full bg-[#1A1A1A] text-[#D4AF37] flex items-center justify-center font-bold border border-gold-500/10"
              title="Suporte Jesuino's"
            >
              <span className="text-[11px] font-mono">55</span>
            </div>
          </div>
        </aside>

        {/* MAIN BODY AREA COLUMN */}
        <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
          {/* TOP HEADER adering to 'Sleek Interface' with border #1A1A1A */}
          <header className="min-h-20 bg-[#121212] flex flex-col md:flex-row md:items-center justify-between py-4 px-4 sm:px-8 lg:px-10 border-b border-[#1A1A1A] gap-4">
            <div>
              <h1 className="text-[#D4AF37] font-serif text-lg sm:text-2xl tracking-widest uppercase font-extrabold flex items-center gap-2">
                <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37] shrink-0" />
                Barbearia Jesuino's
              </h1>
              <p className="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-widest font-mono font-medium break-words">
                Experiência Premium de Barbearia • Agendamento Integrado
              </p>
            </div>

            {/* Quick Header toggles */}
            <div className="flex items-center gap-3">
              {isAdminAuthenticated ? (
                isAdmin ? (
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex px-2.5 py-1 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 font-mono tracking-widest uppercase rounded">
                      Admin Jesuino's
                    </span>
                    <button
                      onClick={() => setIsAdmin(false)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-gold-500/30 text-gold-500 text-xs font-medium font-display transition-all cursor-pointer"
                      title="Alternar para visualização de cliente"
                    >
                      Ver Frente Cliente
                    </button>
                    <button
                      onClick={() => {
                        setIsAdminAuthenticated(false);
                        setIsAdmin(false);
                        localStorage.removeItem("jesuinos_admin_logged");
                        triggerToast("Sessão administrativa encerrada!");
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/20 border border-red-500/30 hover:bg-red-900/40 hover:text-white text-red-500 text-xs font-bold font-display transition-all cursor-pointer"
                      title="Encerrar sessão de administrador"
                    >
                      <Power className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsAdmin(true);
                        setAdminTab("queue");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-gold-500/30 text-gold-500 text-xs font-semibold font-display transition-all cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Voltar ao Painel
                    </button>
                    <button
                      onClick={() => {
                        setIsAdminAuthenticated(false);
                        setIsAdmin(false);
                        localStorage.removeItem("jesuinos_admin_logged");
                        triggerToast("Sessão administrativa encerrada!");
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-red-900/40 hover:text-red-500 text-neutral-400 hover:border-red-500/30 text-xs font-medium font-display transition-all cursor-pointer"
                      title="Encerrar sessão de administrador"
                    >
                      Sair
                    </button>
                  </div>
                )
              ) : null}
            </div>
          </header>

          {/* MAIN GRID SPACE */}
          <div className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* MODE 1: CLIENT BOOKING VIEW */}
              {!isAdmin && (
                <motion.div
                  key="client-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Newly Incoming requests alerts directly on dashboard for demonstration or client helper */}
                  {newBookingAlerts.length > 0 && (
                    <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-500/20 space-y-2 text-stone-200 text-xs">
                      <div className="flex items-center gap-2 text-orange-400 font-bold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        Aviso de novos agendamentos em andamento!
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed font-display">
                        Seu agendamento será processado pelo painel da
                        barbearia. Não se preocupe! Há vagas livres para você
                        agendar logo abaixo.
                      </p>
                    </div>
                  )}

                  {/* High Quality Banner Card */}
                  <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-900 p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-yellow-600 via-gold-500 to-amber-700"></div>
                    <div className="space-y-3 max-w-xl text-center md:text-left">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[10px] font-mono text-[#D4AF37] uppercase font-bold tracking-widest">
                        💈 Elegância & Navalha
                      </div>
                      <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-widest font-extrabold uppercase">
                        Viva a Experiência Jesuino's
                      </h2>
                      <p className="font-display text-neutral-400 text-xs sm:text-sm leading-relaxed">
                        Nossa sede está localizada no melhor ponto comercial.
                        Agende seu horário e combine precisão impecável de corte
                        com toalhas aromatizadas quentes e atendimento premium
                        sob medida.
                      </p>
                    </div>

                    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 min-w-[200px] text-center space-y-1 z-10 shrink-0">
                      <p className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase">
                        Contato Direto
                      </p>
                      <p className="text-white text-xs font-bold font-mono">
                        +55 88 8193-3665
                      </p>
                    </div>
                  </div>

                  {/* Main Booking Form Component */}
                  <BookingForm
                    bookings={bookings}
                    config={config}
                    onNewBooking={handleCreateBooking}
                    currentUser={currentUser}
                    onSetCurrentUser={(u) => {
                      setCurrentUser(u);
                    }}
                    isLoadingBookings={loadingBookings}
                    onRefreshBookings={fetchBookings}
                    onAdminLoginSuccess={() => {
                      setIsAdminAuthenticated(true);
                      localStorage.setItem("jesuinos_admin_logged", "true");
                      setIsAdmin(true);
                      setAdminTab("queue");
                      triggerToast(
                        "Acesso administrativo concedido! Bem-vindo, Jesuino.",
                      );
                    }}
                  />
                </motion.div>
              )}

              {/* MODE 2: ADMIN / BARBER CONTROL PANEL (Sleek Interface style) */}
              {isAdmin && (
                <motion.div
                  key="admin-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Top Level Summary Statistics Widgets */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#121212] border border-[#1A1A1A] rounded-2xl p-4 space-y-1.5 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold text-neutral-500 font-mono tracking-wider">
                        Total de Reservas
                      </span>
                      <span className="text-2xl sm:text-3xl font-serif text-[#D4AF37]/90 font-extrabold">
                        {stats.total}
                      </span>
                    </div>

                    <div className="bg-[#121212] border border-[#1A1A1A] rounded-2xl p-4 space-y-1.5 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold text-yellow-500 font-mono tracking-wider">
                        Aguardando
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-serif text-yellow-500 font-extrabold">
                          {stats.pending}
                        </span>
                        {stats.pending > 0 && (
                          <span className="animate-pulse bg-yellow-500 w-2 h-2 rounded-full mb-1"></span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#121212] border border-[#1A1A1A] rounded-2xl p-4 space-y-1.5 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-500 font-mono tracking-wider">
                        Confirmados
                      </span>
                      <span className="text-2xl sm:text-3xl font-serif text-emerald-500 font-extrabold">
                        {stats.approved}
                      </span>
                    </div>

                    <div className="bg-[#121212] border border-[#1A1A1A] rounded-2xl p-4 space-y-1.5 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold text-red-500 font-mono tracking-wider">
                        Cancelados
                      </span>
                      <span className="text-2xl sm:text-3xl font-serif text-red-500 font-extrabold">
                        {stats.cancelled}
                      </span>
                    </div>
                  </div>

                  {/* Rescheduling active inline form */}
                  {reschedulingId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-neutral-950 border border-gold-500/30 rounded-2xl p-5"
                    >
                      <div className="flex justify-between items-center border-b border-neutral-900 pb-3 mb-4">
                        <span className="font-display font-semibold text-xs tracking-wider text-gold-500 uppercase flex items-center gap-1.5">
                          <Sliders className="w-4 h-4" />
                          Remarcar Agendamento para Novo Slot
                        </span>
                        <button
                          onClick={() => setReschedulingId(null)}
                          className="text-neutral-500 hover:text-white font-bold text-xs"
                        >
                          Fechar cancelamento/remarcação
                        </button>
                      </div>

                      <form
                        onSubmit={handleRescheduleSubmit}
                        className="grid sm:grid-cols-3 gap-4 items-end"
                      >
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-500">
                            Nova Data
                          </label>
                          <input
                            type="date"
                            required
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full bg-[#1A1A1A] border border-neutral-800 text-stone-200 rounded-lg p-2.5 text-xs outline-none focus:border-gold-500 font-display"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-500">
                            Novo Horário (HH:MM)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ex 14:30"
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-neutral-800 text-stone-200 rounded-lg p-2.5 text-xs outline-none focus:border-gold-500 font-mono"
                          />
                        </div>

                        <div>
                          <button
                            type="submit"
                            className="w-full bg-[#D4AF37] hover:bg-[#C5A059] text-black font-bold p-2.5 rounded-lg text-xs font-display tracking-widest uppercase cursor-pointer"
                          >
                            Confirmar Alteração
                          </button>
                        </div>
                      </form>

                      {rescheduleError && (
                        <p className="text-red-500 text-xs mt-2 font-mono">
                          {rescheduleError}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* Main Grid: Queue on right, settings or helper on left */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT PANEL COLUMN (Business Hours configuration OR Instruction card) */}
                    <div className="lg:col-span-4 space-y-6">
                      {/* Configuration Card */}
                      <div className="bg-[#121212] rounded-2xl p-6 border border-[#1A1A1A] space-y-4">
                        <div className="border-b border-neutral-900 pb-3 flex items-center justify-between">
                          <div>
                            <h2 className="text-sm font-bold border-l-4 border-[#D4AF37] pl-3 text-white uppercase tracking-wider font-display">
                              Expediente Jesuino's
                            </h2>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Controlador de reservas ativas
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              fetchConfig();
                              triggerToast(
                                "Configurações recarregadas do banco.",
                              );
                            }}
                            className="text-neutral-500 hover:text-neutral-300 font-mono text-[10px] uppercase"
                            title="Recarregar"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <form
                          onSubmit={handleSaveSettings}
                          className="space-y-4 text-xs font-display"
                        >
                          {errorMessage && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] font-mono">
                              {errorMessage}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-mono">
                                Hora Abertura
                              </label>
                              <input
                                type="text"
                                value={cfgStart}
                                onChange={(e) => setCfgStart(e.target.value)}
                                placeholder="08:00"
                                className="w-full bg-[#1A1A1A] border border-neutral-800 text-stone-200 rounded-lg py-2 px-3 outline-none focus:border-[#D4AF37]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-mono">
                                Hora Fechamento
                              </label>
                              <input
                                type="text"
                                value={cfgEnd}
                                onChange={(e) => setCfgEnd(e.target.value)}
                                placeholder="19:00"
                                className="w-full bg-[#1A1A1A] border border-neutral-800 text-stone-200 rounded-lg py-2 px-3 outline-none focus:border-[#D4AF37]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-mono">
                                Início Almoço
                              </label>
                              <input
                                type="text"
                                value={cfgLunchStart}
                                onChange={(e) =>
                                  setCfgLunchStart(e.target.value)
                                }
                                placeholder="12:00"
                                className="w-full bg-[#1A1A1A] border border-neutral-800 text-[#D4AF37] rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D4AF37] font-mono text-[11px]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-mono">
                                Fim Almoço
                              </label>
                              <input
                                type="text"
                                value={cfgLunchEnd}
                                onChange={(e) => setCfgLunchEnd(e.target.value)}
                                placeholder="13:00"
                                className="w-full bg-[#1A1A1A] border border-neutral-800 text-[#D4AF37] rounded-lg py-1.5 px-2.5 outline-none focus:border-[#D4AF37] font-mono text-[11px]"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-500 uppercase tracking-widest block font-mono">
                              Duração do Slot (minutos)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {[30, 45, 60].map((minutes) => (
                                <button
                                  key={minutes}
                                  type="button"
                                  onClick={() => setCfgSlot(minutes)}
                                  className={`w-full rounded-lg py-2 text-[11px] font-mono transition-colors ${
                                    cfgSlot === minutes
                                      ? "bg-[#D4AF37] text-black"
                                      : "bg-[#1A1A1A] border border-neutral-800 text-stone-200 hover:border-[#D4AF37]"
                                  }`}
                                >
                                  {minutes} minutos
                                  {minutes === 60 ? " (1 hora)" : ""}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="border-t border-neutral-950 pt-3 flex items-center justify-between">
                            <span className="text-[11px] text-stone-300 font-display">
                              Fechar aos Domingos?
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfgClosedSundays}
                                onChange={(e) =>
                                  setCfgClosedSundays(e.target.checked)
                                }
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#D4AF37] after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]/20"></div>
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-[#D4AF37] hover:bg-[#C5A059] text-black font-bold py-3 px-4 rounded-xl text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-[#D4AF37]/10 cursor-pointer"
                          >
                            Salvar Alterações
                          </button>
                        </form>
                      </div>

                      {/* Official guidelines Card */}
                      <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 font-mono tracking-wider flex items-center gap-1.5 border-b border-neutral-900 pb-2">
                          <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Central WhatsApp
                        </span>
                        <p className="text-[11px] text-[#A3A3A3] leading-relaxed font-display">
                          O número oficial da Barbearia cadastrado para todos os
                          botões de ação e confirmação de clientes é:
                        </p>
                        <div className="p-3 bg-[#121212] border border-[#1A1A1A] rounded-xl text-center">
                          <span className="text-sm font-bold font-mono text-white">
                            +55 88 8193-3665
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                          O sistema gera mensagens pré-definidas para facilidade
                          de envio instantâneo a cada mudança de status do
                          agendamento.
                        </p>
                      </div>

                      {/* PostgreSQL Database Connection Confirmation Card */}
                      <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-3">
                        <span className="text-[10px] uppercase font-bold text-[#A3A3A3] font-mono tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-2">
                          <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Banco de Dados PostgreSQL (Supabase)
                        </span>

                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">
                              Status do Banco:
                            </span>
                            <span className="flex items-center gap-1 font-mono font-bold text-emerald-500 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Conectado
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500">
                              Tecnologia:
                            </span>
                            <span className="font-mono text-neutral-300 font-bold">
                              {dbHealth?.engine || "postgresql"}
                            </span>
                          </div>

                          <div className="flex flex-col text-[10px] space-y-1 bg-[#121212] border border-neutral-800 p-2.5 rounded-lg">
                            <span className="text-neutral-500 uppercase tracking-widest font-mono text-[8px]">
                              Hospedado em:
                            </span>
                            <span className="font-mono text-xs text-[#D4AF37] break-all select-all">
                              Supabase Cloud PostgreSQL
                            </span>
                          </div>

                          <div className="text-[10px] text-neutral-400 space-y-1">
                            <div className="flex justify-between">
                              <span>Configurações ativas:</span>
                              <strong className="font-mono text-white">
                                {dbHealth?.stats?.configCount ?? 1}
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Total de Registros:</span>
                              <strong className="font-mono text-white">
                                {dbHealth?.stats?.bookingsCount ?? 0}{" "}
                                agendamentos
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-neutral-900 pt-2.5 mt-2">
                          <p className="text-[10px] text-neutral-500 leading-normal">
                            👉 <strong>Supabase + Render:</strong> Este banco de
                            dados armazena os dados de forma persistente e
                            escalável na nuvem do Supabase, conectado de forma
                            segura à hospedagem com alta tolerância a falhas e
                            backups automáticos!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT PANEL COLUMN (Fila de Espera / Daily appointments list) */}
                    <div className="lg:col-span-8 bg-[#121212] rounded-2xl p-6 border border-[#1A1A1A] flex flex-col min-h-[500px]">
                      <div className="flex items-center justify-between border-b border-neutral-900 pb-4 mb-4">
                        <div>
                          <h2 className="text-sm font-bold border-l-4 border-[#D4AF37] pl-3 uppercase tracking-wider text-white">
                            Fila de Agendamento
                          </h2>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Gerenciador de agendamentos solicitados
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={fetchBookings}
                            disabled={loadingBookings}
                            className="p-1 px-2.5 rounded bg-[#1A1A1A] hover:bg-[#202020] border border-neutral-800 text-[10px] text-neutral-400 font-mono flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${loadingBookings ? "animate-spin" : ""}`}
                            />
                            Atualizar
                          </button>
                        </div>
                      </div>

                      {/* Filter stats inline indicators */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 bg-[#0B0B0B] rounded-lg text-[10px] uppercase font-bold text-gray-500 mb-4">
                        <div className="col-span-5 sm:col-span-4">Cliente</div>
                        <div className="col-span-4 sm:col-span-3 text-center">
                          Dia / Horário
                        </div>
                        <div className="col-span-3 sm:col-span-2 text-center">
                          Status
                        </div>
                        <div className="col-span-12 sm:col-span-3 text-right mt-1 sm:mt-0">
                          Ações Gerais / WhatsApp
                        </div>
                      </div>

                      {/* Scrolling list body */}
                      {bookings.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-30 text-center">
                          <Scissors className="w-10 h-10 text-neutral-500 mb-3 animate-bounce" />
                          <p className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">
                            Nenhum agendamento encontrado
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-1 max-w-xs">
                            Aguardando clientes realizarem marcação de horários
                            livre no sistema.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                          {bookings.map((booking) => {
                            const isPending = booking.status === "pending";
                            const isApproved = booking.status === "approved";
                            const isCancelled =
                              booking.status === "cancelled" ||
                              booking.status === "rejected";

                            return (
                              <div
                                key={booking.id}
                                className={`grid grid-cols-12 gap-4 px-4 py-3.5 bg-[#1A1A1A] hover:bg-[#202020] rounded-xl items-center border transition-all ${
                                  isPending
                                    ? "border-yellow-500/10 hover:border-yellow-500/30"
                                    : isApproved
                                      ? "border-emerald-500/10 hover:border-emerald-500/30 opacity-90"
                                      : "border-transparent opacity-50"
                                }`}
                              >
                                {/* Client Info details */}
                                <div className="col-span-12 sm:col-span-4 flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white">
                                      {booking.clientName}
                                    </span>
                                    {isPending && (
                                      <span className="inline-block w-1.5 h-1.5 bg-yellow-500 rounded-full animate-ping"></span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-neutral-400 font-mono tracking-tight mt-0.5 select-all">
                                    {booking.clientPhone}
                                  </span>
                                  <span className="text-[9px] text-neutral-500 select-all truncate">
                                    {booking.clientEmail}
                                  </span>
                                </div>

                                {/* Appointment Day / Time schedule indicator */}
                                <div className="col-span-6 sm:col-span-3 text-center">
                                  <span className="px-2 py-1 bg-black/60 rounded text-[#D4AF37] font-mono text-[11px] border border-gold-500/5 block">
                                    {booking.time}
                                  </span>
                                  <span className="text-[9px] text-neutral-400 block mt-1 font-mono">
                                    {booking.date
                                      ? formatPortugueseDate(booking.date)
                                      : ""}
                                  </span>
                                </div>

                                {/* Current Status badge tracker */}
                                <div className="col-span-6 sm:col-span-2 text-center">
                                  {isPending && (
                                    <span className="text-[9px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Pendente
                                    </span>
                                  )}
                                  {isApproved && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Confirmado
                                    </span>
                                  )}
                                  {isCancelled && (
                                    <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Cancelado
                                    </span>
                                  )}
                                </div>

                                {/* Operational Action tools for Barber */}
                                <div className="col-span-12 sm:col-span-3 flex justify-end items-center gap-2 mt-2 sm:mt-0 pt-2.5 sm:pt-0 border-t border-neutral-800 sm:border-0">
                                  {/* Reschedule Button */}
                                  <button
                                    onClick={() => {
                                      setReschedulingId(booking.id);
                                      setRescheduleDate(booking.date);
                                      setRescheduleTime(booking.time);
                                    }}
                                    className="p-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 rounded hover:text-white hover:bg-neutral-800"
                                    title="Remarcar Horário"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>

                                  {/* 1. Pending specific triggers */}
                                  {isPending && (
                                    <>
                                      <button
                                        onClick={() =>
                                          handleUpdateStatus(
                                            booking.id,
                                            "approved",
                                          )
                                        }
                                        className="p-1.5 bg-emerald-600/10 text-emerald-500 rounded border border-emerald-600/20 hover:bg-emerald-600 hover:text-white transition-colors"
                                        title="Aprovar Agendamento"
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      </button>

                                      <button
                                        onClick={() =>
                                          handleUpdateStatus(
                                            booking.id,
                                            "cancelled",
                                          )
                                        }
                                        className="p-1.5 bg-red-600/10 text-red-500 rounded border border-red-600/20 hover:bg-red-600 hover:text-white transition-colors"
                                        title="Rejeitar Solicitação"
                                      >
                                        <Check className="w-3.5 h-3.5 rotate-45 stroke-[2.5]" />
                                      </button>
                                    </>
                                  )}

                                  {/* 2. WhatsApp Notification instant launcher (Approved & Cancelled rules) */}
                                  {isApproved && (
                                    <a
                                      href={formatPhoneCleanAndLink(
                                        booking.clientPhone,
                                        "approved",
                                        booking,
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                                      title="Avisar confirmação no WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      Confirmar
                                    </a>
                                  )}

                                  {isCancelled && (
                                    <a
                                      href={formatPhoneCleanAndLink(
                                        booking.clientPhone,
                                        "cancelled",
                                        booking,
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold rounded border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center gap-1"
                                      title="Avisar alteração no WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      Reagendar
                                    </a>
                                  )}

                                  {/* Delete option only for confirmed or cancelled bookings to keep records clean */}
                                  {(isApproved || isCancelled) && (
                                    <button
                                      onClick={() =>
                                        handleDeleteBooking(booking.id)
                                      }
                                      className="p-1.5 px-2 bg-red-950/30 hover:bg-red-600 text-red-400 hover:text-white rounded border border-red-500/20 hover:border-red-600 transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                      title="Apagar permanentemente do sistema"
                                    >
                                      <X className="w-3 h-3" />
                                      Apagar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Spacer list footer info */}
                      <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-4 items-center justify-between text-[10px] text-neutral-500 border-t border-neutral-900">
                        <span className="font-mono">
                          Fila de espera ativa:{" "}
                          {
                            bookings.filter((b) => b.status === "pending")
                              .length
                          }{" "}
                          aguardando aprovação
                        </span>
                        <span>
                          Dica: Utilize os botões de WhatsApp para notificar os
                          clientes rapidamente.
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* SYSTEM FOOTER matching Sleek layout */}
          <footer className="min-h-12 py-3 bg-[#070707] px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 border-t border-[#1A1A1A] shrink-0 gap-2 text-center">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 uppercase tracking-widest font-mono text-[9px]">
              <span>
                Status do Sistema:{" "}
                <span className="text-emerald-500 font-bold">Online</span>
              </span>
              <span className="hidden sm:inline">
                WhatsApp Oficial: +55 88 8193-3665
              </span>
            </div>
            <div>
              &copy; {new Date().getFullYear()} Desenvolvido por GSI TECH. Todos
              os direitos reservados.
            </div>
          </footer>
        </main>
      </div>

      {/* CENTRAL SECURITY LOGIN MODAL */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-900 border border-gold-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-[#D4AF37]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-base tracking-widest text-white uppercase font-bold">
                  Autenticação Jesuino's
                </h3>
                <p className="text-[10px] text-neutral-500 font-display">
                  Painel de Controle Barbeiro / Clientes
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAdminModalLogin}
              className="space-y-4 font-display text-left"
            >
              {loginError && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-[11px] text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Ex: adm@exemplo.com"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-gold-500/40 text-neutral-200 placeholder-neutral-700 rounded-lg py-2 px-3 text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite a sua senha de acesso"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-gold-500/40 text-neutral-200 placeholder-neutral-700 rounded-lg py-2 px-3 text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                Fazer Login
                <ChevronRight className="w-4 h-4 text-neutral-950" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
