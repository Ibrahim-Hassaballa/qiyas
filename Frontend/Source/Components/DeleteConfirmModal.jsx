import { AlertTriangle } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';
import BaseModal from './Admin/Shared/BaseModal';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  const { t } = useLocale();

  const displayTitle = title || t('admin.confirmDelete');

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={displayTitle}
      maxWidth="max-w-sm"
      role="alertdialog"
      className="z-[60]"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg btn-secondary focus-ring"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg btn-danger focus-ring"
          >
            {t('common.delete')}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg status-danger shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm app-text">
          {message || t('chat.deleteConversationMessage')}
        </p>
      </div>
    </BaseModal>
  );
};

export default DeleteConfirmModal;
