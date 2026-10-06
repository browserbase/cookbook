import { defaultLinqAuth, linqChannel } from "eve/channels/linq";

export default linqChannel({
  credentials: {
    apiKey: () => requiredEnvironmentValue("LINQ_API_KEY"),
    signingSecret: () => requiredEnvironmentValue("LINQ_WEBHOOK_SECRET"),
  },
  turnPolicy: "steer",
  onMessage(_context, message) {
    if (!isAllowedLinqSender(message.author)) return null;

    return {
      auth: defaultLinqAuth(message),
      context: ["This request arrived through Browsie's Linq iMessage or SMS channel."],
    };
  },
});

export function isAllowedLinqSender(
  author: { isBot: boolean; userId: string },
  allowlist = process.env.BROWSIE_LINQ_ALLOWED_USER_IDS,
): boolean {
  if (author.isBot) return false;
  const allowedUserIds = new Set(
    (allowlist ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowedUserIds.size === 0 || allowedUserIds.has(author.userId);
}

export function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Linq channel.`);
  return value;
}
