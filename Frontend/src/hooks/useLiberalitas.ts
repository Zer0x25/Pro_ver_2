import { useState, useEffect } from 'react';
import { liberalitasDefinitions } from '../utils/liberalitas';

export const useLiberalitas = (intervalMs = 8000) => {
  const [tooltip, setTooltip] = useState(() => {
    return liberalitasDefinitions[Math.floor(Math.random() * liberalitasDefinitions.length)];
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * liberalitasDefinitions.length);
      setTooltip(liberalitasDefinitions[randomIndex]);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return tooltip;
};