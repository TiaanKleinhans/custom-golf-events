'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase, type Member } from '../../../lib/supabaseClient';
import { useAdmin } from '../../providers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function MembersPage() {
  const { isAdmin } = useAdmin();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('member')
        .select('id, name, handiCap')
        .or('isArchived.is.null,isArchived.eq.false');

      if (err) {
        setError('Could not load members. Please refresh.');
        // eslint-disable-next-line no-console
        console.error(err);
      } else if (data) {
        // Sort by handicap (low to high), with nulls at the end
        const sorted = [...data].sort((a, b) => {
          const aHcp = a.handiCap ?? Infinity;
          const bHcp = b.handiCap ?? Infinity;
          return aHcp - bHcp;
        });
        setMembers(sorted);
      }

      setLoading(false);
    };

    void fetchData();
  }, [isAdmin]);

  const handleMemberChange = (memberId: string, field: 'name' | 'handiCap', value: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              [field]: field === 'handiCap' ? (value === '' ? null : Number(value)) : value,
            }
          : m
      )
    );
  };

  const handleAddMember = () => {
    const tempId = `temp-${Date.now()}`;
    const newMember: Member = {
      id: tempId,
      name: 'New Member',
      handiCap: null,
    };
    setMembers((prev) => [...prev, newMember]);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (memberId.startsWith('temp-')) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      return;
    }

    const { error: err } = await supabase
      .from('member')
      .update({ isArchived: true })
      .eq('id', memberId);
    if (err) {
      setError('Could not delete member.');
      // eslint-disable-next-line no-console
      console.error(err);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      for (const member of members) {
        const memberRow: Omit<Member, 'id'> & { id?: string } = {
          name: member.name,
          handiCap: member.handiCap ?? null,
        };

        if (member.id.startsWith('temp-')) {
          // Insert new member
          const { error: insertError } = await supabase.from('member').insert(memberRow);
          if (insertError) throw insertError;
        } else {
          // Update existing member
          const { error: updateError } = await supabase
            .from('member')
            .update(memberRow)
            .eq('id', member.id);
          if (updateError) throw updateError;
        }
      }

      // Reload to get new IDs for temp members
      const { data } = await supabase
        .from('member')
        .select('id, name, handiCap')
        .or('isArchived.is.null,isArchived.eq.false');
      if (data) {
        // Sort by handicap (low to high), with nulls at the end
        const sorted = [...data].sort((a, b) => {
          const aHcp = a.handiCap ?? Infinity;
          const bHcp = b.handiCap ?? Infinity;
          return aHcp - bHcp;
        });
        setMembers(sorted);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('There was a problem saving changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Admin access required</p>
          <p className="mt-2 text-xs text-slate-500">
            Go back and log in with the admin PIN to manage members.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
          >
            Back to start
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-emerald-900 px-3 pb-6 pt-10 text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Admin
          </p>
          <h1 className="text-xl font-semibold text-white">Manage Members</h1>
        </div>
        <Link
          href="/admin"
          className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-50 ring-1 ring-emerald-300/40"
        >
          Back to Events
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && <p className="mt-8 text-center text-sm text-emerald-100">Loading members...</p>}
        {error && <p className="mt-2 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && (
          <form onSubmit={handleSave} className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-emerald-100"
              >
                <input
                  value={member.name ?? ''}
                  onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    HCP
                  </p>
                  <input
                    type="number"
                    step="0.1"
                    value={member.handiCap ?? ''}
                    onChange={(e) => handleMemberChange(member.id, 'handiCap', e.target.value)}
                    className="mt-0.5 w-20 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-right text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => handleDeleteMember(member.id)}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddMember}
              className="flex w-full items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-950/20 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50"
            >
              + Add Member
            </button>

            <button
              type="submit"
              disabled={saving}
              className="mt-1 flex w-full items-center justify-center rounded-2xl bg-emerald-500 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
