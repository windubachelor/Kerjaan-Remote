/**
 * Security Rules Specification Verification Suite for Kerjaan-Remote
 * Verifies that all 12 "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TEST_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create task',
    path: '/users/user_1/tasks/task_1',
    auth: null,
    payload: { id: 'task_1', ownerId: 'user_1', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email create task',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: false },
    payload: { id: 'task_1', ownerId: 'user_1', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-tenant read/write',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_2', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Spoofed ownerId on create',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_2', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Mutated ownerId on update',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_2', title: 'Updated' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow field injection (isSuperAdmin)',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized title (> 200 chars)',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', title: 'A'.repeat(250) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid status enum value',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', status: 'InvalidStage' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Invalid difficulty enum value',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', difficulty: 'Extreme' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unbounded variations list (> 14 items)',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', variations: new Array(20).fill({}) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Negative timeSpentMinutes',
    path: '/users/user_1/tasks/task_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'task_1', ownerId: 'user_1', timeSpentMinutes: -10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Poisoned document ID with invalid characters',
    path: '/users/user_1/tasks/bad id$!',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'bad id$!', ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
