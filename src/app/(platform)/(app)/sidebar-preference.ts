/**
 * Name of the cookie holding the sidebar collapsed preference. Shared between
 * the server (which reads it in the layout so the first paint is correct) and
 * the client (which writes it on toggle). A plain cookie, deliberately not
 * part of the signed session payload — it carries no authorisation meaning.
 */
export const SIDEBAR_COOKIE = "sidebar-collapsed";
