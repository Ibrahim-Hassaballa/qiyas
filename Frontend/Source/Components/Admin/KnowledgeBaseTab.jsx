import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Database } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import EmptyState from './Shared/EmptyState';
import Badge from './Shared/Badge';
import DeleteConfirmModal from '../DeleteConfirmModal';

const KnowledgeBaseTab = ({
  controls,
  onUploadControl,
  onDeleteControl,
  isUploading,
  isLoading = false,
}) => {
  const { t } = useLocale();
  const controlInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadControl(file);
    e.target.value = '';
  };

  if (isLoading && controls.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 rounded skeleton" />
          <div className="h-8 w-32 rounded skeleton" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <span className="text-sm app-text">{t('settings.documentsCount', { count: controls.length })}</span>
        <button
          type="button"
          onClick={() => controlInputRef.current?.click()}
          disabled={isUploading}
          className="text-sm btn-primary px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 focus-ring"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t('settings.addDocument')}
        </button>
        <input
          type="file"
          ref={controlInputRef}
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={handleUpload}
        />
      </div>

      <div className="space-y-2">
        {controls.map((file, idx) => {
          const fileName = typeof file === 'string' ? file : file.name;
          const isDefault = typeof file === 'object' && file.is_default;
          return (
            <div key={fileName || idx} className="flex justify-between items-center p-3 app-surface-subtle rounded-lg transition-colors card-hover">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm app-title truncate max-w-[300px]" title={fileName} dir="auto">
                  {fileName}
                </span>
                {isDefault && <Badge color="blue" size="sm">{t('settings.defaultBadge')}</Badge>}
              </div>
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(fileName)}
                  className="p-1.5 btn-ghost rounded-lg transition-colors focus-ring"
                  aria-label={`${t('common.delete')} ${fileName}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}

        {controls.length === 0 && (
          <EmptyState
            icon={Database}
            title={t('settings.noDocuments')}
            description={t('settings.addDocument')}
            action={() => controlInputRef.current?.click()}
            actionLabel={t('settings.addDocument')}
          />
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeleteControl(deleteTarget);
          setDeleteTarget(null);
        }}
        title={t('settings.deleteDocumentTitle')}
        message={t('settings.deleteDocumentMessage', { name: deleteTarget })}
      />
    </div>
  );
};

export default KnowledgeBaseTab;
