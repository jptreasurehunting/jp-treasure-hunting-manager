import React, { useState } from 'react';
import { EbaySellerAccount } from '../../types/zonosCustoms';

interface EbayAccountManagerProps {
  accounts: EbaySellerAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onUpdateDisplayName: (accountId: string, newDisplayName: string) => void;
  onOpenConnectPrep: (account: EbaySellerAccount) => void;
  onDisconnectAccount: (accountId: string) => void;
  onAddAccount: (name: string, username: string) => void;
  onRemoveAccount: (accountId: string) => void;
  onMoveAccount: (accountId: string, direction: 'up' | 'down') => void;
}

export const EbayAccountManager: React.FC<EbayAccountManagerProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onUpdateDisplayName,
  onOpenConnectPrep,
  onDisconnectAccount,
  onAddAccount,
  onRemoveAccount,
  onMoveAccount
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState<string>('');
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newEbayUsername, setNewEbayUsername] = useState<string>('');

  const handleStartEdit = (account: EbaySellerAccount) => {
    setEditingId(account.id);
    setEditNameInput(account.displayName);
  };

  const handleSaveEdit = (accountId: string) => {
    if (editNameInput.trim()) {
      onUpdateDisplayName(accountId, editNameInput.trim());
    }
    setEditingId(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStoreName.trim()) {
      onAddAccount(newStoreName.trim(), newEbayUsername.trim());
      setNewStoreName('');
      setNewEbayUsername('');
      setIsAddFormOpen(false);
    }
  };

  return (
    <div className="ebay-account-manager-inline space-y-2">
      <div className="flex items-center space-x-2">
        <select
          className="form-control text-xs bg-slate-950 border-slate-700 text-amber-300 font-bold px-2 py-1 rounded"
          value={selectedAccountId}
          onChange={(e) => onSelectAccount(e.target.value)}
          title="使用するeBayアカウントを選択"
        >
          {accounts.map((acc, idx) => (
            <option key={acc.id} value={acc.id}>
              #{idx + 1} {acc.displayName} ({acc.ebayUsername}) [{acc.connectionStatus === 'connected' ? '🟢 接続中' : '⚪ 未接続'}]
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn-secondary text-xs font-bold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1"
          onClick={() => setIsAddFormOpen(!isAddFormOpen)}
          title="新規eBayアカウントを追加"
        >
          ➕ 追加
        </button>
      </div>

      {/* Add Account Inline Form */}
      {isAddFormOpen && (
        <form onSubmit={handleAddSubmit} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
          <strong className="text-emerald-400 font-bold block text-[11px]">➕ 新規eBayアカウント登録 (上限無制限)</strong>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              placeholder="表示名 (例: Main Store 2)"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              required
            />
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              placeholder="eBayユーザー名 (例: seller_store_2)"
              value={newEbayUsername}
              onChange={(e) => setNewEbayUsername(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-0.5"
              onClick={() => setIsAddFormOpen(false)}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-3 py-0.5 bg-emerald-600 hover:bg-emerald-500"
            >
              登録
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
