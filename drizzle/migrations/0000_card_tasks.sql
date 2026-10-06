CREATE TABLE public.card_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_tasks_card_idx ON public.card_tasks(card_id);
CREATE INDEX card_tasks_board_idx ON public.card_tasks(board_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_tasks TO authenticated;
GRANT ALL ON public.card_tasks TO service_role;

ALTER TABLE public.card_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY card_tasks_select_members ON public.card_tasks FOR SELECT TO authenticated
  USING (public.can_view_board(board_id, auth.uid()));
CREATE POLICY card_tasks_insert_editor ON public.card_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_edit_board(board_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND c.board_id = card_tasks.board_id));
CREATE POLICY card_tasks_update_editor ON public.card_tasks FOR UPDATE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid())) WITH CHECK (public.can_edit_board(board_id, auth.uid()));
CREATE POLICY card_tasks_delete_editor ON public.card_tasks FOR DELETE TO authenticated
  USING (public.can_edit_board(board_id, auth.uid()));

CREATE TRIGGER card_tasks_touch_updated_at BEFORE UPDATE ON public.card_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();