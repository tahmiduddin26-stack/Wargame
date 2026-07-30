import { bridge, type HudSnapshot } from '@/game/bridge';

/**
 * Lane overview. The camera only shows about 1280 of a 2000m lane, so without
 * this the player cannot tell whether a push is coming or already at the gate.
 *
 * Tapping anywhere on the strip jumps the camera there, which is the fastest
 * way to check your own artillery line mid-fight.
 */
export function LaneStrip({ snapshot }: { snapshot: HudSnapshot }) {
  const { laneLength, blips, cameraX, cameraSpan, playerFront, enemyFront } = snapshot;
  const pct = (x: number) => `${(x / laneLength) * 100}%`;

  const jump = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    bridge.send({ t: 'lookAt', x: ratio * laneLength });
  };

  return (
    <div className="lane" onPointerDown={jump} role="presentation">
      <div className="lane__track">
        {/* Contested span between the two front lines. */}
        <div
          className="lane__contest"
          style={{
            left: pct(Math.min(playerFront, enemyFront)),
            width: pct(Math.abs(enemyFront - playerFront)),
          }}
        />
        {blips.map((b, i) => (
          <span
            key={i}
            className={`lane__blip lane__blip--${b.faction} lane__blip--${b.role}`}
            style={{ left: pct(b.x), opacity: 0.45 + b.hp * 0.55 }}
          />
        ))}
        <span className="lane__gate lane__gate--mine" />
        <span className="lane__gate lane__gate--theirs" />
        {/* What the camera is currently showing. */}
        <div
          className="lane__window"
          style={{ left: pct(Math.max(0, cameraX)), width: pct(cameraSpan) }}
        />
      </div>
    </div>
  );
}
