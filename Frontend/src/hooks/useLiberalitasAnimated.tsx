// src/hooks/useLiberalitasAnimated.tsx
import { useState, useEffect } from 'react';

export const useLiberalitasAnimated = (definitions: string[], intervalMs = 8000) => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * definitions.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((current) => {
        let next = Math.floor(Math.random() * definitions.length);
        // Evita repetir el mismo índice
        while(next === current) {
          next = Math.floor(Math.random() * definitions.length);
        }
        return next;
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [definitions, intervalMs]);

  return definitions[index];
};
