import React from 'react';
import { useLiberalitas } from '../hooks/useLiberalitas';

interface LiberalitasSignatureProps {
  author?: string;
  className?: string;
}

const LiberalitasSignature: React.FC<LiberalitasSignatureProps> = ({
  author = "Jaime O. Mella V.",
  className = "",
}) => {
  const tooltip = useLiberalitas();

  return (
    <p className={`text-xs ${className}`}>
      A selfless gesture of <em title={tooltip}>liberalitas</em> by {author}
    </p>
  );
};

export default LiberalitasSignature;
