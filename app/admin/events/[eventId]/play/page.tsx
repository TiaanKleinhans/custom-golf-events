'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  supabase,
  type Event,
  type Hole,
  type Group,
  type Member,
  type Club,
} from '../../../../../lib/supabaseClient';
import { useAdmin } from '../../../../providers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

type GroupWithMembers = Group & {
  members: Member[];
};

export default function PlayPage() {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [currentHole, setCurrentHole] = useState<Hole | null>(null);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groupScores, setGroupScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch event
        const { data: eventData, error: eventErr } = await supabase
          .from('event')
          .select('id, name, eventDate')
          .eq('id', eventId)
          .single();

        if (eventErr) throw eventErr;
        setEvent(eventData);

        // Fetch holes ordered by created_at
        const { data: holesData, error: holesErr } = await supabase
          .from('holes')
          .select('id, eventId, par, name, holeDescription, created_at')
          .eq('eventId', eventId)
          .or('isArchived.is.null,isArchived.eq.false')
          .order('created_at', { ascending: true });

        if (holesErr) throw holesErr;
        setHoles(holesData || []);

        if (holesData && holesData.length > 0) {
          setCurrentHole(holesData[0]);
          await loadHoleData(holesData[0].id);
        }
      } catch (err) {
        setError('Could not load event data.');
        // eslint-disable-next-line no-console
        console.error(err);
      }

      setLoading(false);
    };

    void fetchData();
  }, [isAdmin, eventId]);

  const loadHoleData = async (holeId: string) => {
    try {
      // Fetch clubs assigned to this hole
      const { data: holeClubsData } = await supabase
        .from('hole_club')
        .select('clubId')
        .eq('holeId', holeId);

      const clubIds = holeClubsData?.map((hc) => hc.clubId) || [];
      let clubsData: Club[] = [];
      if (clubIds.length > 0) {
        const { data, error: clubsErr } = await supabase
          .from('club')
          .select('id, name, orderby')
          .in('id', clubIds)
          .or('isArchived.is.null,isArchived.eq.false')
          .order('orderby', { ascending: true, nullsFirst: false });

        if (clubsErr) throw clubsErr;
        clubsData = data || [];
      }
      setClubs(clubsData);

      // Fetch groups assigned to this hole
      const { data: holeGroupsData } = await supabase
        .from('hole_group')
        .select('groupId')
        .eq('holeId', holeId);

      const groupIds = holeGroupsData?.map((hg) => hg.groupId) || [];
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

      // Fetch group members
      const { data: groupMembersData } = await supabase
        .from('group_member')
        .select('groupId, memberId')
        .in('groupId', groupIds);

      // Fetch members
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

      // Combine groups with members
      const groupsWithMembers: GroupWithMembers[] = groupsData.map((group) => {
        const memberIdsForGroup =
          groupMembersData?.filter((gm) => gm.groupId === group.id).map((gm) => gm.memberId) || [];
        const members = membersData.filter((m) => memberIdsForGroup.includes(m.id));
        return { ...group, members };
      });

      setGroups(groupsWithMembers);

      // Initialize scores from group.score
      const scores: Record<string, number | null> = {};
      groupsData.forEach((group) => {
        scores[group.id] = group.score;
      });
      setGroupScores(scores);
      isInitialLoad.current = true;
      // Reset flag after a brief delay to allow auto-save to work on user input
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    } catch (err) {
      setError('Could not load hole data.');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentHole) {
      void loadHoleData(currentHole.id);
    }
  }, [currentHole]);

  // Auto-save when scores change (with debounce)
  useEffect(() => {
    if (!currentHole || saving || isInitialLoad.current) return;

    // Check if there are any scores entered
    const hasScores = Object.values(groupScores).some(
      (score) => score !== null && score !== undefined
    );
    if (!hasScores) return;

    // Debounce auto-save - wait 1 second after last change
    const timeoutId = setTimeout(() => {
      void handleSaveScores();
    }, 1000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupScores, currentHole]);

  const handleScoreChange = (groupId: string, value: string) => {
    const numValue = value === '' ? null : Number(value);
    if (numValue !== null && (numValue < 1 || numValue > 20)) {
      return; // Invalid score range
    }
    setGroupScores({ ...groupScores, [groupId]: numValue });
  };

  const calculatePoints = () => {
    // Get groups with scores
    const groupsWithScores = groups
      .map((group) => ({
        ...group,
        score: groupScores[group.id] ?? null,
      }))
      .filter((g) => g.score !== null) as (GroupWithMembers & { score: number })[];

    if (groupsWithScores.length === 0) {
      return {};
    }

    // Sort by score (ascending - lower is better in golf)
    groupsWithScores.sort((a, b) => a.score - b.score);

    // Calculate points based on ties
    const pointsMap: Record<string, number> = {};
    const pointValues = [4, 3, 2, 1]; // 1st, 2nd, 3rd, 4th place points

    // If all groups are tied for first, they all get 4 points
    if (groupsWithScores.length > 0) {
      const firstScore = groupsWithScores[0].score;
      const allTied = groupsWithScores.every((g) => g.score === firstScore);
      if (allTied) {
        groupsWithScores.forEach((group) => {
          pointsMap[group.id] = 4;
        });
        return pointsMap;
      }
    }

    let currentPosition = 0;
    let i = 0;

    while (i < groupsWithScores.length) {
      const currentScore = groupsWithScores[i].score;
      const tiedGroups: (GroupWithMembers & { score: number })[] = [];

      // Find all groups with the same score
      while (i < groupsWithScores.length && groupsWithScores[i].score === currentScore) {
        tiedGroups.push(groupsWithScores[i]);
        i++;
      }

      // Calculate points for this position
      // If tied for first (position 0), all get 4 points
      // If tied for second (position 1), all get 3 points
      // If tied for third (position 2), all get 2 points
      // If tied for fourth or lower (position 3+), all get 1 point
      const pointsForPosition =
        currentPosition === 0 ? 4 : currentPosition === 1 ? 3 : currentPosition === 2 ? 2 : 1;

      // Assign points to all tied groups
      tiedGroups.forEach((group) => {
        pointsMap[group.id] = pointsForPosition;
      });

      // Move to next position (skip all tied positions)
      currentPosition += tiedGroups.length;
    }

    return pointsMap;
  };

  const handleSaveScores = async () => {
    if (!currentHole) return;

    setSaving(true);
    setError(null);

    try {
      const pointsMap = calculatePoints();

      // Save scores and update group totals
      // Update each group with score and points
      for (const group of groups) {
        const score = groupScores[group.id];
        const points = pointsMap[group.id] || null;

        // Update group with score (golf score 1-10) and points (calculated points 1-4)
        const { error: groupErr } = await supabase
          .from('group')
          .update({
            score: score ?? null, // Golf score for this hole
            points: points ?? null, // Calculated points for this hole
          })
          .eq('id', group.id);

        if (groupErr) {
          throw new Error(`Failed to update group ${group.name}: ${groupErr.message}`);
        }
      }

      // Refresh data
      await loadHoleData(currentHole.id);
    } catch (err) {
      setError('Could not save scores.');
      // eslint-disable-next-line no-console
      console.error(err);
    }

    setSaving(false);
  };

  const handlePrevious = async () => {
    if (currentHoleIndex > 0) {
      // Save current scores before navigating
      await handleSaveScores();
      const newIndex = currentHoleIndex - 1;
      setCurrentHoleIndex(newIndex);
      setCurrentHole(holes[newIndex]);
    }
  };

  const handleNext = async () => {
    if (currentHoleIndex < holes.length - 1) {
      // Save current scores before navigating
      await handleSaveScores();
      const newIndex = currentHoleIndex + 1;
      setCurrentHoleIndex(newIndex);
      setCurrentHole(holes[newIndex]);
    }
  };

  const handleHoleSelect = async (holeIndex: string) => {
    const index = parseInt(holeIndex, 10);
    if (index !== currentHoleIndex && index >= 0 && index < holes.length) {
      // Save current scores before navigating
      await handleSaveScores();
      setCurrentHoleIndex(index);
      setCurrentHole(holes[index]);
    }
  };

  const pointsMap = calculatePoints();

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
      <header className="mb-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-2 text-emerald-200 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Play Event
          </p>
          <h1 className="text-xl font-semibold text-white">
            {event?.name || 'Event'} - {currentHole?.name || 'Loading...'}
          </h1>
          <p className="mt-1 text-sm text-emerald-200">
            Hole {currentHoleIndex + 1} of {holes.length}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <p className="mt-8 text-center text-sm text-emerald-100">Loading hole data...</p>
        )}
        {error && <p className="mt-8 text-center text-sm font-medium text-rose-200">{error}</p>}

        {!loading && currentHole && (
          <div className="space-y-4">
            {/* Available Clubs */}
            {clubs.length > 0 && (
              <div className="rounded-lg border bg-white/95 p-4">
                <h2 className="mb-3 text-sm font-semibold">Available Clubs</h2>
                <div className="flex flex-wrap gap-2">
                  {clubs.map((club) => (
                    <span
                      key={club.id}
                      className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                    >
                      {club.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Teams and Scores */}
            <div className="rounded-lg border bg-white/95 p-4">
              <h2 className="mb-3 text-sm font-semibold">Teams & Scores</h2>
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">No teams assigned to this hole.</p>
              ) : (
                <div className="space-y-3">
                  {groups
                    .sort((a, b) => {
                      const pointsA = pointsMap[a.id] ?? null;
                      const pointsB = pointsMap[b.id] ?? null;
                      // Sort by points descending (highest first)
                      // If points are null, put them at the end
                      if (pointsA === null && pointsB === null) return 0;
                      if (pointsA === null) return 1;
                      if (pointsB === null) return -1;
                      return pointsB - pointsA;
                    })
                    .map((group) => {
                      const score = groupScores[group.id] ?? null;
                      const points = pointsMap[group.id] ?? null;
                      return (
                        <div
                          key={group.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{group.name}</p>
                              <p className="text-xs text-slate-500">
                                {group.members.map((m) => m.name).join(', ')}
                              </p>
                            </div>
                            {points !== null && (
                              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                                {points} pts
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600">Score:</label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={score ?? ''}
                              onChange={(e) => handleScoreChange(group.id, e.target.value)}
                              placeholder="score"
                              className="w-20"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Hole Navigation Dropdown */}
            <div className="mb-3">
              <Select value={currentHoleIndex.toString()} onValueChange={handleHoleSelect}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue>
                    {currentHole
                      ? `${currentHole.name || `Hole ${currentHoleIndex + 1}`} (${
                          currentHoleIndex + 1
                        } of ${holes.length})`
                      : 'Select Hole'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {holes.map((hole, index) => (
                    <SelectItem key={hole.id} value={index.toString()}>
                      {hole.name || `Hole ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handlePrevious}
                disabled={currentHoleIndex === 0}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={handleSaveScores}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? 'Saving...' : 'Save Scores'}
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentHoleIndex === holes.length - 1}
                variant="outline"
                className="flex-1"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
