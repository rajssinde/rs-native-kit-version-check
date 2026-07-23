import type { UpdateInfo } from './UpdateInfo';

export const ActionType = {
  NO_ACTION: 'NO_ACTION',
  FORCE_UPDATE: 'FORCE_UPDATE',
  SOFT_UPDATE: 'SOFT_UPDATE',
  OPTIONAL_REMINDER: 'OPTIONAL_REMINDER',
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface ActionPlan {
  readonly type: ActionType;
  readonly updateInfo: UpdateInfo | null;
  readonly reason: string;
  readonly decidedAt: number;
}
