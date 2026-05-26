import { supabase } from '../supabase';

/**
 * Fetch all conversations for the current candidate/student.
 */
export const getConversations = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  try {
    const res = await fetch('/api/conversations', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return [];
  }
};

/**
 * Get messages for a specific conversation.
 */
export const getMessages = async (conversationId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  try {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return await res.json();
  } catch (err) {
    console.error('Error fetching messages:', err);
    return [];
  }
};

/**
 * Send a message in a conversation.
 */
export const sendMessage = async (conversationId, body, type = 'text') => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ body })
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to send message');
  }
  return await res.json();
};

/**
 * Mark a conversation as read by updating the last_read_at timestamp.
 */
export const markAsRead = async (conversationId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await fetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
  } catch (err) {
    console.error('Error marking conversation as read:', err);
  }
};

/**
 * Create or get conversation for a specific application.
 */
export const getOrCreateConversationForApplication = async (applicationId) => {
  return applicationId;
};

/**
 * Create or get conversation for a job question (pre-application).
 */
export const getOrCreateJobQuestionConversation = async (jobId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  // Check if they already have an application for this job
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', jobId)
    .eq('candidate_id', session.user.id)
    .maybeSingle();

  if (existingApp) {
    return existingApp.id;
  }

  // Fetch student profile and job info to insert a "Pending" application
  const { data: profile } = await supabase.from('profiles').select('first_name, last_name, email').eq('user_id', session.user.id).maybeSingle();
  const { data: job } = await supabase.from('jobs').select('company, employer_id').eq('id', jobId).maybeSingle();

  const { data: newApp, error } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      candidate_id: session.user.id,
      employer_id: job?.employer_id,
      student_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Kandidát',
      student_email: profile?.email || session.user.email,
      status: 'Pending'
    })
    .select('id')
    .single();

  if (error) throw error;
  return newApp.id;
};

let hasDedicatedTableCached = null;
const checkDedicatedTable = async () => {
  if (hasDedicatedTableCached !== null) return hasDedicatedTableCached;
  try {
    const { error } = await supabase.from('application_messages').select('id').limit(1);
    hasDedicatedTableCached = !error;
  } catch (e) {
    hasDedicatedTableCached = false;
  }
  return hasDedicatedTableCached;
};

/**
 * Subscribe to new messages inside a conversation.
 */
export const subscribeToMessages = (conversationId, onMessageReceived) => {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const channel = supabase.channel(`chat:${conversationId}-${uniqueId}`);

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'application_messages'
    },
    async (payload) => {
      const msg = payload.new;
      if (!msg || msg.application_id !== conversationId) return;
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const senderId = msg.sender_id === userId ? userId : (msg.sender_id ? 'other' : null);
      onMessageReceived({
        id: msg.id,
        conversation_id: msg.application_id,
        sender_id: senderId,
        message_type: msg.message_type,
        body: msg.body,
        created_at: msg.created_at
      });
    }
  );

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    },
    async (payload) => {
      const n = payload.new;
      if (!n || n.related_entity_id !== conversationId) return;

      // If database contains application_messages, ignore notification records in the chat window to prevent duplicate rendering
      const hasDedicated = await checkDedicatedTable();
      if (hasDedicated) return;

      onMessageReceived({
        id: n.id,
        conversation_id: n.related_entity_id,
        sender_id: 'other',
        message_type: n.type === 'general' ? 'text' : 'system',
        body: n.message || n.title,
        created_at: n.created_at
      });
    }
  );

  return channel.subscribe();
};

/**
 * Subscribe to conversation list updates (real-time inbox refresh).
 */
export const subscribeToConversations = (onUpdate) => {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  return supabase
    .channel(`inbox-updates-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications'
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'application_messages'
      },
      () => onUpdate()
    )
    .subscribe();
};

/**
 * Fetch total unread conversations count.
 */
export const getUnreadCount = async () => {
  const conversations = await getConversations();
  return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
};
