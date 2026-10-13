/**
 * Platform Abstraction Layer for Tauri 2 Integration
 *
 * Prepares the CareerOs frontend architecture for future native deployment
 * across Windows, macOS, Android, and iOS without coupling UI components to native runtime.
 */

export type PlatformType = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

export interface PlatformInfo {
  isNative: boolean;
  platform: PlatformType;
  supportsWindowControls: boolean;
  supportsHaptics: boolean;
  version: string;
}

/**
 * Detect runtime platform safely in both Web and Tauri 2 environments.
 */
export function getPlatformInfo(): PlatformInfo {
  const isTauri =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';

  let platform: PlatformType = 'web';
  if (/android/.test(userAgent)) {
    platform = 'android';
  } else if (/iphone|ipad|ipod/.test(userAgent)) {
    platform = 'ios';
  } else if (/mac/.test(userAgent)) {
    platform = 'macos';
  } else if (/win/.test(userAgent)) {
    platform = 'windows';
  } else if (/linux/.test(userAgent)) {
    platform = 'linux';
  }

  return {
    isNative: isTauri,
    platform,
    supportsWindowControls:
      isTauri && (platform === 'windows' || platform === 'macos' || platform === 'linux'),
    supportsHaptics: isTauri && (platform === 'android' || platform === 'ios'),
    version: '1.0.0',
  };
}

export const currentPlatform = getPlatformInfo();
