/**
 * Everything the app chrome needs to know about the signed-in member.
 *
 * Built on the server in `(app)/layout.tsx` (status check + signed avatar URL)
 * and passed down as plain, serializable props — client components never query
 * Supabase just to draw the header.
 */
export type ChromeMember = {
  fullName: string;
  username: string;
  /** Faculty · graduation year, already localised. */
  headline: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
};
