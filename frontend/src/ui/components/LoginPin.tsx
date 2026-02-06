import React, { useState } from "react";
import { validatePin, setSession } from "../../config/auth";

interface LoginPinProps {
  onLogin: () => void;
}

export default function LoginPin({ onLogin }: LoginPinProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePinClick = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
      setError("");
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleLogin = async () => {
    setIsLoading(true);
    // Simular pequeño delay para mejor UX
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (validatePin(pin)) {
      setSession();
      onLogin();
    } else {
      setError("PIN incorrecto. Intenta de nuevo.");
      setPin("");
    }
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9" && pin.length < 4) {
      handlePinClick(e.key);
    } else if (e.key === "Backspace") {
      handleBackspace();
    } else if (e.key === "Enter") {
      handleLogin();
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyPress(e as unknown as React.KeyboardEvent);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isLoading]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-blue-50 to-emerald-50 flex items-center justify-center p-4 font-sans" style={{
      backgroundImage: "radial-gradient(circle at 20% 50%, rgba(0, 85, 150, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.08) 0%, transparent 50%)"
    }}>
      <div className="w-full max-w-md">
        {/* TARJETA PRINCIPAL */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 space-y-8">
          {/* LOGO SUNASS */}
          <div className="flex justify-center mb-2">
            <img 
              src="/src/assets/sunass-logo.png" 
              alt="Sunass Logo" 
              className="w-32 h-auto drop-shadow-lg"
            />
          </div>

          {/* TÍTULO */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Planificador de Rutas
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Ingresa tu PIN de acceso
            </p>
          </div>

          {/* DISPLAY DEL PIN */}
          <div className="space-y-4">
            <div className="flex justify-center gap-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center font-black text-2xl transition-all ${
                    i < pin.length
                      ? "bg-sunass-blue border-sunass-blue text-white shadow-lg shadow-blue-200"
                      : "bg-slate-50 border-slate-200 text-slate-300"
                  }`}
                >
                  {i < pin.length ? "●" : "○"}
                </div>
              ))}
            </div>

            {/* MENSAJE DE ERROR */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-red-600 text-sm font-bold flex items-center justify-center gap-2">
                  <i className="fa-solid fa-exclamation-circle text-lg"></i>
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* TECLADO NUMÉRICO */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinClick(num.toString())}
                disabled={pin.length === 4 || isLoading}
                className="bg-slate-100 hover:bg-sunass-blue hover:text-white text-slate-700 font-black text-xl p-4 rounded-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm"
              >
                {num}
              </button>
            ))}

            {/* FILA ESPECIAL */}
            <button
              onClick={() => handlePinClick("0")}
              disabled={pin.length === 4 || isLoading}
              className="bg-slate-100 hover:bg-sunass-blue hover:text-white text-slate-700 font-black text-xl p-4 rounded-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm col-span-2"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={pin.length === 0 || isLoading}
              className="bg-red-50 hover:bg-red-500 hover:text-white text-red-600 font-black text-lg p-4 rounded-2xl transition-all transform hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-sm disabled:hover:bg-red-50"
            >
              <i className="fa-solid fa-delete-left"></i>
            </button>
          </div>

          {/* BOTÓN LOGIN */}
          <button
            onClick={handleLogin}
            disabled={pin.length !== 4 || isLoading}
            className="w-full bg-gradient-to-r from-sunass-blue to-sunass-dark hover:shadow-xl text-white font-black text-lg p-4 rounded-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-blue-200 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Verificando...
              </>
            ) : (
              <>
                <i className="fa-solid fa-arrow-right"></i>
                Acceder
              </>
            )}
          </button>

          {/* AYUDA */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-[12px] text-slate-600 font-medium">
              <i className="fa-solid fa-circle-info text-blue-600 mr-2"></i>
              Usa el teclado numérico o tu dispositivo
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center mt-8">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Sistema de Gestión ODS • Sunass 2026
          </p>
        </div>
      </div>
    </div>
  );
}
