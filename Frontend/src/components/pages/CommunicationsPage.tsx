import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToasts } from '../../hooks/useToasts';
import { useLogs } from '../../hooks/useLogs';
import { getSettingValue, setSettingValue, COUNTER_IDS } from '../../utils/indexedDB';
import Card from '../ui/Card';
import Button from '../ui/Button';

const CommunicationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const isAdmin = currentUser?.role === 'Administrador';

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        const storedContent = await getSettingValue<string>(COUNTER_IDS.COMMUNICATIONS_CONTENT_ID, '');
        setContent(storedContent);
      } catch (error) {
        console.error("Error loading communications content:", error);
        addToast("Error al cargar los comunicados.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    loadContent();
  }, [addToast]);

  const handleSave = async () => {
    try {
      await setSettingValue(COUNTER_IDS.COMMUNICATIONS_CONTENT_ID, content);
      await addLog(currentUser?.username || 'System', 'Communications Updated', { contentLength: content.length });
      addToast("Comunicado guardado con éxito.", "success");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving communications content:", error);
      await addLog(currentUser?.username || 'System', 'Communications Update Failed', { error: String(error) });
      addToast("Error al guardar el comunicado.", "error");
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando comunicados...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-sap-dark-gray dark:text-gray-100">Comunicados Internos</h1>
        {isAdmin && !isEditing && (
          <Button onClick={() => setIsEditing(true)}>Editar</Button>
        )}
      </div>

      <Card>
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="block w-full h-96 px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                         focus:ring-sap-blue focus:border-sap-blue dark:focus:ring-sap-light-blue dark:focus:border-sap-light-blue 
                         sm:text-sm"
              placeholder="Escriba aquí el comunicado. Puede usar etiquetas HTML básicas como <b>, <i>, <u>, <p>, <br>."
            />
            <div className="flex space-x-2">
              <Button onClick={handleSave} variant="primary">Guardar Cambios</Button>
              <Button onClick={() => setIsEditing(false)} variant="secondary">Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none p-2">
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No hay comunicados para mostrar.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CommunicationsPage;