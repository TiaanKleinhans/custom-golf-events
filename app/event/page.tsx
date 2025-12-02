'use client';

import { useEffect, useState } from 'react';
import { supabase, type Event } from '../../lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye } from 'lucide-react';

export default function EventPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase
          .from('event')
          .select('id, name, eventDate')
          .or('isArchived.is.null,isArchived.eq.false')
          .order('eventDate', { ascending: false });

        if (err) throw err;

        setEvents(data || []);
      } catch (err) {
        setError('Could not load events. Please refresh.');
        // eslint-disable-next-line no-console
        console.error(err);
      }

      setLoading(false);
    };

    void fetchData();
  }, []);

  const isToday = (dateString: string | null): boolean => {
    if (!dateString) return false;
    const eventDate = new Date(dateString);
    const today = new Date();
    return (
      eventDate.getDate() === today.getDate() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-emerald-900 px-3 pb-6 pt-10 text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Golf Events
          </p>
          <h1 className="text-xl font-semibold text-white">Events</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && <p className="mt-8 text-center text-sm text-emerald-100">Loading events...</p>}
        {error && <p className="mt-8 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && !error && events.length === 0 && (
          <p className="mt-8 text-center text-sm text-emerald-100">
            No events available yet.
          </p>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-white/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const eventIsToday = isToday(event.eventDate);
                  return (
                    <TableRow
                      key={event.id}
                      className={eventIsToday ? 'bg-green-50' : ''}
                    >
                      <TableCell className="font-medium">
                        {event.name || 'Unnamed Event'}
                      </TableCell>
                      <TableCell>
                        {event.eventDate
                          ? new Date(event.eventDate).toLocaleDateString()
                          : 'No date set'}
                      </TableCell>
                      <TableCell>
                        {eventIsToday && (
                          <Badge className="bg-green-600 text-white hover:bg-green-700">
                            Live Today
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/event/${event.id}`}>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
