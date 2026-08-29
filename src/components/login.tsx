import React, { useState } from "react";
import { Shield, Lock, User, Eye, EyeOff, Languages, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import kspLogo from "@/assets/karnataka-police-logo.png";

export function Login() {
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Subtle premium handshake simulation delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const success = login(username, password);
    setLoading(false);

    if (!success) {
      setError(
        language === "kn"
          ? "ಅಮಾನ್ಯ ರುಜುವಾತುಗಳು. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ."
          : "Invalid secure credentials. Please try again."
      );
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "kn" ? "en" : "kn");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-2 text-ink font-sans">
      {/* Light-theme Geometric Background Accent */}
      <div className="absolute top-0 right-0 h-[45vw] w-[45vw] rounded-full bg-secondary/30 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-[40vw] w-[40vw] rounded-full bg-emerald-50/40 blur-[120px] pointer-events-none" />

      {/* Grid Overlay matching dashboard */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #202124 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Floating Language Toggle */}
      <div className="absolute top-6 right-6">
        <Button
          onClick={toggleLanguage}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-border bg-paper hover:bg-surface-2 text-ink/80 hover:text-ink shadow-sm transition-all duration-300 cursor-pointer"
        >
          <Languages className="h-4 w-4 text-primary" />
          <span className="font-medium">{language === "kn" ? "English" : "ಕನ್ನಡ"}</span>
        </Button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[440px] px-6 z-10">
        <div className="rounded-2xl border-2 border-ink bg-paper p-8 shadow-md transition-all duration-500 hover:shadow-lg">
          
          {/* Karnataka Police Crest */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-4 group">
              {/* Blue outer border matching website style */}
              <div className="absolute -inset-0.5 rounded-xl bg-ink opacity-10 transition duration-500 group-hover:opacity-20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-xl border-2 border-ink bg-paper shadow-sm">
                <img 
                  src={kspLogo} 
                  alt="KSP Crest" 
                  className="h-[68px] w-[68px] object-contain transition-transform duration-500 group-hover:scale-105" 
                />
              </div>
            </div>

            <div className="font-editorial italic text-2xl tracking-wide text-ink">
              {language === "kn" ? "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್" : "Karnataka State Police"}
            </div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink/60 mt-1">
              {language === "kn" ? "ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆಗಳ ವಿಭಾಗ (SCRB)" : "State Crime Records Bureau (SCRB)"}
            </div>
            <div className="h-[2px] w-12 bg-signal mt-4 rounded-full" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider text-ink/60 uppercase">
                {language === "kn" ? "ಅನಲಿಷ್ಟ್ ಯುಸರ್ ನೇಮ್" : "Analyst Username"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <User className="h-4 w-4 text-ink/40" />
                </span>
                <Input
                  type="text"
                  required
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-surface-2 border-border text-ink placeholder-ink/30 focus:border-primary focus:ring-1 focus:ring-primary pl-10 pr-4 py-2.5 rounded-xl transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider text-ink/60 uppercase">
                {language === "kn" ? "ಪಾಸ್ವರ್ಡ್" : "Secure Password"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Lock className="h-4 w-4 text-ink/40" />
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-2 border-border text-ink placeholder-ink/30 focus:border-primary focus:ring-1 focus:ring-primary pl-10 pr-10 py-2.5 rounded-xl transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink/40 hover:text-ink transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-signal/20 bg-signal/5 p-3 text-xs text-signal animate-in fade-in slide-in-from-top-1 duration-300">
                <Shield className="h-4 w-4 text-signal shrink-0" strokeWidth={2.25} />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden bg-primary hover:bg-primary-glow text-white border-2 border-ink font-semibold py-2.5 rounded-xl transition-all duration-300 shadow-sm disabled:opacity-75 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span className="font-mono text-xs uppercase tracking-widest text-white">
                    {language === "kn" ? "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ..." : "AUTHENTICATING..."}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2 text-white">
                  <Shield className="h-4 w-4 text-emerald-300 group-hover:scale-110 transition-transform duration-300" strokeWidth={2.25} />
                  {language === "kn" ? "ಟರ್ಮಿನಲ್ ಪ್ರವೇಶಿಸಿ" : "ACCESS TERMINAL"}
                </span>
              )}
            </Button>
          </form>

          {/* Demo Credentials Helper */}
          <div className="mt-4 p-2.5 text-center font-mono text-[10px] text-ink/60 bg-surface-2 border border-border rounded-xl">
            {language === "kn" 
              ? "ಡೆಮೊ ಲಾಗಿನ್: admin / admin123" 
              : "Demo Access: admin / admin123"}
          </div>

          {/* Secure Warning Notice */}
          <div className="mt-6 border-t border-border pt-5 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-border px-3 py-1 font-mono text-[9.5px] uppercase tracking-wider text-ink/50">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-ping" />
              <span>{language === "kn" ? "ಖಾಸಗಿ ನೆಟ್‌ವರ್ಕ್ ಮಾತ್ರ" : "RESTRICTED AUDIT SYSTEM"}</span>
            </div>
            <p className="mt-2.5 text-[9.5px] text-ink/50 leading-relaxed font-medium">
              {language === "kn" 
                ? "ಎಚ್ಚರಿಕೆ: ಇದು ಕೇವಲ ಅಧಿಕೃತ ಪೊಲೀಸ್ ಅಧಿಕಾರಿಗಳ ಬಳಕೆಕ್ಕೆ ಮಾತ್ರ. ಅನಧಿಕೃತ ಪ್ರವೇಶವು ಕಾನೂನು ಕ್ರಮಗಳಿಗೆ ಒಳಪಟ್ಟಿರುತ್ತದೆ." 
                : "Warning: Unauthorized access is strictly prohibited. Terminal logs are subject to active monitoring."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
