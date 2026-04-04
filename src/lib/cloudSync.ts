import { supabase, isCloudSyncEnabled } from './supabase';
import type { Member, Loan, Contribution, PenaltyRecord, Notification, AppSettings } from '../types';

interface CloudData {
  members: Member[];
  loans: Loan[];
  contributions: Contribution[];
  penalties: PenaltyRecord[];
  notifications: Notification[];
  settings: AppSettings;
}

type SyncableState = CloudData & {
  currentUserId: string | null;
  language: string;
};

let pushTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export async function pullFromCloud(): Promise<CloudData | null> {
  if (!isCloudSyncEnabled() || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('members, loans, contributions, penalties, notifications, settings')
      .eq('id', 'main')
      .single();

    if (error) {
      console.error('[CloudSync] Pull error:', error.message);
      return null;
    }

    if (!data) return null;

    return {
      members: (data.members as Member[]) || [],
      loans: (data.loans as Loan[]) || [],
      contributions: (data.contributions as Contribution[]) || [],
      penalties: (data.penalties as PenaltyRecord[]) || [],
      notifications: (data.notifications as Notification[]) || [],
      settings: (data.settings as AppSettings) || {},
    };
  } catch (err) {
    console.error('[CloudSync] Pull failed:', err);
    return null;
  }
}

export async function pushToCloud(state: SyncableState): Promise<boolean> {
  if (!isCloudSyncEnabled() || !supabase) return false;

  try {
    // Strip profilePhoto from members to reduce payload size
    const membersWithoutPhotos = state.members.map(({ profilePhoto: _profilePhoto, ...rest }) => rest);

    const { error } = await supabase
      .from('app_data')
      .upsert({
        id: 'main',
        members: membersWithoutPhotos,
        loans: state.loans,
        contributions: state.contributions,
        penalties: state.penalties,
        notifications: state.notifications,
        settings: state.settings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[CloudSync] Push error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[CloudSync] Push failed:', err);
    return false;
  }
}

export function debouncedPushToCloud(state: SyncableState): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToCloud(state);
  }, DEBOUNCE_MS);
}

export function mergeCloudData(
  localMembers: Member[],
  cloudData: CloudData
): CloudData & { members: Member[] } {
  // Merge members: keep local profilePhoto, update everything else from cloud
  const mergedMembers = cloudData.members.map(cloudMember => {
    const localMember = localMembers.find(m => m.id === cloudMember.id);
    return {
      ...cloudMember,
      profilePhoto: localMember?.profilePhoto || cloudMember.profilePhoto,
    };
  });

  return {
    members: mergedMembers,
    loans: cloudData.loans,
    contributions: cloudData.contributions,
    penalties: cloudData.penalties,
    notifications: cloudData.notifications,
    settings: cloudData.settings,
  };
}
