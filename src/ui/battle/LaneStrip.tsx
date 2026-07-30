import { bridge, type HudSnapshot } from '@/game/bridge';
import { useMeasuredWidth } from '@/ui/useMotion';

/**
 * Lane overview. The camera only shows about 1280 of a 1250-plus metre lane, so
 * without this the player cannot tell whether a push is coming or already at the
 * gate.
 *
 * Everything on the strip moves with `translateX` in measured pixels rather than
 * a `left` percentage, and transitions over exactly one snapshot interval. Two
 * reasons, in order of importance:
 *
 *   1. The strip is fed at about twelve samples a second while units move at
 *      sixty. Without interpolation every blip visibly teleports, which reads as
 *      a broken readout rather than a battle.
 *   2. Animating `left` on two dozen absolutely positioned elements at that rate
 *      is layout work on every sample. `translateX` stays on the compositor.
 *
 * Tapping anywhere jumps the camera there, which is the fastest way to check
 * your own artillery line mid-fight.
 */
export function LaneStrip({ snapshot }: { snapshot: HudSnapshot }) {
  const { laneLength, blips, cameraX, cameraSpan, playerFront, enemyFront } = snapshot;
  const [trackRef, trackWidth] = useMeasuredWidth<HTMLDivElement>();

  /** Lane metres to pixels along the measured track. */
  const px = (x: number) => (x / laneLength) * trackWidth;

  const jump = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    bridge.send({ t: 'lookAt', x: ratio * laneLength });
  };

  const contestFrom = Math.min(playerFront, enemyFront);
  const contestSpan = Math.abs(enemyFront - playerFront);

  return (
    <div className="lane" onPointerDown={jump} role="presentation">
      <div className="lane__track" ref={trackRef}>
        {/* Contested span, scaled from a full-width band rather than resized. */}
        <div
          className="lane__contest"
          style={{
            transform: `translateX(${px(contestFrom)}px) scaleX(${
              laneLength > 0 ? Math.max(0, contestSpan / laneLength) : 0
            })`,
          }}
        />
        <span
          className="lane__front lane__front--mine"
          style={{ transform: `translateX(${px(playerFront)}px)` }}
        />
        <span
          className="lane__front lane__front--theirs"
          style={{ transform: `translateX(${px(enemyFront)}px)` }}
        />
        {blips.map((b, i) => (
          <span
            key={i}
            className={`lane__blip lane__blip--${b.faction} lane__blip--${b.role}`}
            style={{
              transform: `translateX(${px(b.x)}px)`,
              opacity: 0.45 + b.hp * 0.55,
            }}
          />
        ))}
        <span className="lane__gate lane__gate--mine" />
        <span className="lane__gate lane__gate--theirs" />
        {/* What the camera is currently showing. */}
        <div
          className="lane__window"
          style={{
            transform: `translateX(${px(Math.max(0, cameraX))}px)`,
            width: `${px(cameraSpan)}px`,
          }}
        />
      </div>
    </div>
  );
}
