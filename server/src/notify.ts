import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationType, Priority } from "@red-link/shared/domain/constants";
import type { TxContext } from "./db.ts";
import { env } from "./env.ts";
import { Notification, User } from "./models.ts";

export interface NotificationPayload {
  type: NotificationType;
  priority?: Priority;
  title: string;
  body: string;
  link?: string;
}

/**
 * A way of delivering notifications (spec Section 10). In-app is always on; email is on
 * when SMTP settings are provided (owner decision); SMS and push are stubs for future scope.
 */
export interface NotificationChannel {
  readonly name: string;
  send(userIds: readonly string[], payload: NotificationPayload, ctx?: TxContext): Promise<void>;
}

/** Writes Notification rows (joins the current transaction automatically). */
class InAppChannel implements NotificationChannel {
  readonly name = "in-app";
  async send(userIds: readonly string[], payload: NotificationPayload) {
    if (userIds.length === 0) return;
    await Notification.insertMany(
      userIds.map((userId) => ({
        userId,
        type: payload.type,
        priority: payload.priority ?? "NORMAL",
        title: payload.title,
        body: payload.body,
        link: payload.link ?? null,
      })),
    );
  }
}

/** Reserved / demo domains that can never receive mail. */
const UNDELIVERABLE = /@(.+\.)?(test|example|invalid|localhost)$|@example\.(com|org|net)$/i;

/** Emails URGENT and CRITICAL alerts. Sent only after the transaction commits. */
class EmailChannel implements NotificationChannel {
  readonly name = "email";
  private transporter: Transporter | null = null;

  get enabled() {
    return Boolean(env.smtp.user && env.smtp.pass);
  }

  private getTransporter() {
    this.transporter ??= nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
    return this.transporter;
  }

  async send(userIds: readonly string[], payload: NotificationPayload, ctx?: TxContext) {
    const urgent = payload.priority === "URGENT" || payload.priority === "CRITICAL";
    if (!urgent || userIds.length === 0) return;
    const users = await User.find({ _id: { $in: userIds } }, { email: 1 }).lean();
    const to = users.map((u) => u.email).filter((e) => !UNDELIVERABLE.test(e));
    if (to.length === 0) return;

    const job = async () => {
      if (!this.enabled) {
        console.info(`[email disabled] would email ${to.length} user(s): ${payload.title}`);
        return;
      }
      const link = payload.link ? `${env.appUrl}${payload.link}` : env.appUrl;
      const results = await Promise.allSettled(
        to.map((address) =>
          this.getTransporter().sendMail({
            from: `Red Link <${env.smtp.from}>`,
            to: address,
            subject: `[Red Link] ${payload.title}`,
            text: `${payload.body}\n\nOpen Red Link: ${link}`,
            html: `<p style="font-size:16px"><strong>${escapeHtml(payload.title)}</strong></p><p>${escapeHtml(payload.body)}</p><p><a href="${link}">Open Red Link</a></p>`,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) console.error(`[email] ${failed.length}/${to.length} failed`, (failed[0] as PromiseRejectedResult).reason);
    };
    if (ctx) ctx.afterCommit.push(job);
    else await job();
  }
}

/** Future scope: SMS gateway. Logs only. */
export class SmsChannel implements NotificationChannel {
  readonly name = "sms";
  async send(userIds: readonly string[], payload: NotificationPayload) {
    console.info(`[sms stub] would text ${userIds.length} user(s): ${payload.title}`);
  }
}

/** Future scope: web/mobile push. Logs only. */
export class PushChannel implements NotificationChannel {
  readonly name = "push";
  async send(userIds: readonly string[], payload: NotificationPayload) {
    console.info(`[push stub] would push to ${userIds.length} user(s): ${payload.title}`);
  }
}

export const emailChannel = new EmailChannel();
const CHANNELS: NotificationChannel[] = [new InAppChannel(), emailChannel];

/** Writes in-app notifications and calls every channel. Pass `ctx` when inside `transaction()`. */
export async function notify(userIds: readonly string[], payload: NotificationPayload, ctx?: TxContext) {
  const unique = [...new Set(userIds.map(String))];
  for (const channel of CHANNELS) await channel.send(unique, payload, ctx);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
