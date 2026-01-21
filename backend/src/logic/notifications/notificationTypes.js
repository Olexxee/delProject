export const NotificationTypes = {
  // Buddy / Connections
  BUDDY_REQUEST: "buddyRequest",
  BUDDY_ACCEPTED: "buddyAccepted",
  USER_BLOCKED: "userBlocked",
  USER_UNBLOCKED: "userUnblocked",
  CONNECTION_REMOVED: "connectionRemoved",

  // Group / Community
  GROUP_CREATED: "groupCreated",
  MEMBER_JOINED: "memberJoined",
  MEMBER_LEFT: "memberLeft",
  MEMBER_REMOVED: "memberRemoved",
  MEMBER_ROLE_CHANGED: "memberRoleChanged",

  // Store / Marketplace
  STORE_CREATED: "storeCreated",
  STORE_UPDATED: "storeUpdated",
  STORE_DEACTIVATED: "storeDeactivated",
  STORE_REACTIVATED: "storeReactivated",
  STORE_DELETED: "storeDeleted",
  NEW_ITEM: "newItem",

  // Game Matches
  MATCH_CREATED: "matchCreated",
  MATCH_FOUND: "matchFound",
  MATCH_BLOCKED: "matchBlocked",

  // Bump / Boosts
  BUMP_CREATED: "bumpCreated",
  BUMP_ACTIVATED: "bumpActivated",
  BUMP_EXPIRED: "bumpExpired",
  BUMP_ANALYTICS_REPORT: "bumpAnalyticsReport",

  // Upgrades / Premium Features
  UPGRADE_PROMPT: "upgradePrompt",
  FEATURE_UPGRADE_PROMPT: "featureUpgradePrompt",
  SUCCESS_UPGRADE_PROMPT: "successUpgradePrompt",

  // User Auth
  USER_REGISTERED: "userRegistered",
  USER_SOCIAL_REGISTERED: "userSocialRegistered",
  VERIFICATION_SENT: "verificationSent",
  USER_VERIFIED: "userVerified",
  PASSWORD_CHANGED: "passwordChanged",
  PASSWORD_RESET_REQUESTED: "passwordResetRequested",
  PASSWORD_RESET_SUCCESS: "passwordResetSuccess",

  // Account Lifecycle
  ACCOUNT_DELETED: "accountDeleted",
  ACCOUNT_PAUSED: "accountPaused",
  ACCOUNT_REACTIVATED: "accountReactivated",
  ACCOUNT_DELETION_REQUESTED: "accountDeletionRequested",
  ACCOUNT_PERMANENTLY_DELETED: "accountPermanentlyDeleted",

  // System Alerts
  SYSTEM_ALERT: "systemAlert",
  CHAT_MESSAGE: "chatMessage",
};
