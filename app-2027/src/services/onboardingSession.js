// Reuse a completed profile; only route to setup when a required piece is missing.
export const REQUIRE_PROFILE_SETUP_EVERY_LAUNCH = false;

let completedInThisLaunch = false;

export function markProfileSetupComplete() {
  completedInThisLaunch = true;
}

export function didCompleteProfileSetupThisLaunch() {
  return completedInThisLaunch;
}

export function isPlayerSetupComplete(profile) {
  const favoriteTeam = profile?.favoriteTeam;
  const hasFavoriteTeam = Boolean(favoriteTeam && typeof favoriteTeam === 'object' && (favoriteTeam.id || favoriteTeam.espnId) && favoriteTeam.name);
  const hasShield = Boolean(profile?.shieldConfig && typeof profile.shieldConfig === 'object');
  const hasAvatar = Boolean(Array.isArray(profile?.avatarConfig?.parts) && profile.avatarConfig.parts.length);
  return profile?.onboardingComplete === true
    && Boolean(String(profile?.name || '').trim())
    && Boolean(String(profile?.customTeamName || '').trim())
    && hasFavoriteTeam
    && Boolean(profile.formulaDepreTeamId)
    && hasShield
    && hasAvatar;
}
