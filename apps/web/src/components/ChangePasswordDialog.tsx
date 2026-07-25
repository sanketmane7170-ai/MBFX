import { useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { useToast } from './ui/toast';
import { changePassword } from '@/lib/api';

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const submit = async () => {
    if (next.length < 8) {
      toast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (next !== confirm) {
      toast('New passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      toast('Password changed.', 'success');
      reset();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Change failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Change password"
      description="Choose a strong password you don't use elsewhere."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Update password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password" hint="At least 8 characters. Signs you out of other sessions.">
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
      </div>
    </Dialog>
  );
}
