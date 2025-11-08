-- Create WhatsApp conversations table for CRM Chat
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  contact_jid VARCHAR(255) NOT NULL, -- WhatsApp JID (e.g., 6281234567890@s.whatsapp.net)
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  last_message_id UUID,
  last_message_preview TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  label VARCHAR(50), -- lead, customer, support, vip, follow-up
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- For extra data like profile pic, status, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(device_id, contact_jid)
);

-- Create WhatsApp messages table for full chat history
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Message metadata
  message_id VARCHAR(255), -- WhatsApp message ID
  from_me BOOLEAN NOT NULL DEFAULT false, -- true if sent by us, false if received
  contact_jid VARCHAR(255) NOT NULL,

  -- Message content
  message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, image, video, audio, document, sticker, location, contact
  message_content TEXT,
  media_url TEXT,
  media_mime_type VARCHAR(100),
  media_size BIGINT,
  caption TEXT,

  -- Message status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed, deleted
  error_message TEXT,

  -- Timestamps
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  quoted_message_id UUID, -- Reference to quoted/replied message
  is_forwarded BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create function to update conversation's last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET
    last_message_id = NEW.id,
    last_message_preview = CASE
      WHEN NEW.message_type = 'text' THEN LEFT(NEW.message_content, 100)
      WHEN NEW.message_type = 'image' THEN '📷 Image'
      WHEN NEW.message_type = 'video' THEN '🎥 Video'
      WHEN NEW.message_type = 'audio' THEN '🎵 Audio'
      WHEN NEW.message_type = 'document' THEN '📄 Document'
      ELSE '💬 Message'
    END,
    last_message_time = NEW.timestamp,
    unread_count = CASE
      WHEN NEW.from_me THEN 0
      ELSE unread_count + 1
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update conversation
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON whatsapp_messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_conversation_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = 0, updated_at = NOW()
  WHERE id = p_conversation_id;

  UPDATE whatsapp_messages
  SET status = 'read'
  WHERE conversation_id = p_conversation_id
    AND from_me = false
    AND status != 'read';
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations"
      ON whatsapp_conversations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'Users can insert own conversations') THEN
    CREATE POLICY "Users can insert own conversations"
      ON whatsapp_conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'Users can update own conversations') THEN
    CREATE POLICY "Users can update own conversations"
      ON whatsapp_conversations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'Users can delete own conversations') THEN
    CREATE POLICY "Users can delete own conversations"
      ON whatsapp_conversations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'Service can manage all conversations') THEN
    CREATE POLICY "Service can manage all conversations"
      ON whatsapp_conversations FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can view own messages') THEN
    CREATE POLICY "Users can view own messages"
      ON whatsapp_messages FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can insert own messages') THEN
    CREATE POLICY "Users can insert own messages"
      ON whatsapp_messages FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Users can update own messages') THEN
    CREATE POLICY "Users can update own messages"
      ON whatsapp_messages FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'Service can manage all messages') THEN
    CREATE POLICY "Service can manage all messages"
      ON whatsapp_messages FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_device ON whatsapp_conversations(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON whatsapp_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_label ON whatsapp_conversations(label) WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_starred ON whatsapp_conversations(is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON whatsapp_conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON whatsapp_conversations(unread_count) WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON whatsapp_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_device ON whatsapp_messages(device_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_from_me ON whatsapp_messages(from_me);
CREATE INDEX IF NOT EXISTS idx_messages_type ON whatsapp_messages(message_type);

-- Add comments
COMMENT ON TABLE whatsapp_conversations IS 'WhatsApp conversations for CRM chat feature';
COMMENT ON TABLE whatsapp_messages IS 'Individual WhatsApp messages with full history';
COMMENT ON COLUMN whatsapp_messages.from_me IS 'true = sent by user, false = received from contact';
COMMENT ON COLUMN whatsapp_conversations.contact_jid IS 'WhatsApp JID format: phone@s.whatsapp.net';