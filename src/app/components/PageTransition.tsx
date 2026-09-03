import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function PageTransition({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        className="page-transition-frame"
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.988 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.994 }}
        transition={{ duration: reduced ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="page-transition-content">{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}
