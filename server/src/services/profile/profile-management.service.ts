import { isSqlInjectionTargetEnabled } from '../lab/sql-injection-control.service.js';
import * as labImplementation from './profile-management.lab.service.js';
import * as normalImplementation from './profile-management.normal.service.js';
import type { PublicUserProfile, UserProfile } from '../../types/auth/auth.types.js';

/**
 * 프로필 관리 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `profile-management.lab.service`를 사용합니다.
 * - 그 외 기능은 `profile-management.normal.service`를 사용합니다.
 */

export async function findUserProfileById(userId: number): Promise<UserProfile | null> {
  if (isSqlInjectionTargetEnabled('profileLookup')) {
    return labImplementation.findUserProfileById(userId);
  }
  return normalImplementation.findUserProfileById(userId);
}

export async function findPrivateProfileByUsername(username: string): Promise<UserProfile | null> {
  if (isSqlInjectionTargetEnabled('profileLookup')) {
    return labImplementation.findPrivateProfileByUsername(username);
  }
  return normalImplementation.findPrivateProfileByUsername(username);
}

export async function findPublicProfileByUsername(
  username: string
): Promise<PublicUserProfile | null> {
  if (isSqlInjectionTargetEnabled('profileLookup')) {
    return labImplementation.findPublicProfileByUsername(username);
  }
  return normalImplementation.findPublicProfileByUsername(username);
}

export async function updateUserProfile(params: {
  userId: number;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  bio: string | null;
}): Promise<boolean> {
  if (isSqlInjectionTargetEnabled('profileUpdate')) {
    return labImplementation.updateUserProfile(params);
  }
  return normalImplementation.updateUserProfile(params);
}

export async function updateUserProfileImage(params: {
  userId: number;
  profileImageUrl: string | null;
}): Promise<boolean> {
  if (isSqlInjectionTargetEnabled('profileUpdate')) {
    return labImplementation.updateUserProfileImage(params);
  }
  return normalImplementation.updateUserProfileImage(params);
}
