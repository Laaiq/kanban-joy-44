-- Creators must be able to read their own workspace row. INSERT ... RETURNING
-- evaluates the SELECT policy before the AFTER trigger adds the owner
-- membership, so membership alone is not enough at creation time.
CREATE POLICY workspaces_select_creator
ON public.workspaces
FOR SELECT
TO authenticated
USING (created_by = auth.uid());