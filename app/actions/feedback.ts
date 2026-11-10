'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_META, type FeedbackTopic } from '@/lib/feedback';
import {
  validateDiscordWebhookUrl,
  postDiffToWebhook,
  type DiscordEmbed,
  type DiscordEmbedField,
} from '@/lib/discord';

// Lightweight product feedback. Routes to a private Discord channel (the owner lives in
// Discord, the product's top surface), so there's no table to migrate and no admin page to
// check: a message just shows up where the owner already is. Set FEEDBACK_WEBHOOK_URL in the
// environment to the destination webhook. No user-supplied URL is ever posted to, so this is
// not an open relay.

const TOPIC_COLOR: Record<FeedbackTopic, number> = {
  improve: 0x34d399, // emerald
  feature: 0x38bdf8, // sky
  bug: 0xf59e0b, // amber
  'discord-setup': 0xa78bfa, // violet
};

// Sign-in is required and the GitHub identity is the reply path, so there's no email field.
const schema = z.object({
  topic: z.enum(FEEDBACK_TOPICS),
  message: z.string().trim().min(4, 'add a bit more').max(2000),
  path: z.string().trim().max(300).optional().default(''),
});

export interface FeedbackInput {
  topic: FeedbackTopic;
  message: string;
  path?: string;
  website?: string; // honeypot — real users never fill this
}

// Per-IP soft limit. ponytail: in-memory, resets on cold start. Enough to blunt a casual
// spammer from flooding the owner's channel; swap for a durable limiter if abuse shows up.
const RATE_MAX = 4;
const RATE_WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Honeypot: a filled hidden field means a bot. Pretend it worked, drop it.
  if (input.website && input.website.trim()) return { ok: true };

  // Feedback requires a signed-in GitHub identity: it's the reply path, and it keeps the channel
  // spam-free. Resolve the session before anything else so a signed-out submit stops here.
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return { ok: false, error: 'sign in to send feedback' };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'check the form' };
  }
  const { topic, message, path } = parsed.data;

  const ip = await clientIp();
  if (rateLimited(ip)) {
    return { ok: false, error: 'easy, a few at a time. try again in a bit.' };
  }

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  const v = webhookUrl ? validateDiscordWebhookUrl(webhookUrl) : { ok: false };
  if (!webhookUrl || !v.ok || !v.normalized) {
    // Misconfiguration, not the user's fault, so don't pretend it sent.
    console.error('[feedback] FEEDBACK_WEBHOOK_URL is missing or invalid');
    return { ok: false, error: 'feedback is not wired up yet. ping me on GitHub instead.' };
  }

  // Reply path comes from the GitHub session: prefer email, fall back to name, then user id.
  const replyTo = user.email ?? user.name ?? user.id;
  const fields: DiscordEmbedField[] = [{ name: 'from', value: replyTo, inline: true }];
  if (path) fields.push({ name: 'page', value: path, inline: true });
  fields.push({ name: 'user id', value: user.id, inline: false });

  const embed: DiscordEmbed = {
    title: `Feedback · ${FEEDBACK_TOPIC_META[topic].title}`,
    description: message,
    color: TOPIC_COLOR[topic],
    timestamp: new Date().toISOString(),
    fields: fields.length ? fields : undefined,
    footer: { text: 'bountyindex.in · feedback' },
  };

  const res = await postDiffToWebhook(v.normalized, embed);
  if (res.ok) return { ok: true };
  return { ok: false, error: 'could not send that, try again in a moment.' };
}
