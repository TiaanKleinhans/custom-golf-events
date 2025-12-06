'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  supabase,
  type Event,
  type Hole,
  type Group,
  type Member,
  type Club,
} from '../../../lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, BarChart3, Grid3x3, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

type MemberScoreData = {
  memberId: string;
  memberName: string;
  scores: { hole: string; cumulativeScore: number }[];
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !label) return null;
  const sortedPayload = [...payload].sort((a, b) => {
    const aValue = a.value as number;
    const bValue = b.value as number;
    return bValue - aValue;
  });

  return (
    <div className="rounded-lg border-2 border-emerald-500 bg-white p-3 shadow-lg">
      <p className="mb-2 font-semibold text-slate-900">{label}</p>
      <div className="space-y-1">
        {sortedPayload.map((entry, index) => {
          const value = entry.value as number;
          const color = entry.color || '#6b7280';
          let rankLabel = '';

          if (index === 0) rankLabel = '1st';
          else if (index === 1) rankLabel = '2nd';
          else if (index === 2) rankLabel = '3rd';

          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-medium text-slate-700">{entry.name}:</span>
              <span className="font-semibold text-slate-900">{value}</span>
              {rankLabel && (
                <span className="ml-auto rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {rankLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [memberScores, setMemberScores] = useState<MemberScoreData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, Member[]>>({});
  const [holeGroupsData, setHoleGroupsData] = useState<{ holeId: string; groupId: string }[]>([]);
  const [currentHoleClubs, setCurrentHoleClubs] = useState<Club[]>([]);
  const [viewMode, setViewMode] = useState<'chart' | 'holes'>('chart');
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
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
        .select('id, eventId, par, name, holeDescription, created_at')
        .eq('eventId', eventId)
        .or('isArchived.is.null,isArchived.eq.false')
        .order('name', { ascending: true, nullsFirst: false });

      if (holesErr) throw holesErr;
      setHoles(holesData || []);

      if (!holesData || holesData.length === 0) {
        setLoading(false);
        return;
      }

      const holeIds = holesData.map((h) => h.id);
      const { data: holeGroupsDataResult, error: hgErr } = await supabase
        .from('hole_group')
        .select('holeId, groupId')
        .in('holeId', holeIds);

      if (hgErr) throw hgErr;
      const holeGroupsDataArray = holeGroupsDataResult || [];
      setHoleGroupsData(holeGroupsDataArray);

      const groupIds = [...new Set(holeGroupsDataArray.map((hg) => hg.groupId) || [])];
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
      setGroups(groupsData);

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

      // Map group members
      const groupMembersMap: Record<string, Member[]> = {};
      groupIds.forEach((groupId) => {
        const memberIdsForGroup =
          groupMembersData?.filter((gm) => gm.groupId === groupId).map((gm) => gm.memberId) || [];
        const members = membersData.filter((m) => memberIdsForGroup.includes(m.id));
        groupMembersMap[groupId] = members;
      });
      setGroupMembers(groupMembersMap);

      const memberScoresMap = new Map<string, MemberScoreData>();

      membersData.forEach((member) => {
        memberScoresMap.set(member.id, {
          memberId: member.id,
          memberName: member.name || 'Unknown',
          scores: [],
        });
      });

      holesData.forEach((hole, holeIndex) => {
        const groupsForHole = holeGroupsDataArray
          .filter((hg) => hg.holeId === hole.id)
          .map((hg) => {
            const group = groupsData.find((g) => g.id === hg.groupId);
            return group ? { ...group, holeGroupId: hg.groupId } : null;
          })
          .filter((g) => g !== null) as (Group & { holeGroupId: string })[];

        const processedMembers = new Set<string>();

        groupsForHole.forEach((group) => {
          const groupPoints = group.points || 0;

          const membersInGroup =
            groupMembersData?.filter((gm) => gm.groupId === group.id).map((gm) => gm.memberId) ||
            [];

          membersInGroup.forEach((memberId) => {
            const memberData = memberScoresMap.get(memberId);
            if (memberData) {
              const previousPoints =
                memberData.scores.length > 0
                  ? memberData.scores[memberData.scores.length - 1].cumulativeScore
                  : 0;

              const newCumulativePoints = previousPoints + groupPoints;

              memberData.scores.push({
                hole: hole.name || `Hole ${holeIndex + 1}`,
                cumulativeScore: newCumulativePoints,
              });

              processedMembers.add(memberId);
            }
          });
        });

        membersData.forEach((member) => {
          if (!processedMembers.has(member.id)) {
            const memberData = memberScoresMap.get(member.id);
            if (memberData) {
              const previousPoints =
                memberData.scores.length > 0
                  ? memberData.scores[memberData.scores.length - 1].cumulativeScore
                  : 0;
              memberData.scores.push({
                hole: hole.name || `Hole ${holeIndex + 1}`,
                cumulativeScore: previousPoints,
              });
            }
          }
        });
      });

      setMemberScores(Array.from(memberScoresMap.values()));
    } catch (err) {
      setError('Could not load event data. Please refresh.');
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, [eventId]);

  useEffect(() => {
    if (!eventId || groups.length === 0) return;

    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) return;

    const channel = supabase
      .channel(`group-updates-event-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group',
          filter: `id=in.(${groupIds.join(',')})`,
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, groups.map((g) => g.id).join(',')]);

  useEffect(() => {
    if (viewMode === 'holes' && holes.length > 0 && currentHoleIndex < holes.length) {
      const fetchClubsForHole = async () => {
        const currentHole = holes[currentHoleIndex];
        if (!currentHole) return;

        const { data: holeClubsData } = await supabase
          .from('hole_club')
          .select('clubId')
          .eq('holeId', currentHole.id);

        const clubIds = holeClubsData?.map((hc) => hc.clubId) || [];
        let clubsData: Club[] = [];
        if (clubIds.length > 0) {
          const { data, error: clubsErr } = await supabase
            .from('club')
            .select('id, name, orderby')
            .in('id', clubIds)
            .or('isArchived.is.null,isArchived.eq.false')
            .order('orderby', { ascending: true, nullsFirst: false });

          if (clubsErr) {
            console.error('Error fetching clubs:', clubsErr);
          } else {
            clubsData = data || [];
          }
        }
        setCurrentHoleClubs(clubsData);
      };

      void fetchClubsForHole();
    }
  }, [viewMode, currentHoleIndex, holes]);

  const sortedMemberScores = [...memberScores].sort((a, b) => {
    const aFinal = a.scores.length > 0 ? a.scores[a.scores.length - 1].cumulativeScore : 0;
    const bFinal = b.scores.length > 0 ? b.scores[b.scores.length - 1].cumulativeScore : 0;
    return bFinal - aFinal;
  });

  const chartData = holes.map((hole, index) => {
    const dataPoint: Record<string, string | number> = {
      hole: hole.name || `Hole ${index + 1}`,
    };

    sortedMemberScores.forEach((memberScore) => {
      const scoreForHole = memberScore.scores[index];
      dataPoint[memberScore.memberName] = scoreForHole ? scoreForHole.cumulativeScore : 0;
    });

    return dataPoint;
  });

  const colors = [
    '#10b981', // emerald-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
    '#a855f7', // purple-500
    '#22c55e', // green-500
    '#eab308', // yellow-500
    '#06b6d4', // sky-500
    '#f43f5e', // rose-500
  ];

  return (
    <div className="flex min-h-screen flex-col bg-emerald-900 px-3 pb-6 pt-10 text-foreground">
      <header className="mb-4">
        <Link href="/event">
          <Button variant="ghost" size="sm" className="mb-2 text-emerald-200 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Event Details
          </p>
          <h1 className="text-xl font-semibold text-white">{event?.name || 'Loading...'}</h1>
          {event?.eventDate && (
            <p className="mt-1 text-sm text-emerald-200">
              {new Date(event.eventDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <p className="mt-8 text-center text-sm text-emerald-100">Loading event data...</p>
        )}
        {error && <p className="mt-8 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && !error && holes.length === 0 && (
          <div className="mt-8 rounded-lg border bg-white/95 p-6 text-center">
            <p className="text-sm text-slate-600">No holes configured for this event yet.</p>
          </div>
        )}

        {!loading && !error && holes.length > 0 && memberScores.length === 0 && (
          <div className="mt-8 rounded-lg border bg-white/95 p-6 text-center">
            <p className="text-sm text-slate-600">No members or scores available yet.</p>
          </div>
        )}

        {!loading && !error && memberScores.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border bg-white/95 p-2">
              <Button
                onClick={() => setViewMode('chart')}
                variant={viewMode === 'chart' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Chart View
              </Button>
              <Button
                onClick={() => setViewMode('holes')}
                variant={viewMode === 'holes' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
              >
                <Grid3x3 className="mr-2 h-4 w-4" />
                Hole View
              </Button>
            </div>

            {viewMode === 'chart' && (
              <div className="rounded-lg border bg-white/95 p-4">
                <h2 className="mb-4 text-base font-semibold text-slate-900">
                  Points Progression by Member
                </h2>
                <div className="w-full overflow-x-auto -mx-2 px-2">
                  <ResponsiveContainer width="100%" height={450} minWidth={350}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="hole"
                        stroke="#6b7280"
                        style={{ fontSize: '14px', fontWeight: '500' }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={0}
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '14px', fontWeight: '500' }}
                        width={40}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '13px', paddingTop: '20px', fontWeight: '500' }}
                        iconType="line"
                        iconSize={16}
                      />
                      {sortedMemberScores.map((memberScore, index) => (
                        <Line
                          key={memberScore.memberId}
                          type="monotone"
                          dataKey={memberScore.memberName}
                          stroke={colors[index % colors.length]}
                          strokeWidth={3}
                          dot={{ r: 5, fill: colors[index % colors.length] }}
                          activeDot={{ r: 8, strokeWidth: 2 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {viewMode === 'holes' && holes.length > 0 && (
              <div className="space-y-4">
                {(() => {
                  const currentHole = holes[currentHoleIndex];
                  if (!currentHole) return null;

                  const holeGroupIds =
                    holeGroupsData
                      ?.filter((hg) => hg.holeId === currentHole.id)
                      .map((hg) => hg.groupId) || [];
                  const holeGroups = groups.filter((g) => holeGroupIds.includes(g.id));

                  const sortedGroups = [...holeGroups].sort((a, b) => {
                    const pointsA = a.points ?? null;
                    const pointsB = b.points ?? null;
                    if (pointsA === null && pointsB === null) return 0;
                    if (pointsA === null) return 1;
                    if (pointsB === null) return -1;
                    return pointsB - pointsA;
                  });

                  const winner =
                    sortedGroups.length > 0 && sortedGroups[0].points !== null
                      ? sortedGroups[0]
                      : null;
                  const isTie =
                    sortedGroups.length > 1 &&
                    sortedGroups[0].points !== null &&
                    sortedGroups[0].points === sortedGroups[1]?.points;

                  return (
                    <div className="rounded-lg border bg-white/95 p-4">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-slate-900">
                          {currentHole.name || 'Unnamed Hole'}
                        </h3>
                        {currentHole.par !== null && (
                          <p className="text-sm text-slate-500">Par: {currentHole.par}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Hole {currentHoleIndex + 1} of {holes.length}
                        </p>
                        {currentHoleClubs.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                              Allowed Clubs:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {currentHoleClubs.map((club) => (
                                <span
                                  key={club.id}
                                  className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                                >
                                  {club.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {holeGroups.length === 0 ? (
                        <p className="text-sm text-slate-500">No teams assigned to this hole.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Team</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead className="text-right">Score</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedGroups.map((group, index) => {
                                const members = groupMembers[group.id] || [];
                                const isWinner = winner && group.id === winner.id && !isTie;
                                const isTiedWinner =
                                  isTie &&
                                  index < sortedGroups.length &&
                                  sortedGroups[index].points === sortedGroups[0].points;

                                return (
                                  <TableRow
                                    key={group.id}
                                    className={isWinner || isTiedWinner ? 'bg-yellow-50' : ''}
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {(isWinner || isTiedWinner) && (
                                          <Trophy className="h-4 w-4 text-yellow-600" />
                                        )}
                                        {group.name}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                      {members.map((m) => m.name).join(', ') || 'No members'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {group.score !== null ? (
                                        <span className="font-semibold">{group.score}</span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {group.points !== null ? (
                                        <span className="font-semibold text-emerald-600">
                                          {group.points} pts
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={() => setCurrentHoleIndex(Math.max(0, currentHoleIndex - 1))}
                          disabled={currentHoleIndex === 0}
                          variant="outline"
                          className="flex-1"
                        >
                          <ChevronLeft className="mr-2 h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          onClick={() =>
                            setCurrentHoleIndex(Math.min(holes.length - 1, currentHoleIndex + 1))
                          }
                          disabled={currentHoleIndex === holes.length - 1}
                          variant="outline"
                          className="flex-1"
                        >
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {!loading && !error && holes.length > 0 && (
          <div className="mt-4">
            <Link href={`/event/${eventId}/results`}>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                View Final Results
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
