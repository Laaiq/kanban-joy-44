DROP POLICY IF EXISTS invites_update_owner_or_invitee ON public.workspace_invites;

CREATE POLICY invites_update_owner_or_invitee
ON public.workspace_invites
FOR UPDATE
TO authenticated
USING (
  has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);