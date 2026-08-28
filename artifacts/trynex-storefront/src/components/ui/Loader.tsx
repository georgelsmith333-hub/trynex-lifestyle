import { motion } from "framer-motion";

export function Loader({ fullScreen = false, label = "Loading" }: { fullScreen?: boolean; label?: string }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <div className="relative w-14 h-14">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(232,93,4,0.18), transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 rounded-full border-[3px]"
          style={{ borderColor: "rgba(232,93,4,0.12)" }}
        />
        <div
          className="absolute inset-0 rounded-full border-[3px]"
          style={{
            borderColor: "transparent",
            borderTopColor: "#E85D04",
            borderRightColor: "#FB8500",
            animation: "trynexLoaderSpin 0.9s linear infinite",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -mt-[3px] -ml-[3px] rounded-full"
          style={{ background: "#E85D04" }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <style>{`
        @keyframes trynexLoaderSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.92)" }}>
        {content}
      </div>
    );
  }

  return <div className="py-16 flex justify-center">{content}</div>;
}
