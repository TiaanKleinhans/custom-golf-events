'use client';

import { useEffect, useState } from 'react';
import {
  supabase,
  type Hole,
  type Group,
  type Member,
  type Club,
} from '../../../../../../lib/supabaseClient';
import { useAdmin } from '../../../../../providers';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import { Trash2 } from 'lucide-react';

type GroupWithMembers = Group & {
  members: Member[];
};

export default function HoleEditorPage() {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;
  const holeId = params.holeId as string;

  const [hole, setHole] = useState<Hole | null>(null);
  const [allGroups, setAllGroups] = useState<GroupWithMembers[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<Group[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [assignedClubs, setAssignedClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMembersForNewGroup, setSelectedMembersForNewGroup] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<GroupWithMembers | null>(null);
  const [selectedMembersForEdit, setSelectedMembersForEdit] = useState<string[]>([]);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [archivingGroupId, setArchivingGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data: holeData, error: holeErr } = await supabase
        .from('holes')
        .select('id, eventId, par, name, holeDescription, created_at')
        .eq('id', holeId)
        .single();

      if (holeErr || !holeData) {
        setError('Could not load hole.');
        setLoading(false);
        return;
      }

      setHole(holeData);

      const { data: holeGroupsData } = await supabase
        .from('hole_group')
        .select('groupId')
        .eq('holeId', holeId);

      const assignedGroupIds = holeGroupsData?.map((hg) => hg.groupId) || [];

      let groupsData = null;
      if (assignedGroupIds.length > 0) {
        const { data } = await supabase
          .from('group')
          .select('id, name, score, points')
          .in('id', assignedGroupIds)
          .or('isArchived.is.null,isArchived.eq.false');
        groupsData = data;
      }

      const { data: groupMembersData } = await supabase
        .from('group_member')
        .select('groupId, memberId');

      const { data: membersData } = await supabase
        .from('member')
        .select('id, name, handiCap')
        .or('isArchived.is.null,isArchived.eq.false')
        .order('name', { ascending: true });

      setAllMembers(membersData || []);

      const groupsWithMembers: GroupWithMembers[] = (groupsData || []).map((group) => {
        const memberIds =
          groupMembersData?.filter((gm) => gm.groupId === group.id).map((gm) => gm.memberId) || [];
        const members = membersData?.filter((m) => memberIds.includes(m.id)) || [];
        return { ...group, members };
      });

      setAllGroups(groupsWithMembers);
      setAssignedGroups(groupsData || []);

      const { data: clubsData, error: clubsErr } = await supabase
        .from('club')
        .select('id, name, orderby')
        .or('isArchived.is.null,isArchived.eq.false')
        .order('orderby', { ascending: true, nullsFirst: false });

      if (clubsErr) {
        console.error('Error fetching clubs:', clubsErr);
      }

      const sortedClubs = (clubsData || []).sort((a, b) => {
        if (a.orderby === null && b.orderby === null) return 0;
        if (a.orderby === null) return 1;
        if (b.orderby === null) return -1;
        return (a.orderby || 0) - (b.orderby || 0);
      });

      setAllClubs(sortedClubs);

      const { data: holeClubsData } = await supabase
        .from('hole_club')
        .select('clubId')
        .eq('holeId', holeId);

      const assignedClubIds = holeClubsData?.map((hc) => hc.clubId) || [];
      const assignedClubsList = clubsData?.filter((c) => assignedClubIds.includes(c.id)) || [];
      setAssignedClubs(assignedClubsList);

      setLoading(false);
    };

    void fetchData();
  }, [isAdmin, holeId]);

  const handleSave = async () => {
    if (!hole) return;

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('holes')
        .update({
          name: hole.name,
          par: hole.par,
          holeDescription: hole.holeDescription,
        })
        .eq('id', holeId);

      if (updateError) throw updateError;

      await supabase.from('hole_group').delete().eq('holeId', holeId);
      if (assignedGroups.length > 0) {
        const { error: relError } = await supabase.from('hole_group').insert(
          assignedGroups.map((g) => ({
            holeId: holeId,
            groupId: g.id,
          }))
        );
        if (relError) throw relError;
      }

      await supabase.from('hole_club').delete().eq('holeId', holeId);
      if (assignedClubs.length > 0) {
        const { error: clubError } = await supabase.from('hole_club').insert(
          assignedClubs.map((c) => ({
            holeId: holeId,
            clubId: c.id,
          }))
        );
        if (clubError) throw clubError;
      }

      router.push(`/admin/events/${eventId}/holes`);
    } catch (err) {
      console.error(err);
      setError('There was a problem saving the hole.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    const isAssigned = assignedGroups.some((g) => g.id === groupId);
    if (isAssigned) {
      supabase.from('hole_group').delete().eq('holeId', holeId).eq('groupId', groupId);
      setAssignedGroups(assignedGroups.filter((g) => g.id !== groupId));
      setAllGroups(allGroups.filter((g) => g.id !== groupId));
    }
  };

  const handleToggleClub = (clubId: string) => {
    const isAssigned = assignedClubs.some((c) => c.id === clubId);
    if (isAssigned) {
      setAssignedClubs(assignedClubs.filter((c) => c.id !== clubId));
    } else {
      const club = allClubs.find((c) => c.id === clubId);
      if (club) {
        setAssignedClubs([...assignedClubs, club]);
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    const { data: groupData, error: groupErr } = await supabase
      .from('group')
      .insert({ name: newGroupName, score: null })
      .select('id, name, score, points')
      .single();

    if (groupErr) {
      setError('Could not create group.');
      return;
    }

    const { error: holeGroupErr } = await supabase
      .from('hole_group')
      .insert({ holeId: holeId, groupId: groupData.id });

    if (holeGroupErr) {
      setError('Could not assign group to hole.');
      await supabase.from('group').update({ isArchived: true }).eq('id', groupData.id);
      return;
    }

    if (selectedMembersForNewGroup.length > 0) {
      const { error: memberErr } = await supabase.from('group_member').insert(
        selectedMembersForNewGroup.map((memberId) => ({
          groupId: groupData.id,
          memberId: memberId,
        }))
      );

      if (memberErr) {
        setError('Could not add members to group.');
        await supabase.from('group').update({ isArchived: true }).eq('id', groupData.id);
        return;
      }
    }

    await refreshGroupsData();
    setNewGroupName('');
    setSelectedMembersForNewGroup([]);
    setShowCreateGroup(false);
  };

  const getUnavailableMembers = (): string[] => {
    const unavailableMemberIds: string[] = [];

    allGroups.forEach((group) => {
      group.members.forEach((member) => {
        if (!unavailableMemberIds.includes(member.id)) {
          unavailableMemberIds.push(member.id);
        }
      });
    });

    return unavailableMemberIds;
  };

  const getAvailableMembers = (excludeGroupId?: string): Option[] => {
    const unavailableIds = getUnavailableMembers();

    const filteredUnavailable = excludeGroupId
      ? unavailableIds.filter((id) => {
          const editingGroupMembers = editingGroup?.members.map((m) => m.id) || [];
          return !editingGroupMembers.includes(id);
        })
      : unavailableIds;

    return allMembers
      .filter((member) => !filteredUnavailable.includes(member.id))
      .map((member) => ({
        label: member.name || 'Unnamed Member',
        value: member.id,
      }));
  };

  const handleEditGroup = (group: GroupWithMembers) => {
    setEditingGroup(group);
    setEditingGroupName(group.name || '');
    setSelectedMembersForEdit(group.members.map((m) => m.id));
  };

  const handleArchiveGroup = async () => {
    if (!archivingGroupId) return;

    await supabase.from('hole_group').delete().eq('holeId', holeId).eq('groupId', archivingGroupId);

    const { error: err } = await supabase
      .from('group')
      .update({ isArchived: true })
      .eq('id', archivingGroupId);

    if (err) {
      setError('Could not archive group.');
      console.error(err);
      return;
    }

    await refreshGroupsData();
    setArchivingGroupId(null);
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup) return;

    if (editingGroupName !== (editingGroup.name || '')) {
      const { error: nameErr } = await supabase
        .from('group')
        .update({ name: editingGroupName })
        .eq('id', editingGroup.id);

      if (nameErr) {
        setError('Could not update group name.');
        return;
      }
    }

    await supabase.from('group_member').delete().eq('groupId', editingGroup.id);

    if (selectedMembersForEdit.length > 0) {
      const { error: memberErr } = await supabase.from('group_member').insert(
        selectedMembersForEdit.map((memberId) => ({
          groupId: editingGroup.id,
          memberId: memberId,
        }))
      );

      if (memberErr) {
        setError('Could not update group members.');
        return;
      }
    }

    await refreshGroupsData();
    setEditingGroup(null);
    setEditingGroupName('');
    setSelectedMembersForEdit([]);
  };

  const refreshGroupsData = async () => {
    const { data: holeGroupsData } = await supabase
      .from('hole_group')
      .select('groupId')
      .eq('holeId', holeId);

    const assignedGroupIds = holeGroupsData?.map((hg) => hg.groupId) || [];

    let groupsData = null;
    if (assignedGroupIds.length > 0) {
      const { data } = await supabase
        .from('group')
        .select('id, name, score, points')
        .in('id', assignedGroupIds)
        .or('isArchived.is.null,isArchived.eq.false');
      groupsData = data;
    }

    const { data: groupMembersData } = await supabase
      .from('group_member')
      .select('groupId, memberId');

    const groupsWithMembers: GroupWithMembers[] = (groupsData || []).map((group) => {
      const memberIds =
        groupMembersData?.filter((gm) => gm.groupId === group.id).map((gm) => gm.memberId) || [];
      const members = allMembers.filter((m) => memberIds.includes(m.id)) || [];
      return { ...group, members };
    });

    setAllGroups(groupsWithMembers);
    setAssignedGroups(groupsData || []);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (
      !confirm(
        'Are you sure you want to archive this group? It will be hidden but can be restored later.'
      )
    ) {
      return;
    }

    await supabase.from('hole_group').delete().eq('holeId', holeId).eq('groupId', groupId);

    const { error: err } = await supabase
      .from('group')
      .update({ isArchived: true })
      .eq('id', groupId);

    if (err) {
      setError('Could not archive group.');
      return;
    }

    await refreshGroupsData();
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Admin access required</p>
          <Link href="/admin">
            <Button className="mt-4">Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900">
        <p className="text-sm text-emerald-100">Loading hole...</p>
      </div>
    );
  }

  if (!hole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 text-center shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Hole not found</p>
          <Link href={`/admin/events/${eventId}/holes`}>
            <Button className="mt-4">Back to Holes</Button>
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
          <h1 className="text-xl font-semibold text-white">Edit Hole</h1>
        </div>
        <Link href={`/admin/events/${eventId}/holes`}>
          <Button variant="outline" size="sm">
            Cancel
          </Button>
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto">
        {error && <p className="mt-2 text-center text-sm font-medium text-rose-200">{error}</p>}

        <div className="space-y-6">
          <div className="rounded-lg border bg-white/95 p-4">
            <h2 className="mb-3 text-sm font-semibold">Hole Details</h2>
            <div className="space-y-3">
              <Input
                value={hole.name ?? ''}
                onChange={(e) => setHole({ ...hole, name: e.target.value })}
                placeholder="Hole Name"
              />
              <Input
                type="number"
                value={hole.par ?? ''}
                onChange={(e) =>
                  setHole({ ...hole, par: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Par"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-white/95 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Groups for This Hole</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Groups are specific to this hole only. Each hole has its own groups.
                </p>
              </div>
              <Button onClick={() => setShowCreateGroup(true)} size="sm" variant="outline">
                + Add Group
              </Button>
            </div>
            {allGroups.length === 0 ? (
              <p className="text-sm text-slate-500">No groups available. Create one first.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGroups.map((group) => {
                      return (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">
                            {group.name || 'Unnamed Group'}
                          </TableCell>
                          <TableCell>
                            {group.members.length === 0 ? (
                              <span className="text-sm text-slate-500">No members</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {group.members.map((member) => (
                                  <span
                                    key={member.id}
                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs"
                                  >
                                    {member.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => handleEditGroup(group)}
                                size="sm"
                                variant="outline"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => setArchivingGroupId(group.id)}
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white/95 p-4">
            <h2 className="mb-3 text-sm font-semibold">Allowed Clubs for This Hole</h2>
            {allClubs.length === 0 ? (
              <p className="text-sm text-slate-500">No clubs available.</p>
            ) : (
              <div className="space-y-2">
                {allClubs.map((club) => {
                  const isAssigned = assignedClubs.some((c) => c.id === club.id);
                  return (
                    <div
                      key={club.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => handleToggleClub(club.id)}
                        />
                        <span className="text-sm">{club.name || 'Unnamed Club'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Hole'}
          </Button>
        </div>
      </main>

      <Dialog
        open={showCreateGroup}
        onOpenChange={(open) => {
          setShowCreateGroup(open);
          if (!open) {
            setNewGroupName('');
            setSelectedMembersForNewGroup([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Enter a name and select members for the new group. Members already in other groups for
              this hole are not available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Members</label>
              <MultiSelect
                options={getAvailableMembers()}
                selected={selectedMembersForNewGroup}
                onChange={setSelectedMembersForNewGroup}
                placeholder="Select members..."
              />
              {getUnavailableMembers().length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {getUnavailableMembers().length} member(s) are already assigned to other groups in
                  this hole and cannot be selected.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateGroup(false);
                setNewGroupName('');
                setSelectedMembersForNewGroup([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGroup(null);
            setEditingGroupName('');
            setSelectedMembersForEdit([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group name and members. Members already in other groups for this hole are not
              available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                placeholder="Group Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Members</label>
              <MultiSelect
                options={getAvailableMembers(editingGroup?.id)}
                selected={selectedMembersForEdit}
                onChange={setSelectedMembersForEdit}
                placeholder="Select members..."
              />
              {getUnavailableMembers().length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {getUnavailableMembers().length} member(s) are already assigned to other groups in
                  this hole and cannot be selected.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingGroup(null);
                setEditingGroupName('');
                setSelectedMembersForEdit([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGroupEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archivingGroupId} onOpenChange={(open) => !open && setArchivingGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this group? It will be hidden from this hole but can
              be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivingGroupId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveGroup}>
              <Trash2 className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
