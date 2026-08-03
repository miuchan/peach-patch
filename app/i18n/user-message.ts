import type { MessageKey } from "./catalogs";
import type { MessageValues } from "./core";
import type { Translate } from "./provider";

export type MessageDescriptorValue = string | number | MessageDescriptor;
export type MessageDescriptor = {
  kind: "message";
  key: MessageKey;
  values?: Readonly<Record<string, MessageDescriptorValue>>;
};
export type IssueDescriptor = {
  kind: "issue";
  error: unknown;
  fallback: MessageDescriptor;
};
export type UserMessage = MessageDescriptor | IssueDescriptor;

export function message(
  key: MessageKey,
  values?: Readonly<Record<string, MessageDescriptorValue>>,
): MessageDescriptor {
  return values ? { kind: "message", key, values } : { kind: "message", key };
}

export function issue(
  error: unknown,
  fallbackKey: MessageKey = "errors.unexpected",
  fallbackValues?: Readonly<Record<string, MessageDescriptorValue>>,
): IssueDescriptor {
  return { kind: "issue", error, fallback: message(fallbackKey, fallbackValues) };
}

function plainValues(t: Translate, values: MessageDescriptor["values"]): MessageValues | undefined {
  if (!values) return undefined;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "object" ? formatUserMessage(t, value) : value,
    ]),
  );
}

export function formatUserMessage(t: Translate, value: UserMessage): string {
  if (value.kind === "issue") return formatUserMessage(t, value.fallback);
  return t(value.key, plainValues(t, value.values));
}
