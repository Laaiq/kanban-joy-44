REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_workspace_role(UUID, UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_workspace(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_workspace(UUID, UUID) TO authenticated;