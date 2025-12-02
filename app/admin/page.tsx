'use client';

import { useEffect, useState } from 'react';
import { supabase, type Event } from '../../lib/supabaseClient';
import { useAdmin } from '../providers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Pencil, Play } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('event')
        .select('id, name, eventDate')
        .or('isArchived.is.null,isArchived.eq.false')
        .order('eventDate', { ascending: false });

      if (err) {
        setError('Could not load events. Please refresh.');
        // eslint-disable-next-line no-console
        console.error(err);
      } else if (data) {
        setEvents(data);
      }

      setLoading(false);
    };

    void fetchData();
  }, [isAdmin]);

  const handleCreateEvent = async () => {
    const { data, error: err } = await supabase
      .from('event')
      .insert({ name: 'New Event', eventDate: new Date().toISOString().split('T')[0] })
      .select()
      .single();

    if (err) {
      setError('Could not create event.');
      return;
    }

    if (data) {
      router.push(`/admin/events/${data.id}/holes`);
    }
  };

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
    setEventName(event.name || '');
    setEventDate(event.eventDate || '');
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;

    // Only update if values have changed
    const updateData: { name?: string; eventDate?: string } = {};
    if (eventName !== (editingEvent.name || '')) {
      updateData.name = eventName;
    }
    if (eventDate !== (editingEvent.eventDate || '')) {
      updateData.eventDate = eventDate;
    }

    // If nothing changed, just close the dialog
    if (Object.keys(updateData).length === 0) {
      setEditingEvent(null);
      setEventName('');
      setEventDate('');
      return;
    }

    const { error: err } = await supabase
      .from('event')
      .update(updateData)
      .eq('id', editingEvent.id);

    if (err) {
      setError('Could not update event.');
      // eslint-disable-next-line no-console
      console.error(err);
      return;
    }

    setEvents(
      events.map((e) => (e.id === editingEvent.id ? { ...e, name: eventName, eventDate } : e))
    );
    setEditingEvent(null);
    setEventName('');
    setEventDate('');
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;

    // Archive all related holes
    const { data: holesData } = await supabase
      .from('holes')
      .select('id')
      .eq('eventId', deleteEventId)
      .or('isArchived.is.null,isArchived.eq.false');

    if (holesData && holesData.length > 0) {
      const holeIds = holesData.map((h) => h.id);
      
      // Archive holes
      await supabase.from('holes').update({ isArchived: true }).in('id', holeIds);
    }

    // Archive the event
    const { error: err } = await supabase
      .from('event')
      .update({ isArchived: true })
      .eq('id', deleteEventId);

    if (err) {
      setError('Could not archive event.');
      // eslint-disable-next-line no-console
      console.error(err);
      return;
    }

    setEvents(events.filter((e) => e.id !== deleteEventId));
    setDeleteEventId(null);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Admin access required</p>
          <p className="mt-2 text-xs text-slate-500">
            Go back and log in with the admin PIN to manage events.
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
          <h1 className="text-xl font-semibold text-white">Manage Events</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/members">
            <Button variant="outline" size="sm" className="text-[10px]">
              Members
            </Button>
          </Link>
          <Link href="/event">
            <Button variant="outline" size="sm" className="text-[10px]">
              Scoreboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && <p className="mt-8 text-center text-sm text-emerald-100">Loading events...</p>}
        {error && <p className="mt-2 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && (
          <div className="space-y-4">
            <Button onClick={handleCreateEvent} className="w-full border-dashed" variant="outline">
              + Create New Event
            </Button>

            {events.length === 0 ? (
              <p className="mt-8 text-center text-sm text-emerald-100">
                No events yet. Create one to get started.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white/95">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          {event.name || 'Unnamed Event'}
                        </TableCell>
                        <TableCell>
                          {event.eventDate
                            ? new Date(event.eventDate).toLocaleDateString()
                            : 'No date set'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleEditClick(event)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => router.push(`/admin/events/${event.id}/holes`)}
                              size="sm"
                              variant="outline"
                            >
                              Manage Event
                            </Button>
                            <Button
                              onClick={() => router.push(`/admin/events/${event.id}/play`)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Play
                            </Button>
                            <Button
                              onClick={() => setDeleteEventId(event.id)}
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update the event name and date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name</label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Date</label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteEventId} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this event? It will be hidden from the list but can
              be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEventId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEvent}>
              <Trash2 className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
