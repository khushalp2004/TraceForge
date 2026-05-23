"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function PageDescriptionPopover({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Use capture phase to ensure it runs before other click handlers that might stop propagation
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("touchstart", handleOutsideClick, true);
    
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Hover only active on non-touch devices
  const handleMouseEnter = () => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setIsOpen(false);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button 
        type="button"
        onClick={toggleOpen}
        className={`ml-3 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 relative top-[1px] sm:top-0.5 ${
          isOpen ? "bg-primary/10 text-primary" : "text-text-secondary hover:text-primary hover:bg-secondary/50"
        }`}
        aria-label="More information"
        aria-expanded={isOpen}
      >
        <Info className="w-[18px] h-[18px]" />
      </button>

      <AnimatePresence>
        {isOpen && (
           <motion.div
             initial={{ opacity: 0, y: 5, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 5, scale: 0.95 }}
             transition={{ duration: 0.15, ease: "easeOut" }}
             className="absolute left-0 sm:left-full sm:ml-2 top-full mt-2 sm:mt-0 sm:top-1/2 sm:-translate-y-1/2 z-[100] w-[280px] p-4 bg-card/95 backdrop-blur-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl text-[13px] leading-relaxed text-text-secondary font-normal"
           >
             <div className="flex justify-between items-start gap-3">
                <div className="flex-1">{children}</div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="sm:hidden shrink-0 -mt-1 -mr-1 p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-secondary/50 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
