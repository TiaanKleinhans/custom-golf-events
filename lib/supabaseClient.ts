import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

export type Event = {
  id: string;
  name: string | null;
  eventDate: string | null;
};

export type Hole = {
  id: string;
  eventId: string | null;
  par: number | null;
  name: string | null;
  holeDescription: string | null;
  created_at: string | null;
};

export type Group = {
  id: string;
  name: string | null;
  score: number | null;
  points: number | null;
};

export type Member = {
  id: string;
  name: string | null;
  handiCap: number | null;
};

export type HoleGroup = {
  id: string;
  holeId: string;
  groupId: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  memberId: string;
};

export type EventWithHoles = Event & {
  holes: Hole[];
};

export type GroupWithMembers = Group & {
  members: Member[];
};

export type HoleWithGroups = Hole & {
  groups: Group[];
};

export type Club = {
  id: string;
  name: string | null;
  orderby: number | null;
};

export type HoleScore = {
  id: string;
  holeId: string;
  groupId: string;
  score: number | null;
  isArchived: boolean | null;
};
