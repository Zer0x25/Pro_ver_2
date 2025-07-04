import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { QuickNote, QuickNotesContextType, Syncable } from '../types';
import { idbGetAll, idbPut, idbDelete, STORES } from '../utils/indexedDB';
import { useAuth } from '../hooks/useAuth';
import { useToasts } from '../hooks/useToasts';
import { useLogs } from '../hooks/useLogs';

export const QuickNotesContext = createContext<QuickNotesContextType | undefined>(undefined);

const FIVE_DAYS_IN_MS = 5 * 24 * 60 * 60 * 1000;

export const QuickNotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();

  const loadNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    try {
      const storedNotes = await idbGetAll<QuickNote>(STORES.QUICK_NOTES);
      const now = Date.now();
      const validNotes: QuickNote[] = [];
      const expiredNoteIds: string[] = [];

      for (const note of storedNotes) {
        if (now - note.createdAt > FIVE_DAYS_IN_MS) {
          expiredNoteIds.push(note.id);
        } else {
          validNotes.push(note);
        }
      }
      
      setNotes(validNotes.sort((a, b) => b.createdAt - a.createdAt));

      // Cleanup expired notes in the background
      if (expiredNoteIds.length > 0) {
        console.log(`Cleaning up ${expiredNoteIds.length} expired quick notes.`);
        await Promise.all(expiredNoteIds.map(id => idbDelete(STORES.QUICK_NOTES, id)));
      }

    } catch (error) {
      console.error("Error loading quick notes:", error);
      addToast("Error al cargar las notas rápidas.", "error");
    } finally {
      setIsLoadingNotes(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const addNote = useCallback(async (content: string): Promise<QuickNote | null> => {
    if (!currentUser) {
      addToast("Debe iniciar sesión para agregar una nota.", "error");
      return null;
    }
    const actor = currentUser.username;
    const newNote: QuickNote = {
      id: crypto.randomUUID(),
      content,
      authorUsername: actor,
      createdAt: Date.now(),
      lastModified: Date.now(),
      syncStatus: 'pending',
      isDeleted: false,
    };

    try {
      await idbPut<QuickNote>(STORES.QUICK_NOTES, newNote);
      setNotes(prev => [newNote, ...prev].sort((a, b) => b.createdAt - a.createdAt));
      addLog(actor, 'Quick Note Added', { noteId: newNote.id });
      addToast("Nota rápida agregada.", "success");
      return newNote;
    } catch (error) {
      console.error("Error adding quick note:", error);
      addLog(actor, 'Quick Note Add Failed', { error: String(error) });
      addToast("Error al agregar la nota.", "error");
      return null;
    }
  }, [currentUser, addLog, addToast]);

  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    if (!currentUser) {
      addToast("Debe iniciar sesión para eliminar una nota.", "error");
      return false;
    }
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete) {
        addToast("Nota no encontrada.", "error");
        return false;
    }
    if (noteToDelete.authorUsername !== currentUser.username && currentUser.role !== 'Administrador') {
        addToast("No puede eliminar notas de otros usuarios.", "error");
        return false;
    }

    try {
      await idbDelete(STORES.QUICK_NOTES, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      addLog(currentUser.username, 'Quick Note Deleted', { noteId });
      addToast("Nota eliminada.", "success");
      return true;
    } catch (error) {
      console.error("Error deleting quick note:", error);
      addLog(currentUser.username, 'Quick Note Delete Failed', { noteId, error: String(error) });
      addToast("Error al eliminar la nota.", "error");
      return false;
    }
  }, [currentUser, notes, addLog, addToast]);

  return (
    <QuickNotesContext.Provider value={{ notes, isLoadingNotes, addNote, deleteNote }}>
      {children}
    </QuickNotesContext.Provider>
  );
};
