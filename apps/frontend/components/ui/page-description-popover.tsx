"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function PageDescriptionPopover({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className={`ml-2 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 relative top-[1px] sm:top-0.5 ${
          isOpen ? "bg-primary/10 text-primary" : "text-text-secondary hover:text-primary hover:bg-secondary/50"
        }`}
        aria-label="More information"
        aria-expanded={isOpen}
      >
        <Info className="w-[18px] h-[18px]" />
      </button>

      <AnimatePresence>
        {isOpen && (
           <>
             {/* Desktop Popover */}
             <motion.div
               initial={{ opacity: 0, y: 5, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: 5, scale: 0.95 }}
               transition={{ duration: 0.15, ease: "easeOut" }}
               className="hidden sm:block absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[100] w-[280px] p-4 bg-card/95 backdrop-blur-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl text-[13px] leading-relaxed text-text-secondary font-normal whitespace-normal font-sans tracking-normal"
             >
               <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">{children}</div>
               </div>
             </motion.div>

             {/* Mobile Modal via Portal */}
             {mounted && createPortal(
               <div className="sm:hidden fixed inset-0 z-[99999] flex items-center justify-center p-4">
                 <motion.div 
                   initial={{ opacity: 0 }} 
                   animate={{ opacity: 1 }} 
                   exit={{ opacity: 0 }} 
                   className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                   onClick={() => setIsOpen(false)}
                 />
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   transition={{ duration: 0.2, ease: "easeOut" }}
                   className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto p-5 bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl text-[13px] leading-relaxed text-text-primary font-medium whitespace-normal font-sans tracking-normal"
                 >
                   <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">{children}</div>
                      <button 
                        onClick={() => setIsOpen(false)} 
                        className="shrink-0 -mt-1 -mr-1 p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-secondary/80 transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                   </div>
                 </motion.div>
               </div>,
               document.body
             )}
           </>
        )}
      </AnimatePresence>
    </div>
  );
}
