/**
 * One-click, password-free sign-in for use while the UI is being built.
 *
 * This bypasses authentication entirely, so wherever it is enabled ANY visitor
 * gets a full session as an admin — including access to employee passport
 * numbers, Emirates IDs, salaries and WPS bank details. It is therefore OFF by
 * default anywhere the build is a production build (Vercel production *and*
 * preview, since both point at the real database).
 *
 * - Local `npm run dev`: on automatically.
 * - Anywhere else: set ALLOW_PASSWORDLESS_LOGIN=1 to turn it on.
 *
 * Set DEV_LOGIN_EMAIL to choose the account; otherwise the oldest SUPER_ADMIN
 * is used. Remove the env var (and ideally this file) before go-live.
 */
export function passwordlessLoginEnabled(): boolean {
  // Tolerant of the usual ways a truthy env var gets typed into a dashboard.
  const flag = process.env.ALLOW_PASSWORDLESS_LOGIN?.trim().toLowerCase();
  if (flag && ["1", "true", "yes", "on"].includes(flag)) return true;
  return process.env.NODE_ENV !== "production";
}
