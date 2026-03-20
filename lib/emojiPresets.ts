export type EmojiCategory = {
  id: string;
  label: string;
  emojis: string[];
};

export const GDD_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "farming",
    label: "Fazenda",
    emojis: ["🌿", "🌱", "🌾", "🧑‍🌾", "🚜", "🪴", "🌽", "🥕", "🍓", "🍅"],
  },
  {
    id: "animals",
    label: "Animais",
    emojis: ["🐮", "🐷", "🐑", "🐐", "🐓", "🦆", "🐇", "🐄", "🐔", "🥛"],
  },
  {
    id: "economy",
    label: "Economia",
    emojis: ["🧀", "💵", "💳", "🧾", "🏪", "🛍️", "📊", "📈", "📉", "🛒"],
  },
  {
    id: "craft",
    label: "Craft",
    emojis: ["💰", "🏷️", "🍞", "🥖", "🍯", "🥫", "🍲", "🍳", "🧑‍🍳", "🧪"],
  },
  {
    id: "social",
    label: "Social",
    emojis: ["🔧", "⚗️", "👥", "🤝", "💬", "🎉", "🎁", "🏆", "⭐", "📣"],
  },
  {
    id: "organization",
    label: "Organização",
    emojis: ["🎊", "❤️", "✅", "❗", "📌", "🗂️", "📝", "🧠", "🔁", "📦"],
  },
];

export const GDD_EMOJI_PRESETS = GDD_EMOJI_CATEGORIES.flatMap((category) => category.emojis);

export function appendEmojiWithSpacing(value: string, emoji: string): string {
  const trimmed = value.trimEnd();
  if (!trimmed) return emoji;
  return `${trimmed} ${emoji}`;
}

