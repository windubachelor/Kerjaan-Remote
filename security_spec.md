# Security Specification — Kerjaan-Remote Firestore Rules

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document in `/users/{userId}/tasks/{taskId}`, `/users/{userId}/worksheetCells/{cellId}`, `/users/{userId}/dailyNotes/{dateId}`, and `/users/{userId}/settings/{settingId}` belongs exclusively to `userId` (`request.auth.uid == userId`).
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Owner Immutability**: `ownerId` inside every document must equal `request.auth.uid` on `create` and cannot be mutated on `update` (`incoming().ownerId == existing().ownerId`).
4. **Volumetric & Type Bounds**: Every string field is bounded by `.size() <= MAX` and arrays (`variations`, `revisionTags`, `revisionHistory`, `history`) are bounded by `.size() <= MAX`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting to create `/users/u1/tasks/t1`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email_verified: false } }` attempting to create `/users/u1/tasks/t1`.
3. **Cross-Tenant Read**: `auth = { uid: 'u2' }` attempting `get` or `list` on `/users/u1/tasks`.
4. **Owner Field Spoofing on Create**: `auth = { uid: 'u1' }` creating `/users/u1/tasks/t1` with `{ ownerId: 'u2' }`.
5. **Owner Field Mutation on Update**: `auth = { uid: 'u1' }` updating `/users/u1/tasks/t1` with `{ ownerId: 'u2' }`.
6. **Shadow / Ghost Field Injection**: `auth = { uid: 'u1' }` creating `/users/u1/tasks/t1` with `{ isSuperAdmin: true }`.
7. **Oversized Title Resource Exhaustion**: `auth = { uid: 'u1' }` creating `/users/u1/tasks/t1` with `title` of 5,000 characters (`> 200`).
8. **Invalid Status Enum Injection**: `auth = { uid: 'u1' }` setting `status: 'HackedStatus'`.
9. **Invalid Difficulty Enum Injection**: `auth = { uid: 'u1' }` setting `difficulty: 'Impossible'`.
10. **Unbounded Variations Array**: `auth = { uid: 'u1' }` sending `variations` array with 50 items (`> 14`).
11. **Negative Time Spent**: `auth = { uid: 'u1' }` setting `timeSpentMinutes: -500`.
12. **Poisoned Document ID**: `auth = { uid: 'u1' }` attempting to create a document with spaces or special characters in `{taskId}`.
