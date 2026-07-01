import type { FC } from "react";

const COMMANDS = [
  {
    id: "actions",
    label: "/actions",
    description: "Browse and execute CAP actions",
  },
  {
    id: "functions",
    label: "/functions",
    description: "Browse and call CAP functions",
  },
  {
    id: "help",
    label: "/help",
    description: "Show available commands",
  },
] as const;

export type SlashCommandId = (typeof COMMANDS)[number]["id"];

interface Props {
  query: string;
  selectedIdx: number;
  onSelect: (id: SlashCommandId) => void;
  onHover: (idx: number) => void;
}

export const SlashCommandPopup: FC<Props> = ({
  query,
  selectedIdx,
  onSelect,
  onHover,
}) => {
  const filtered = COMMANDS.filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  );

  if (!filtered.length) return null;

  return (
    <div className="slash-popup" role="listbox" aria-label="Available commands">
      <div className="slash-popup-header">Commands</div>
      <div className="slash-popup-list">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            className={`slash-popup-item${i === selectedIdx ? " is-selected" : ""}`}
            role="option"
            aria-selected={i === selectedIdx}
            onClick={() => onSelect(cmd.id)}
            onMouseEnter={() => onHover(i)}
            tabIndex={-1}
            type="button"
          >
            <span className="slash-popup-text">
              <span className="slash-popup-label">{cmd.label}</span>
              <span className="slash-popup-desc">{cmd.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export function slashCommandCount(query: string): number {
  return COMMANDS.filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  ).length;
}

export function slashCommandAt(
  query: string,
  idx: number,
): SlashCommandId | null {
  const filtered = COMMANDS.filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  );
  return filtered[idx]?.id ?? null;
}
