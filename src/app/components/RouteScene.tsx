import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import guardrailsArt from "../../assets/redline-guardrails-citadel.webp";
import treasuryArt from "../../assets/redline-treasury-core.webp";
import evidenceArt from "../../assets/redline-evidence-observatory.webp";

const SCENE_ART: Partial<Record<string, string>> = {
  marketplace: guardrailsArt,
  agents: treasuryArt,
  guardrails: guardrailsArt,
  treasury: treasuryArt,
  audit: evidenceArt,
  analytics: evidenceArt,
  settings: evidenceArt,
};

export function RouteScene({ icon: Icon, label, scene }: { icon: React.ElementType; label: string; scene: string }) {
  const reduced = useReducedMotion();
  const artwork = SCENE_ART[scene];
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artwork || !sceneRef.current) return;
    const updateHeight = () => {
      const firstChild = document.querySelector(".route-page > :first-child") as HTMLElement | null;
      if (firstChild && sceneRef.current) {
        const h = firstChild.offsetHeight;
        if (h > 0) {
          sceneRef.current.style.height = `${h}px`;
        }
      }
    };

    updateHeight();
    const timer = setTimeout(updateHeight, 50);
    const observer = new ResizeObserver(updateHeight);
    const firstChild = document.querySelector(".route-page > :first-child");
    if (firstChild) observer.observe(firstChild);

    window.addEventListener("resize", updateHeight);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [scene, artwork]);

  return (
    <motion.div
      ref={sceneRef}
      className={`route-scene ${artwork ? "route-scene-has-art" : ""}`}
      data-scene={scene}
      aria-hidden="true"
      initial={reduced ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0 : .7, ease: [0.22, 1, 0.36, 1] }}
    >
      {artwork && <img className="route-scene-art" src={artwork} alt="" loading="lazy" decoding="async" />}
      {artwork && <span className="route-scene-art-wash" />}
      <span className="route-scene-orbit route-scene-orbit-a" />
      <span className="route-scene-orbit route-scene-orbit-b" />
      <span className="route-scene-axis" />
      <span className="route-scene-core"><Icon size={25} /></span>
      <span className="route-scene-cube route-scene-cube-a" />
      <span className="route-scene-cube route-scene-cube-b" />
      <span className="route-scene-cube route-scene-cube-c" />
      <span className="route-scene-label">{label} / SPATIAL LAYER</span>
    </motion.div>
  );
}
