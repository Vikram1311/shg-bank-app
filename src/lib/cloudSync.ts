import { supabase, isCloudSyncEnabled } from './supabase';
import type { Member, Loan, Contribution, PenaltyRecord, Notification, AppSettings } from '../types';

export interface SyncableState {
  members: Member[];
  loans: Loan[];
  contributions: Contribution[];
  penalties: PenaltyRecord[];
  notifications: Notification[];
  settings: AppSettings;
}

/**
 * Push the current app state to Supabase cloud.
 * Uses upsert on a single row (id='main') in the `app_state` table.
 */
export async function pushToCloud(state: SyncableState): Promise<{ success: boolean; error?: string }> {
  if (!isCloudSyncEnabled() || !supabase) {
    return { success: false, error: 'Cloud sync not configured' };
  }

  try {
    // Strip profilePhoto from members to reduce payload size
    const membersWithoutPhotos = state.members.map(({ profilePhoto, ...rest }) => rest);

    const payload = {
      members: membersWithoutPhotos,
      loans: state.loans,
      contributions: state.contributions,
      penalties: state.penalties,
      notifications: state.notifications,
      settings: state.settings,
    };

    const { error } = await supabase
      .from('app_state')
      .upsert({
        id: 'main',
        state: payload,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Cloud push failed:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Cloud push error:', message);
    return { success: false, error: message };
  }
}

/**
 * Pull the latest app state from Supabase cloud.
 * Returns the state if found, or null if not available.
 */
export async function pullFromCloud(): Promise<{ success: boolean; data?: SyncableState; error?: string }> {
  if (!isCloudSyncEnabled() || !supabase) {
    return { success: false, error: 'Cloud sync not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state')
      .eq('id', 'main')
      .single();

    if (error) {
      // PGRST116 means no rows found - not really an error for first use
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined };
      }
      console.error('Cloud pull failed:', error.message);
      return { success: false, error: error.message };
    }

    if (data?.state) {
      return { success: true, data: data.state as SyncableState };
    }

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Cloud pull error:', message);
    return { success: false, error: message };
  }
}
