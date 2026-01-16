import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, X, Loader2 } from "lucide-react";

type PixPaymentModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  amountLabel?: string;
  qrCodeText: string | null;
  qrCodeImageDataUrl?: string | null;
  onClose: () => void;
  onIHavePaid: () => Promise<void>;
};

function formatPixCode(code: string) {
  // Avoid rendering a single gigantic line
  return code.replace(/(.{60})/g, "$1\n").trim();
}

/**
 * Responsive PIX modal (mobile-first):
 * - Single column layout
 * - Scrolls inside the modal when content exceeds viewport
 * - QR stays readable without overflowing
 */
const PixPaymentModal = ({
  open,
  title,
  subtitle,
  amountLabel,
  qrCodeText,
  qrCodeImageDataUrl,
  onClose,
  onIHavePaid,
}: PixPaymentModalProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const pixText = useMemo(() => (qrCodeText ? String(qrCodeText) : ""), [qrCodeText]);
  const imgUrl = qrCodeImageDataUrl ? String(qrCodeImageDataUrl) : null;

  useEffect(() => {
    let mounted = true;

    (async () => {
      setQrDataUrl(null);
      if (!open) return;

      if (imgUrl) {
        setQrDataUrl(imgUrl);
        return;
      }

      if (!pixText) return;

      try {
        const url = await QRCode.toDataURL(pixText, { margin: 1, width: 360 });
        if (mounted) setQrDataUrl(url);
      } catch {
        if (mounted) setQrDataUrl(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, pixText, imgUrl]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setBusy(false);
      setQrDataUrl(null);
    }
  }, [open]);

  if (!open) return null;

  async function copy() {
    if (!pixText) return;
    try {
      await navigator.clipboard.writeText(pixText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function iHavePaid() {
    setBusy(true);
    try {
      await onIHavePaid();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-panel mystic-glow w-full max-w-[520px] rounded-2xl border border-white/10 bg-black/40"
        style={{ maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-extrabold tracking-wide truncate">{title}</div>
            {subtitle && <div className="muted mt-1 text-sm sm:text-base">{subtitle}</div>}
            {amountLabel && <div className="muted mt-1 text-sm">{amountLabel}</div>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-xl grid place-items-center border border-white/10 bg-black/20 hover:bg-black/25 transition"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-auto" style={{ maxHeight: "calc(88vh - 76px)" }}>
          {/* QR */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold mb-3">QR Code</div>

            {qrDataUrl ? (
              <div className="grid place-items-center">
                <img
                  src={qrDataUrl}
                  alt="QR Code PIX"
                  className="w-full max-w-[320px] aspect-square rounded-2xl border border-white/10 bg-white"
                />
              </div>
            ) : (
              <div className="w-full max-w-[320px] aspect-square mx-auto rounded-2xl border border-white/10 bg-black/30 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin opacity-80" />
              </div>
            )}

            <div className="muted text-xs text-center mt-2">Abra o app do banco e escaneie o QR.</div>
          </div>

          {/* Copy/Paste */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Copia e Cola</div>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition text-sm"
                onClick={copy}
                disabled={!pixText}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>

            <textarea
              readOnly
              value={pixText ? pixText : "Código PIX indisponível."}
              className="mt-3 w-full min-h-[110px] max-h-[180px] rounded-2xl border border-white/10 bg-black/30 p-3 text-xs sm:text-sm leading-relaxed outline-none resize-none"
            />

            <div className="mt-3 flex flex-col sm:flex-row gap-3">
              <button type="button" className="btn-primary flex-1 py-3" onClick={iHavePaid} disabled={busy}>
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  "Já paguei"
                )}
              </button>

              <button
                type="button"
                className="flex-1 py-3 rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition"
                onClick={onClose}
              >
                Fechar
              </button>
            </div>

            <div className="muted mt-3 text-xs">Após pagar, clique em “Já paguei” para atualizar sua conta.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixPaymentModal;
