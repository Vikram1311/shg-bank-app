import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmText = 'हाँ, Delete करें', cancelText = 'रद्द', onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-scale-in" onClick={onCancel}>
      <div className="card-3d max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="confirm-dialog">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center flex-shrink-0`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-black text-lg">{title}</h3>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-line mb-5 pl-1">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/70" data-testid="confirm-cancel-btn">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2.5 rounded-xl font-bold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`} data-testid="confirm-ok-btn">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
