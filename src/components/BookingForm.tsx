import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Check,
  Scissors,
  ChevronRight,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  X,
  Trash2,
  Lock,
} from "lucide-react";
import { Booking, BusinessConfig, Client } from "../types";
import {
  WEEKDAYS_PT,
  WEEKDAYS_SHORT_PT,
  formatDateLong,
  formatDateWithDayName,
  formatPortugueseDate,
  isSlotAndDateInPast,
} from "../utils";

interface BookingFormProps {
  bookings: Booking[];
  config: BusinessConfig;
  onNewBooking: (
    booking: Omit<Booking, "id" | "createdAt" | "status">,
  ) => Promise<Booking | null>;
  currentUser: Client | null;
  onSetCurrentUser: (user: Client | null) => void;
  isLoadingBookings: boolean;
  onRefreshBookings: () => void;
  onAdminLoginSuccess?: () => void;
}

export default function BookingForm({
  bookings,
  config,
  onNewBooking,
  currentUser,
  onSetCurrentUser,
  isLoadingBookings,
  onRefreshBookings,
  onAdminLoginSuccess,
}: BookingFormProps) {
  // Registration Form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [formError, setFormError] = useState("");

  const regEmailVal = regEmail.trim().toLowerCase();
  const isAdminCheck =
    regEmailVal === "admin@jesuinosbarbearia.com.br" ||
    regEmailVal === "rodrigopontes126@gmail.com";

  // Scheduling state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Visual Service selection (adds premium realistic context)
  const [selectedService, setSelectedService] = useState<{
    name: string;
    price: string;
    duration: string;
  }>({
    name: "Corte de Cabelo",
    price: "R$ 25,00",
    duration: "40 min",
  });

  const services = [
    {
      name: "Corte de Cabelo",
      price: "R$ 25,00",
      duration: "40 min",
      desc: "Corte moderno e finalização",
    },
    {
      name: "Corte de Cabelo + Barba",
      price: "R$ 40,00",
      duration: "75 min",
      desc: "Corte de cabelo com finalização + barba com design personalizado",
    },
    {
      name: "Combo Cabelo + Barba + Sobrancelha",
      price: "R$ 50,00",
      duration: "75 min",
      desc: "Corte de cabelo + barbaterapia + sobrancelha na navalha",
    },
    {
      name: "Sobrancelha na Navalha",
      price: "R$ 7,00",
      duration: "15 min",
      desc: "Desenho feito com lâmina de alta precisão",
    },
  ];

  // Success screen state
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Generate 14 selectable days starting from Today (preventing past date selection physically)
  const [dayList, setDayList] = useState<
    { dateStr: string; dayNum: number; label: string; isClosed: boolean }[]
  >([]);

  useEffect(() => {
    const list = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const candidate = new Date();
      candidate.setDate(today.getDate() + i);

      const year = candidate.getFullYear();
      const month = (candidate.getMonth() + 1).toString().padStart(2, "0");
      const day = candidate.getDate().toString().padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const dayNum = candidate.getDay(); // 0-6
      const isClosed = config.closedDays.includes(dayNum);
      const label = WEEKDAYS_SHORT_PT[dayNum];

      list.push({
        dateStr,
        dayNum,
        label,
        isClosed,
      });
    }

    setDayList(list);

    // Default select the first available open day
    const firstOpen = list.find((d) => !d.isClosed);
    if (firstOpen && !selectedDate) {
      setSelectedDate(firstOpen.dateStr);
    }
  }, [config]);

  // Generate time slots list for the selected date
  const generateSlots = (): {
    time: string;
    isAvailable: boolean;
    reason?: string;
  }[] => {
    if (!selectedDate) return [];

    const slots: { time: string; isAvailable: boolean; reason?: string }[] = [];

    const [sh, sm] = config.startHour.split(":").map(Number);
    const [eh, em] = config.endHour.split(":").map(Number);
    const duration = config.slotDurationMinutes;

    let currentMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    // Parse lunch hours
    let lunchSVal = -1;
    let lunchEVal = -1;
    if (config.lunchStart && config.lunchEnd) {
      const [lsh, lsm] = config.lunchStart.split(":").map(Number);
      const [leh, lem] = config.lunchEnd.split(":").map(Number);
      lunchSVal = lsh * 60 + lsm;
      lunchEVal = leh * 60 + lem;
    }

    while (currentMinutes < endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

      // 1. Check if inside lunch break
      const isLunch = currentMinutes >= lunchSVal && currentMinutes < lunchEVal;

      // 2. Check if in the past
      const isPast = isSlotAndDateInPast(selectedDate, timeStr);

      // 3. Check if slot already reserved by an active booking (approved or pending)
      const existing = bookings.find(
        (b) =>
          b.date === selectedDate &&
          b.time === timeStr &&
          (b.status === "approved" || b.status === "pending"),
      );

      let isAvailable = true;
      let reason = "";

      if (isLunch) {
        isAvailable = false;
        reason = "Almoço";
      } else if (isPast) {
        isAvailable = false;
        reason = "Passado";
      } else if (existing) {
        isAvailable = false;
        reason = "Ocupado";
      }

      slots.push({
        time: timeStr,
        isAvailable,
        reason,
      });

      currentMinutes += duration;
    }

    return slots;
  };

  const activeSlots = generateSlots();

  // Handle Client Login Submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const regEmailVal = regEmail.trim().toLowerCase();
    const isAdminEmail =
      regEmailVal === "admin@jesuinosbarbearia.com.br" ||
      regEmailVal === "rodrigopontes126@gmail.com";

    // Check if trying to login as admin
    if (isAdminEmail) {
      if (!adminPasswordInput) {
        setFormError("Por favor, informe a senha de administrador.");
        return;
      }

      // Perform dynamic, real-time secure checking against JWT API
      fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: regEmailVal,
          password: adminPasswordInput,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Senha de administrador incorreta.");
          }

          // Store the returned authentication credentials
          localStorage.setItem("jesuinos_jwt_token", data.token);
          localStorage.setItem("jesuinos_admin_logged", "true");

          // Successful admin login callback
          if (onAdminLoginSuccess) {
            onAdminLoginSuccess();
          }
        })
        .catch((err) => {
          setFormError(err.message || "Erro ao realizar login administrativo.");
        });
      return;
    }

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim()) {
      setFormError("Por favor, preencha todos os campos do formulário.");
      return;
    }

    // Phone format clean checklist
    const numericPhone = regPhone.replace(/\D/g, "");
    if (numericPhone.length < 10) {
      setFormError("Por favor, informe um número de telefone com DDD válido.");
      return;
    }

    const userData: Client = {
      name: regName.trim(),
      email: regEmailVal,
      phone: regPhone.trim(),
    };

    localStorage.setItem("jesuinos_client", JSON.stringify(userData));
    onSetCurrentUser(userData);
  };

  // Handle Book Click
  const handleBookingConfirm = async () => {
    if (!currentUser) return;
    if (!selectedDate) {
      setActionError("Por favor, escolha uma data disponível.");
      return;
    }
    if (!selectedTime) {
      setActionError("Por favor, escolha um horário disponível.");
      return;
    }

    setActionError("");
    setIsSubmitting(true);

    try {
      const response = await onNewBooking({
        clientName: currentUser.name,
        clientEmail: currentUser.email,
        clientPhone: currentUser.phone,
        date: selectedDate,
        time: selectedTime,
      });

      if (response) {
        setCreatedBooking(response);
        setSelectedTime("");
      } else {
        setActionError(
          "Este horário pode ter sido reservado por outro cliente. Por favor, atualize e tente outro.",
        );
      }
    } catch (err: any) {
      setActionError(
        err.message ||
          "Erro ao realizar seu agendamento no servidor. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset WhatsApp Link Generator
  const getWhatsAppLink = (booking: Booking) => {
    const defaultNumber = "558881933665"; // Official Whatsapp: +55 88 8193-3665
    const formattedDate = formatPortugueseDate(booking.date);
    const message = `Olá, meu nome é ${booking.clientName}. Acabei de realizar um agendamento na Jesuino's para o dia ${formattedDate} às ${booking.time} e gostaria de confirmar.`;
    return `https://wa.me/${defaultNumber}?text=${encodeURIComponent(message)}`;
  };

  // Client-side booking cancellation
  const handleClientCancelBooking = async (id: string) => {
    if (
      !window.confirm(
        "Tem certeza de que deseja cancelar o agendamento do seu corte? O horário voltará a ficar vago no calendário.",
      )
    )
      return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        onRefreshBookings();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao cancelar o agendamento.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão ao tentar cancelar.");
    } finally {
      setCancellingId(null);
    }
  };

  // Show Success Card overlay after scheduling
  if (createdBooking) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl bg-neutral-900 border border-gold-500/30 p-8 shadow-2xl text-center flex flex-col items-center"
        >
          <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mb-6">
            <Check className="h-8 w-8 text-emerald-400 stroke-[3]" />
          </div>

          <h2 className="font-serif text-2xl tracking-wider text-white uppercase font-bold mb-2">
            Agendamento Solicitado!
          </h2>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-6">
            <Clock className="w-3.5 h-3.5" />
            Pendente de Confirmação
          </div>

          <div className="w-full bg-neutral-950 rounded-xl border border-neutral-800 p-5 text-left space-y-3 font-display mb-6">
            <div className="flex justify-between border-b border-neutral-900 pb-2.5 text-xs">
              <span className="text-neutral-500">Cliente:</span>
              <span className="text-neutral-200 font-medium">
                {createdBooking.clientName}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-900 pb-2.5 text-xs">
              <span className="text-neutral-500">Serviço:</span>
              <span className="text-gold-500 font-medium">
                {selectedService.name}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-900 pb-2.5 text-xs">
              <span className="text-neutral-500">Data agendada:</span>
              <span className="text-neutral-200 font-medium font-mono">
                {formatPortugueseDate(createdBooking.date)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">Horário reservado:</span>
              <span className="text-neutral-200 font-bold font-mono text-sm text-gold-500">
                {createdBooking.time}
              </span>
            </div>
          </div>

          <p className="text-neutral-400 text-xs leading-relaxed mb-8">
            Para garantir seu horário e segurança, a confirmação do seu
            agendamento ocorrerá via{" "}
            <strong className="text-white">WhatsApp da Barbearia</strong>.
            Clique no botão abaixo para nos enviar os detalhes.
          </p>

          <div className="grid gap-3 w-full">
            <a
              href={getWhatsAppLink(createdBooking)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-300 text-sm tracking-wider uppercase"
            >
              <MessageSquare className="h-5 w-5" />
              Confirmar no WhatsApp
            </a>

            <button
              onClick={() => {
                setCreatedBooking(null);
                onRefreshBookings();
              }}
              className="text-xs text-neutral-400 hover:text-white transition-colors py-3 cursor-pointer"
            >
              Fazer outro agendamento
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5 p-2 sm:p-4 w-full min-w-0">
      {/* LEFT COLUMN: Client Header & Registration form */}
      <div className="lg:col-span-2 space-y-6 w-full min-w-0">
        {/* Welcome Section */}
        <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 sm:p-6 space-y-4">
          <h2 className="font-serif text-xl sm:text-2xl tracking-widest text-white uppercase font-bold">
            Reserve seu Horário
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed font-display">
            Escolha seu serviço, selecione a data ideal no calendário e confira
            as horas livres integradas em tempo real sob segurança máxima de
            agendamento único.
          </p>

          <div className="border-t border-neutral-900 pt-4 flex gap-4 text-xs font-display">
            <div>
              <p className="text-neutral-500">Atendimento</p>
              <p className="text-neutral-300 font-medium font-mono">
                {config.startHour} - {config.endHour}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Expediente</p>
              <p className="text-neutral-300 font-medium">Seg a Sáb</p>
            </div>
          </div>
        </div>

        {/* User login / Change login card */}
        {!currentUser ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5 text-gold-500 text-sm font-semibold tracking-wider uppercase font-display border-b border-neutral-800 pb-3">
              <User className="h-4 w-4" />
              Identifique-se para Agendar
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">
                  E-mail de Contato
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Ex: SeuEmail@email.com"
                    className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-600 rounded-lg py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-gold-500 focus:border-gold-500 focus:outline-none font-display font-medium"
                  />
                </div>
              </div>

              {!isAdminCheck ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ex: Seu nome"
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-600 rounded-lg py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-gold-500 focus:border-gold-500 focus:outline-none font-display font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono tracking-widest uppercase text-neutral-500">
                      WhatsApp Oficial (com DDD)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                        <Phone className="h-4 w-4" />
                      </span>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="Ex: 99 99999-9999"
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-600 rounded-lg py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-gold-500 focus:border-gold-500 focus:outline-none font-display font-medium"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-gold-950/10 border border-gold-500/30 space-y-3">
                  <div className="flex items-center gap-1.5 text-gold-500 text-[11px] font-bold uppercase tracking-wider font-mono">
                    <Lock className="w-4.5 h-4.5" />
                    Autenticação administrativa Jesuino's
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-400">
                      Senha do Administrador
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="Digite a senha administrativa segura"
                      className="w-full bg-neutral-950 border border-gold-500/40 text-[#D4AF37] placeholder-neutral-700 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-gold-500 font-mono tracking-widest"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                {isAdminCheck
                  ? "Acessar Painel do Barbeiro"
                  : "Salvar Conta & Continuar"}
                <ChevronRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-neutral-900/40 border border-neutral-800 p-5 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between text-[11px] font-mono tracking-widest uppercase text-neutral-500">
                <span>Cliente Logado</span>
                <button
                  onClick={() => {
                    localStorage.removeItem("jesuinos_client");
                    onSetCurrentUser(null);
                  }}
                  className="text-gold-500 hover:text-gold-400 uppercase cursor-pointer"
                >
                  Alterar dados
                </button>
              </div>
              <div className="flex flex-col gap-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 font-display">
                <span className="font-bold text-neutral-200 text-sm">
                  {currentUser.name}
                </span>
                <span className="text-neutral-400 font-mono text-[11px]">
                  {currentUser.phone}
                </span>
                <span className="text-neutral-500 font-mono text-[11px]">
                  {currentUser.email}
                </span>
              </div>
            </motion.div>

            {/* Client active/past bookings history with Cancellation trigger */}
            <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 sm:p-5 space-y-3">
              <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400 block border-b border-neutral-800 pb-2">
                Seus Agendamentos de Corte
              </span>
              {bookings.filter(
                (b) =>
                  b.clientEmail &&
                  b.clientEmail.trim().toLowerCase() ===
                    currentUser.email.trim().toLowerCase(),
              ).length === 0 ? (
                <p className="text-[11px] text-neutral-500 py-2.5 text-center leading-relaxed">
                  Nenhum agendamento realizado ainda neste email.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[225px] overflow-y-auto pr-1">
                  {bookings
                    .filter(
                      (b) =>
                        b.clientEmail &&
                        b.clientEmail.trim().toLowerCase() ===
                          currentUser.email.trim().toLowerCase(),
                    )
                    .map((bk) => {
                      const isPending = bk.status === "pending";
                      const isApproved = bk.status === "approved";
                      const isCancelled =
                        bk.status === "cancelled" || bk.status === "rejected";

                      return (
                        <div
                          key={bk.id}
                          className={`p-3 rounded-xl border bg-neutral-950/60 flex items-center justify-between gap-2.5 transition-all ${
                            isCancelled
                              ? "border-neutral-950 opacity-60"
                              : "border-neutral-800 hover:border-neutral-700"
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-neutral-200">
                                {bk.time}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {formatPortugueseDate(bk.date)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isPending && (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse shrink-0"></span>
                              )}
                              {isApproved && (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              )}
                              <span className="text-[10px] text-neutral-400 font-display truncate">
                                Status:{" "}
                                {isPending
                                  ? "Aguardando confirmação"
                                  : isApproved
                                    ? "Confirmado ✓"
                                    : "Cancelado ✗"}
                              </span>
                            </div>
                          </div>

                          {/* Client Cancel Action */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleClientCancelBooking(bk.id)}
                              disabled={cancellingId === bk.id}
                              className="p-1 px-2.5 bg-red-950/25 hover:bg-white hover:text-red-600 hover:font-bold hover:scale-105 text-red-400 border border-red-500/10 text-[9px] font-medium uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 shrink-0"
                              title="Cancelar Agendamento"
                            >
                              {cancellingId === bk.id ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <X className="w-2.5 h-2.5" />
                              )}
                              Cancelar
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visual Service Selection list (Adds immense premium texture to the form) */}
        {currentUser && (
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 sm:p-5 space-y-3">
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400 block border-b border-neutral-800 pb-2">
              Selecione o Serviço Desejado
            </span>
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
              {services.map((serv) => (
                <div
                  key={serv.name}
                  onClick={() => setSelectedService(serv)}
                  className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                    selectedService.name === serv.name
                      ? "bg-neutral-950 border-gold-500/50"
                      : "bg-neutral-950/40 border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/20"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`font-display text-xs font-bold ${
                        selectedService.name === serv.name
                          ? "text-gold-500"
                          : "text-neutral-200"
                      }`}
                    >
                      {serv.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-gold-500 bg-gold-500/10 px-1.5 py-0.5 rounded border border-gold-500/15">
                      {serv.price}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 group-hover:text-neutral-400 transition-colors mt-1 font-display">
                    {serv.desc}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-neutral-500 font-mono">
                    <Clock className="w-3 h-3 text-gold-500/50" />
                    <span>Duração aproximada: {serv.duration}</span>
                  </div>

                  {selectedService.name === serv.name && (
                    <div className="absolute right-2 bottom-2 bg-gold-500 text-neutral-950 h-4 w-4 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Calendar and Real-time slot selector */}
      <div className="lg:col-span-3 space-y-6 w-full min-w-0">
        {/* Quick check header with live updates indicator */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 truncate">
              Vagas atualizadas em tempo real
            </span>
          </div>

          <button
            onClick={onRefreshBookings}
            disabled={isLoadingBookings}
            className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-800 text-[11px] font-sans text-stone-300 rounded-lg hover:border-neutral-700 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoadingBookings ? "animate-spin" : ""}`}
            />
            Carregar Vagas
          </button>
        </div>

        {/* Dynamic horizontal scrollable Day Picker */}
        <div className="space-y-2 w-full min-w-0 overflow-hidden">
          <label className="text-[11px] font-mono tracking-widest uppercase text-neutral-400 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gold-500" />
            1. Escolha o Dia do Corte
          </label>

          <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-thin w-full">
            {dayList.map((day) => (
              <button
                key={day.dateStr}
                disabled={day.isClosed}
                onClick={() => {
                  setSelectedDate(day.dateStr);
                  setSelectedTime("");
                }}
                className={`flex-shrink-0 flex flex-col justify-between items-center w-20 py-3.5 rounded-xl border transition-all duration-300 relative cursor-pointer ${
                  day.isClosed
                    ? "opacity-35 bg-neutral-950/20 border-neutral-950 text-neutral-600 disabled:cursor-not-allowed"
                    : selectedDate === day.dateStr
                      ? "bg-neutral-950 border-gold-500 text-white font-bold ring-1 ring-gold-500/20"
                      : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                }`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider block opacity-70">
                  {day.label}
                </span>

                <span className="text-xl font-serif tracking-tighter block my-1">
                  {day.dateStr.split("-")[2]}
                </span>

                {day.isClosed ? (
                  <span className="text-[9px] bg-red-800/10 border border-red-800/20 text-red-400 rounded px-1 tracking-tighter block mt-0.5 font-bold uppercase">
                    Off
                  </span>
                ) : (
                  <span
                    className={`text-[9px] font-bold rounded px-1.5 uppercase mt-0.5 block ${
                      selectedDate === day.dateStr
                        ? "bg-gold-500/15 text-gold-500"
                        : "bg-neutral-950/60 text-neutral-500"
                    }`}
                  >
                    Disponível
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Hour Slots grid selector */}
        {selectedDate && (
          <div className="space-y-3.5 bg-neutral-950 border border-neutral-900 rounded-2xl p-4 sm:p-6">
            <label className="text-[11px] font-mono tracking-widest uppercase text-neutral-400 flex items-center gap-1.5 border-b border-neutral-900 pb-3">
              <Clock className="h-3.5 w-3.5 text-gold-500" />
              2. Escolha o Horário Livre de {formatDateLong(selectedDate)}
            </label>

            {activeSlots.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3 text-center">
                Nenhum horário gerado para esta data nas configurações de
                expediente.
              </p>
            ) : (
              <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {activeSlots.map((slot) => {
                  const isSelected = selectedTime === slot.time;

                  return (
                    <button
                      key={slot.time}
                      disabled={!slot.isAvailable}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`py-3.5 rounded-xl border text-center font-mono text-xs transition-all duration-300 relative cursor-pointer ${
                        !slot.isAvailable
                          ? "bg-neutral-950 border-neutral-950 text-neutral-600 cursor-not-allowed opacity-35"
                          : isSelected
                            ? "bg-gold-500/10 border-gold-500 text-gold-500 font-bold scale-[1.02]"
                            : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white"
                      }`}
                    >
                      <span className="block font-bold">{slot.time}</span>

                      {!slot.isAvailable && (
                        <span className="text-[9px] opacity-70 block tracking-tight font-medium">
                          {slot.reason === "Ocupado"
                            ? "Reservado"
                            : slot.reason}
                        </span>
                      )}

                      {slot.isAvailable && !isSelected && (
                        <span className="text-[8px] text-emerald-500 font-bold block uppercase tracking-wider mt-0.5 opacity-60">
                          Livre
                        </span>
                      )}

                      {slot.isAvailable && isSelected && (
                        <span className="text-[8px] text-gold-500 font-bold block uppercase tracking-wider mt-0.5">
                          Selecionado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Summary Section and Confirm Action */}
            {currentUser && selectedTime && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 mt-4 border-t border-neutral-900 space-y-4"
              >
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-display">
                  <div className="text-center sm:text-left">
                    <p className="text-neutral-500 text-[10px] tracking-widest uppercase mb-0.5">
                      Confirmar Agendamento
                    </p>
                    <p className="font-bold text-neutral-200">
                      {selectedService.name} às{" "}
                      <span className="text-gold-500 font-mono text-sm">
                        {selectedTime}
                      </span>{" "}
                      do dia {formatDateWithDayName(selectedDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-serif font-bold text-gold-500 text-lg sm:text-xl">
                      {selectedService.price}
                    </span>
                  </div>
                </div>

                {actionError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                <button
                  onClick={handleBookingConfirm}
                  disabled={isSubmitting}
                  className="w-full bg-gold-500 hover:bg-gold-600 text-neutral-950 font-bold py-4 px-6 rounded-xl text-xs tracking-widest uppercase transition-all duration-300 shadow-xl shadow-gold-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processando Reserva no Jesuino's...
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="h-4 w-4" />
                      Agendar Horário na Barbearia
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {!currentUser && (
              <div className="text-center bg-neutral-900/20 border border-dashed border-neutral-800 p-6 rounded-xl mt-4">
                <Scissors className="h-5 w-5 text-neutral-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-neutral-400 font-display">
                  Por favor,{" "}
                  <strong className="text-neutral-200">
                    identifique-se acima
                  </strong>{" "}
                  preenchendo os dados para liberar a confirmação de horário.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
