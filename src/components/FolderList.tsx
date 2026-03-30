"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Folder {
  id: string;
  name: string;
  description: string | null;
  card_count?: number;
  total_value?: number;
}

interface FolderListProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onFoldersChange: () => void;
}

export default function FolderList({
  folders,
  selectedFolderId,
  onSelectFolder,
  onFoldersChange,
}: FolderListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    const supabase = createClient();
    await supabase.from("folders").insert({ name: newName.trim() });
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    onFoldersChange();
  };

  const handleDelete = async (folderId: string) => {
    if (!confirm("Delete this folder? Cards won't be deleted.")) return;
    const supabase = createClient();
    await supabase.from("folders").delete().eq("id", folderId);
    if (selectedFolderId === folderId) onSelectFolder(null);
    onFoldersChange();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Folders
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-purple-400 hover:text-purple-300 text-sm font-medium"
        >
          {showCreate ? "Cancel" : "+ New"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      {/* All Cards option */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full text-left rounded-xl px-4 py-3 text-sm transition-colors ${
          selectedFolderId === null
            ? "bg-purple-600/20 border border-purple-500/30 text-white"
            : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
        }`}
      >
        All Cards
      </button>

      {/* Folder items */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={`group flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors cursor-pointer ${
            selectedFolderId === folder.id
              ? "bg-purple-600/20 border border-purple-500/30 text-white"
              : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          }`}
          onClick={() => onSelectFolder(folder.id)}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{folder.name}</p>
            {folder.total_value !== undefined && (
              <p className="text-xs text-slate-500 mt-0.5">
                {folder.card_count} cards &middot; ¥
                {folder.total_value.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(folder.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all ml-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
