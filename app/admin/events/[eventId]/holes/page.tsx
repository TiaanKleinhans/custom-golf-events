'use client';

import { useEffect, useState } from 'react';
import { supabase, type Event, type Hole } from '../../../../../lib/supabaseClient';
import { useAdmin } from '../../../../providers';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function HolesManagementPage() {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data: eventData, error: eventErr } = await supabase
        .from('event')
        .select('id, name, eventDate')
        .eq('id', eventId)
        .single();

      if (eventErr || !eventData) {
        setError('Could not load event.');
        setLoading(false);
        return;
      }

      setEvent(eventData);

      const { data: holesData, error: holesErr } = await supabase
        .from('holes')
        .select('id, eventId, par, name, holeDescription, created_at')
        .eq('eventId', eventId)
        .or('isArchived.is.null,isArchived.eq.false')
        .order('created_at', { ascending: true });

      if (holesErr) {
        setError('Could not load holes.');
      } else {
        setHoles(holesData || []);
      }

      setLoading(false);
    };

    void fetchData();
  }, [isAdmin, eventId]);

  const handleAddHole = async () => {
    const { data, error: err } = await supabase
      .from('holes')
      .insert({
        eventId: eventId,
        name: 'New Hole',
        par: null,
        holeDescription: null,
      })
      .select('id, eventId, par, name, holeDescription, created_at')
      .single();

    if (err) {
      setError('Could not create hole.');
      return;
    }

    if (data) {
      router.push(`/admin/events/${eventId}/holes/${data.id}`);
    }
  };

  const handleDeleteHole = async (holeId: string) => {
    if (!confirm('Are you sure you want to archive this hole? It will be hidden but can be restored later.')) return;

    const { error: err } = await supabase
      .from('holes')
      .update({ isArchived: true })
      .eq('id', holeId);

    if (err) {
      setError('Could not archive hole.');
      return;
    }

    setHoles(holes.filter((h) => h.id !== holeId));
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Admin access required</p>
          <Link
            href="/admin"
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
          >
            Back to Events
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
          <h1 className="text-xl font-semibold text-white">
            {event?.name || 'Event'} - Holes
          </h1>
        </div>
        <Link
          href="/admin"
          className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-50 ring-1 ring-emerald-300/40"
        >
          Back to Events
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && <p className="mt-8 text-center text-sm text-emerald-100">Loading holes...</p>}
        {error && <p className="mt-2 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && (
          <div className="space-y-4">
            <button
              onClick={handleAddHole}
              className="flex w-full items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-950/20 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50"
            >
              + Add Hole
            </button>

            {holes.length === 0 ? (
              <p className="mt-8 text-center text-sm text-emerald-100">
                No holes yet. Add one to get started.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-3xl bg-white/95 shadow-sm ring-1 ring-emerald-100">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Hole Name
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Par
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holes.map((hole) => (
                      <tr key={hole.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {hole.name || 'Unnamed Hole'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-600">{hole.par ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                router.push(`/admin/events/${eventId}/holes/${hole.id}`)
                              }
                              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                            >
                              Edit
                            </button>
                            <Button
                              onClick={() => handleDeleteHole(hole.id)}
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

