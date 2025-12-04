'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, type Event, type Group, type Member } from '../../../../lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy } from 'lucide-react';

type MemberWithTotalPoints = {
  member: Member;
  totalPoints: number;
  groups: Group[];
};

export default function EventResultsPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [memberPoints, setMemberPoints] = useState<MemberWithTotalPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: eventData, error: eventErr } = await supabase
          .from('event')
          .select('id, name, eventDate')
          .eq('id', eventId)
          .or('isArchived.is.null,isArchived.eq.false')
          .single();

        if (eventErr || !eventData) throw eventErr || new Error('Event not found');
        setEvent(eventData);

        const { data: holesData, error: holesErr } = await supabase
          .from('holes')
          .select('id')
          .eq('eventId', eventId)
          .or('isArchived.is.null,isArchived.eq.false');

        if (holesErr) throw holesErr;

        const holeIds = holesData?.map((h) => h.id) || [];

        if (holeIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: holeGroupsData, error: hgErr } = await supabase
          .from('hole_group')
          .select('holeId, groupId')
          .in('holeId', holeIds);

        if (hgErr) throw hgErr;

        const groupIds = [...new Set(holeGroupsData?.map((hg) => hg.groupId) || [])];
        let groupsData: Group[] = [];
        if (groupIds.length > 0) {
          const { data, error: groupsErr } = await supabase
            .from('group')
            .select('id, name, score, points')
            .in('id', groupIds)
            .or('isArchived.is.null,isArchived.eq.false');

          if (groupsErr) throw groupsErr;
          groupsData = data || [];
        }

        const { data: groupMembersData, error: gmErr } = await supabase
          .from('group_member')
          .select('groupId, memberId')
          .in('groupId', groupIds);

        if (gmErr) throw gmErr;

        const memberIds = [...new Set(groupMembersData?.map((gm) => gm.memberId) || [])];
        let membersData: Member[] = [];
        if (memberIds.length > 0) {
          const { data, error: membersErr } = await supabase
            .from('member')
            .select('id, name, handiCap')
            .in('id', memberIds)
            .or('isArchived.is.null,isArchived.eq.false');

          if (membersErr) throw membersErr;
          membersData = data || [];
        }

        const memberPointsMap = new Map<string, MemberWithTotalPoints>();

        membersData.forEach((member) => {
          memberPointsMap.set(member.id, {
            member,
            totalPoints: 0,
            groups: [],
          });
        });

        groupsData.forEach((group) => {
          const points = group.points || 0;
          if (points > 0) {
            const memberIdsInGroup =
              groupMembersData
                ?.filter((gm) => gm.groupId === group.id)
                .map((gm) => gm.memberId) || [];

            memberIdsInGroup.forEach((memberId) => {
              const memberData = memberPointsMap.get(memberId);
              if (memberData) {
                memberData.totalPoints += points;
                memberData.groups.push(group);
              }
            });
          }
        });

        const sortedMemberPoints = Array.from(memberPointsMap.values()).sort(
          (a, b) => b.totalPoints - a.totalPoints
        );

        setMemberPoints(sortedMemberPoints);
      } catch (err) {
        setError('Could not load results. Please refresh.');
        console.error(err);
      }

      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`group-updates-results-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group',
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  const winner = memberPoints.length > 0 ? memberPoints[0] : null;
  const isTie = memberPoints.length > 1 && memberPoints[0]?.totalPoints === memberPoints[1]?.totalPoints;

  return (
    <div className="flex min-h-screen flex-col bg-emerald-900 px-3 pb-6 pt-10 text-foreground">
      <header className="mb-4">
        <Link href={`/event/${eventId}`}>
          <Button variant="ghost" size="sm" className="mb-2 text-emerald-200 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Button>
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Final Results
          </p>
          <h1 className="text-xl font-semibold text-white">
            {event?.name || 'Loading...'} - Results
          </h1>
          {event?.eventDate && (
            <p className="mt-1 text-sm text-emerald-200">
              {new Date(event.eventDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <p className="mt-8 text-center text-sm text-emerald-100">Loading results...</p>
        )}
        {error && <p className="mt-8 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && !error && memberPoints.length === 0 && (
          <div className="mt-8 rounded-lg border bg-white/95 p-6 text-center">
            <p className="text-sm text-slate-600">No results available yet.</p>
          </div>
        )}

        {!loading && !error && winner && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 p-6 shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <Trophy className="h-12 w-12 text-yellow-500" />
              </div>
              <h2 className="text-center text-2xl font-bold text-slate-900 mb-2">
                {isTie ? 'Winners (Tie)' : 'Winner'}
              </h2>
              {isTie ? (
                <div className="space-y-3">
                  {memberPoints
                    .filter((mp) => mp.totalPoints === winner.totalPoints)
                    .map((mp) => (
                      <div key={mp.member.id} className="text-center">
                        <p className="text-xl font-semibold text-slate-900">{mp.member.name}</p>
                        <p className="text-3xl font-bold text-emerald-600 mt-2">
                          {mp.totalPoints} Points
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-900">{winner.member.name}</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">
                    {winner.totalPoints} Points
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-white/95 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Full Leaderboard</h3>
              <div className="space-y-2">
                {memberPoints.map((mp, index) => (
                  <div
                    key={mp.member.id}
                    className={`rounded-lg border p-3 ${
                      index === 0 && !isTie
                        ? 'border-yellow-400 bg-yellow-50'
                        : index < 3
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            index === 0 && !isTie
                              ? 'bg-yellow-400 text-yellow-900'
                              : index === 1
                                ? 'bg-slate-300 text-slate-700'
                                : index === 2
                                  ? 'bg-amber-300 text-amber-700'
                                  : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{mp.member.name}</p>
                          {mp.member.handiCap !== null && (
                            <p className="text-xs text-slate-500">HCP: {mp.member.handiCap}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">{mp.totalPoints}</p>
                        <p className="text-xs text-slate-500">points</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

