export const TEST_ADMIN = {
  name: "Test Admin",
  email: "admin@test.local",
  password: "testpass123",
} as const;

export const TEST_USER = {
  name: "Regular User",
  email: "user@test.local",
  password: "userpass123",
} as const;

export const STORAGE_STATE = "playwright/.auth/user.json";
export const REGULAR_STORAGE_STATE = "playwright/.auth/regular.json";
