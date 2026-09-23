CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_board(_board_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    JOIN public.workspace_members m ON m.workspace_id = b.workspace_id
    WHERE b.id = _board_id AND m.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_board(_board_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    JOIN public.workspace_members m ON m.workspace_id = b.workspace_id
    WHERE b.id = _board_id AND m.user_id = _user_id AND m.role IN ('owner','editor')
  )
$$;

CREATE POLICY boards_select_members ON public.boards FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY boards_insert_editor ON public.boards FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_workspace_role(workspace_id, auth.uid(), 'owner')
      OR public.has_workspace_role(workspace_id, auth.uid(), 'editor')
    )
  );
CREATE POLICY boards_update_editor ON public.boards FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR public.has_workspace_role(workspace_id, auth.uid(), 'editor'))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR public.has_workspace_role(workspace_id, auth.uid(), 'editor'));
CREATE POLICY boards_delete_editor ON public.boards FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR public.has_workspace_role(workspace_id, auth.uid(), 'editor'));

CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_columns TO authenticated;
GRANT ALL ON public.board_columns TO service_role;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY columns_select_members ON public.board_columns FOR SELECT TO authenticated
  USING (public.can_view_board(board_id, auth.uid()));
CREATE POLICY columns_insert_editor ON public.board_columns FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_board(board_id, auth.uid()));
CREATE POLICY columns_update_editor ON public.board_columns FOR UPDATE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid())) WITH CHECK (public.can_edit_board(board_id, auth.uid()));
CREATE POLICY columns_delete_editor ON public.board_columns FOR DELETE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid()));

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.board_columns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid,
  due_date date,
  labels text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_select_members ON public.cards FOR SELECT TO authenticated
  USING (public.can_view_board(board_id, auth.uid()));
CREATE POLICY cards_insert_editor ON public.cards FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_edit_board(board_id, auth.uid()));
CREATE POLICY cards_update_editor ON public.cards FOR UPDATE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid())) WITH CHECK (public.can_edit_board(board_id, auth.uid()));
CREATE POLICY cards_delete_editor ON public.cards FOR DELETE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid()));

CREATE INDEX idx_boards_workspace ON public.boards(workspace_id);
CREATE INDEX idx_columns_board ON public.board_columns(board_id, position);
CREATE INDEX idx_cards_column ON public.cards(column_id, position);
CREATE INDEX idx_cards_board_due ON public.cards(board_id, due_date);

CREATE TRIGGER boards_touch_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER columns_touch_updated_at BEFORE UPDATE ON public.board_columns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER cards_touch_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

REVOKE EXECUTE ON FUNCTION public.can_view_board(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_board(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_board(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_board(uuid, uuid) TO authenticated;