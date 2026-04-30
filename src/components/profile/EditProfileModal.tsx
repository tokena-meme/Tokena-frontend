import { useState, useRef } from 'react';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { updateProfile } from '../../lib/supabase/social-queries';
import { uploadTokenImage, ipfsToHttp } from '../../lib/ipfs/pinata';
import type { Profile } from '../../lib/supabase/types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onSaved: () => void;
}

export function EditProfileModal({ isOpen, onClose, profile, onSaved }: EditProfileModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    avatar_url: profile.avatar_url ?? '',
    twitter: profile.twitter ?? '',
    telegram: profile.telegram ?? '',
    website: profile.website ?? '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  }

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      setError('Avatar must be PNG, JPG, GIF, or WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be under 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  }

  function removeAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let avatarUrl = form.avatar_url;

      // Upload avatar to Pinata if a new file was selected
      if (avatarFile) {
        setUploading(true);
        setUploadProgress(0);
        const result = await uploadTokenImage(
          avatarFile,
          `avatar-${profile.wallet_address.slice(0, 8)}`,
          (pct) => setUploadProgress(pct)
        );
        avatarUrl = result.ipfsUrl;
        setUploading(false);
      }

      const updates: Partial<Record<string, string | null>> = {};
      for (const [key, value] of Object.entries(form)) {
        if (key === 'avatar_url') continue;
        updates[key] = value.trim() || null;
      }
      updates.avatar_url = avatarUrl?.trim() || null;

      await updateProfile(profile.wallet_address, updates as any);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save profile');
      setUploading(false);
    } finally {
      setSaving(false);
    }
  }

  const currentAvatarDisplay = avatarPreview || (form.avatar_url ? ipfsToHttp(form.avatar_url) : null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="md">
      <div className="space-y-4">
        {/* Avatar Upload */}
        <div>
          <label className="block text-xs font-mono text-[#555] mb-2">Profile Picture</label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="relative flex-shrink-0">
              {currentAvatarDisplay ? (
                <div className="relative">
                  <img
                    src={currentAvatarDisplay}
                    alt="Avatar"
                    className="w-16 h-16 rounded-xl object-cover border border-[#1a1a1a]"
                  />
                  <button
                    onClick={removeAvatar}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF4444] rounded-full flex items-center justify-center text-white hover:bg-[#ff2222] transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center">
                  <ImageIcon size={20} className="text-[#333]" />
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-secondary px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
              >
                <Upload size={12} />
                {avatarFile ? 'Change Image' : 'Upload Image'}
              </button>
              <p className="text-xs font-mono text-[#333] mt-1">PNG, JPG, GIF, WEBP · Max 5MB</p>
              {uploading && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#F5A623] to-[#FF6B35] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[#555]">{uploadProgress}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-xs font-mono text-[#555] mb-1.5">Display Name</label>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => handleChange('display_name', e.target.value)}
            maxLength={50}
            placeholder="Your display name"
            className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-mono text-[#555] mb-1.5">Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] font-mono text-sm">@</span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={30}
              placeholder="username"
              className="tokena-input w-full rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono"
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-mono text-[#555] mb-1.5">
            Bio
            <span className="text-[#333] ml-2">{form.bio.length}/280</span>
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Tell us about yourself"
            className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono resize-none"
          />
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-mono text-[#555] mb-1.5">X / Twitter</label>
            <input
              type="text"
              value={form.twitter}
              onChange={(e) => handleChange('twitter', e.target.value)}
              placeholder="@handle"
              className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#555] mb-1.5">Telegram</label>
            <input
              type="text"
              value={form.telegram}
              onChange={(e) => handleChange('telegram', e.target.value)}
              placeholder="@group or link"
              className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#555] mb-1.5">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://..."
              className="tokena-input w-full rounded-xl px-3 py-2.5 text-sm font-mono"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs font-mono text-[#FF4444]">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary px-5 py-2.5 rounded-xl text-sm flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm flex-1 inline-flex items-center justify-center gap-1.5"
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Uploading...
              </>
            ) : saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
