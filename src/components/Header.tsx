import { Scissors, Lock, User } from 'lucide-react';

interface HeaderProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  currentUser: { name: string; phone: string } | null;
  onLogoutUser: () => void;
}

export default function Header({ isAdmin, onToggleAdmin, currentUser, onLogoutUser }: HeaderProps) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 border border-gold-500/30 text-gold-500 shadow-lg shadow-gold-500/10">
              <Scissors className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-serif text-xl tracking-widest text-white uppercase sm:text-2xl font-bold">
                Jesuino's
              </h1>
              <p className="font-display text-xs tracking-widest text-gold-500 uppercase font-medium">
                Barbearia Premium
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {currentUser && !isAdmin && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-300">
                <User className="h-3.5 w-3.5 text-gold-500" />
                <span className="font-medium max-w-[120px] truncate">{currentUser.name}</span>
                <button 
                  onClick={onLogoutUser}
                  className="ml-2 text-red-400 hover:text-red-300 transition-colors cursor-pointer font-bold"
                >
                  Sair
                </button>
              </div>
            )}

            <button
              onClick={onToggleAdmin}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-display tracking-widest uppercase transition-all duration-300 cursor-pointer ${
                isAdmin
                  ? "bg-gold-500 border-gold-500 text-neutral-950 font-bold shadow-md shadow-gold-500/20 hover:bg-gold-600"
                  : "bg-neutral-900 border-neutral-800 text-gold-500 hover:border-gold-500/40 hover:bg-neutral-800/50"
              }`}
            >
              {isAdmin ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Painel Agenda
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-neutral-400" />
                  Área do Barbeiro
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
