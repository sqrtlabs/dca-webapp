import React from "react";
import { generateIdenticon } from "~/lib/identicon";

interface IdenticonProps {
  address: string;
  size?: number;
}

export const Identicon: React.FC<IdenticonProps> = ({
  address,
  size = 32,
}) => {
  const { backgroundColor, pattern } = generateIdenticon(address);

  const gridSize = 5;
  const cellSize = size / gridSize;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={backgroundColor} rx={size / 8} />
      {pattern.map((filled, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;

        // Create symmetric pattern
        const positions = [
          [col, row],
          [4 - col, row], // Mirror on the other side
        ];

        return positions.map(([x, y], i) => {
          if (filled) {
            return (
              <rect
                key={`${index}-${i}`}
                x={x * cellSize}
                y={y * cellSize}
                width={cellSize}
                height={cellSize}
                fill="rgba(0, 0, 0, 0.3)"
              />
            );
          }
          return null;
        });
      })}
    </svg>
  );
};
