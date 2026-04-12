-- ════════════════════════════════════════════════════════════
-- COMMENTS SYSTEM FIX & USER DATA PERSISTENCE
-- Ensures comments and replies are properly saved per user/workspace
-- ════════════════════════════════════════════════════════════

-- 1. Add missing columns to inbox_messages for reply tracking
ALTER TABLE inbox_messages
ADD COLUMN IF NOT EXISTS reply_text TEXT,
ADD COLUMN IF NOT EXISTS external_reply_id TEXT,
ADD COLUMN IF NOT EXISTS replied_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups of replied messages
CREATE INDEX IF NOT EXISTS idx_inbox_messages_replied_by ON inbox_messages(replied_by_user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_replied_at ON inbox_messages(replied_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_external_reply_id ON inbox_messages(external_reply_id);

-- 2. Add missing columns to messages for reply tracking
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS reply_text TEXT,
ADD COLUMN IF NOT EXISTS external_reply_id TEXT,
ADD COLUMN IF NOT EXISTS replied_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups of replied messages
CREATE INDEX IF NOT EXISTS idx_messages_replied_by ON messages(replied_by_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_replied_at ON messages(replied_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external_reply_id ON messages(external_reply_id);

-- 3. Fix RLS Policies for inbox_messages - Allow users to update their own workspace messages
DO $$
BEGIN
  -- Drop existing policies that might be too permissive
  DROP POLICY IF EXISTS "Users can view inbox_messages from their workspace" ON inbox_messages;
  DROP POLICY IF EXISTS "Service role can update inbox_messages" ON inbox_messages;

  -- Create proper RLS policies
  CREATE POLICY "Users can view inbox_messages from their workspace"
  ON inbox_messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = inbox_messages.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.accepted_at IS NOT NULL
    )
  );

  CREATE POLICY "Users can update inbox_messages in their workspace"
  ON inbox_messages FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = inbox_messages.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = inbox_messages.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.accepted_at IS NOT NULL
    )
  );

  CREATE POLICY "Service role can insert inbox_messages"
  ON inbox_messages FOR INSERT
  WITH CHECK (true);

  CREATE POLICY "Service role can delete inbox_messages"
  ON inbox_messages FOR DELETE
  USING (true);

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Note: Some policies may already exist or have dependencies';
END $$;

-- 4. Fix RLS Policies for messages - Allow users to update their own workspace messages
DO $$
BEGIN
  -- Drop existing restrictive policies
  DROP POLICY IF EXISTS "Users can update message status (read, archived, replied)" ON messages;

  -- Create proper RLS policies for users
  CREATE POLICY "Users can update messages in their workspace"
  ON messages FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = messages.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = messages.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.accepted_at IS NOT NULL
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Note: Some policies may already exist or have dependencies';
END $$;

-- 5. Verify workspace isolation - Data should never cross workspaces
-- Add constraint to prevent orphaned records
ALTER TABLE inbox_messages
ADD CONSTRAINT inbox_messages_workspace_id_not_null CHECK (workspace_id IS NOT NULL);

ALTER TABLE messages
ADD CONSTRAINT messages_workspace_id_not_null CHECK (workspace_id IS NOT NULL);

-- 6. Create audit log table to track all comment/reply actions
CREATE TABLE IF NOT EXISTS message_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  message_table TEXT NOT NULL CHECK (message_table IN ('inbox_messages', 'messages')),
  action TEXT NOT NULL CHECK (action IN ('created', 'viewed', 'replied', 'status_changed', 'deleted')),
  performed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT,
  reply_content TEXT,
  external_reply_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_activity_workspace ON message_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_activity_message ON message_activity_log(message_table, message_id);
CREATE INDEX IF NOT EXISTS idx_message_activity_user ON message_activity_log(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_message_activity_created ON message_activity_log(created_at DESC);

-- RLS for activity log
ALTER TABLE message_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity log from their workspace"
ON message_activity_log FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = message_activity_log.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.accepted_at IS NOT NULL
  )
);

CREATE POLICY "Service role can insert activity log"
ON message_activity_log FOR INSERT
WITH CHECK (true);

-- 7. Grant permissions
GRANT ALL ON message_activity_log TO service_role;
GRANT SELECT ON message_activity_log TO authenticated;

-- 8. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to inbox_messages
DROP TRIGGER IF EXISTS update_inbox_messages_timestamp ON inbox_messages;
CREATE TRIGGER update_inbox_messages_timestamp
BEFORE UPDATE ON inbox_messages
FOR EACH ROW
EXECUTE FUNCTION update_message_timestamp();

-- Apply trigger to messages
DROP TRIGGER IF EXISTS update_messages_timestamp ON messages;
CREATE TRIGGER update_messages_timestamp
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_message_timestamp();
