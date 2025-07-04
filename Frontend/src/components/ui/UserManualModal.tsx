import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import { CloseIcon } from './icons';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const parseMarkdown = (text: string): string => {
  return text
    .split('\n')
    .map(line => {
      // Headings
      if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;
      if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
      if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
      
      // Images - Updated to use a valid image from the project
      line = line.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="imagens/Mini_Zer0x.jpg" class="mx-auto my-4 rounded shadow-md dark:shadow-lg dark:shadow-black/50" style="max-width: 80%;" />');
      
      // Bold and Italic
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // List items
      if (line.startsWith('- ')) return `<li>${line.substring(2)}</li>`;
      
      // Inline code
      line = line.replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">$1</code>');
      
      // Paragraphs
      if (line.trim() !== '' && !line.startsWith('<')) return `<p>${line}</p>`;
      
      return line;
    })
    .join('')
    // Basic list handling
    .replace(/<p><\/p>/g, '') 
    .replace(/<\/li><li>/g, '</li><li>') 
    .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul><ul>/g, ''); 
};


const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const [manualContent, setManualContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('/ManualUser.md')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(text => {
            setManualContent(parseMarkdown(text));
            setIsLoading(false);
        })
        .catch(error => {
            console.error('Error fetching user manual:', error);
            setManualContent('<p class="text-red-500">Error al cargar el manual.</p>');
            setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-manual-modal-title"
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-sap-dark-gray shadow-xl rounded-lg relative flex flex-col"
        style={{ height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h3 id="user-manual-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">Manual de Usuario</h3>
             <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Cerrar modal"
            >
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>
       
        <div className="flex-grow overflow-y-auto p-2">
            {isLoading ? (
                <p className="text-center p-8 text-gray-600 dark:text-gray-300">Cargando manual...</p>
            ) : (
                <div 
                    className="prose dark:prose-invert max-w-none p-4"
                    dangerouslySetInnerHTML={{ __html: manualContent }}
                />
            )}
        </div>
        <div className="mt-auto text-right border-t border-gray-200 dark:border-gray-700 p-4 shrink-0">
          <Button onClick={onClose} variant="primary">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserManualModal;