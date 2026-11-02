// Shared feedback contract. Imported by both the client dialog (app/_ui/feedback-dialog.tsx)
// and the server action (app/actions/feedback.ts), so the topic set has one source of truth.
// Kept out of the 'use server' file because that file may only export async functions.

export const FEEDBACK_TOPICS = ['improve', 'feature', 'bug', 'discord-setup'] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

// `chip` is the short label on the topic buttons; `title` goes in the Discord embed title.
export const FEEDBACK_TOPIC_META: Record<FeedbackTopic, { chip: string; title: string }> = {
  improve: { chip: 'How to improve', title: 'How to improve' },
  feature: { chip: 'Feature or flow', title: 'Feature or flow' },
  bug: { chip: 'Something broke', title: 'Something broke' },
  'discord-setup': { chip: 'Discord setup', title: 'Discord setup friction' },
};
