import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCounts() {
  // Get all replies
  const { data: replies } = await supabase
    .from('posts')
    .select('id, thread_id, reply_to_id')
    .not('reply_to_id', 'is', null);

  // Find nested replies (where thread_id != reply_to_id) and count per thread root
  const threadUpdates = {};
  for (const reply of replies) {
    if (reply.thread_id && reply.reply_to_id && reply.thread_id !== reply.reply_to_id) {
      threadUpdates[reply.thread_id] = (threadUpdates[reply.thread_id] || 0) + 1;
    }
  }

  console.log('Nested replies to add per thread:', threadUpdates);

  // Update each thread root's reply_count
  for (const [threadId, additionalCount] of Object.entries(threadUpdates)) {
    const { data: post } = await supabase
      .from('posts')
      .select('reply_count')
      .eq('id', threadId)
      .single();

    if (post) {
      const newCount = post.reply_count + additionalCount;
      await supabase.from('posts').update({ reply_count: newCount }).eq('id', threadId);
      console.log(`Updated thread ${threadId}: ${post.reply_count} -> ${newCount}`);
    }
  }

  console.log('Done fixing reply counts');
}

fixCounts();
