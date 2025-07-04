import React, { useState } from 'react';
import { useQuickNotes } from '../../hooks/useQuickNotes';
import { useAuth } from '../../hooks/useAuth';
import Card from './Card';
import Button from './Button';
import { CloseIcon, DeleteIcon } from './icons';

interface QuickNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickNotesModal: React.FC<QuickNotesModalProps> = ({ isOpen, onClose }) => {
  const { notes, isLoadingNotes, addNote, deleteNote } = useQuickNotes();
  const { currentUser } = useAuth();
  const [newNoteContent, setNewNoteContent] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    const success = await addNote(newNoteContent);
    if (success) {
      setNewNoteContent('');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-notes-modal-title"
    >
      <Card 
        title="Notas Rápidas (Caducan en 5 días)" 
        className="w-full max-w-lg bg-white dark:bg-sap-dark-gray shadow-xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar modal"
        >
            <CloseIcon className="w-5 h-5"/>
        </button>
        
        <div className="space-y-4">
            <form onSubmit={handleAddNote} className="flex items-start gap-2">
                <textarea
                    id="new-note-content"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Escribir una nueva nota..."
                    className="flex-grow block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue sm:text-sm"
                    autoComplete="off"
                    rows={3}
                />
                <Button type="submit" disabled={!newNoteContent.trim() || isLoadingNotes}>
                    Agregar
                </Button>
            </form>

            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 max-h-[50vh] overflow-y-auto space-y-3 pr-2">
                {isLoadingNotes ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">Cargando notas...</p>
                ) : notes.length > 0 ? (
                    notes.map(note => (
                        <div key={note.id} className="p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded-md shadow-sm flex justify-between items-start gap-2">
                           <div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{note.content}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                - {note.authorUsername} ({new Date(note.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})
                            </p>
                           </div>
                           {(note.authorUsername === currentUser?.username || currentUser?.role === 'Administrador') && (
                               <Button size="sm" variant="danger" className="p-1 shrink-0" onClick={() => deleteNote(note.id)} title="Eliminar nota">
                                   <DeleteIcon className="w-4 h-4" />
                               </Button>
                           )}
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay notas rápidas.</p>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};

export default QuickNotesModal;