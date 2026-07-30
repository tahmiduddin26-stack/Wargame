import { requestLandscapeLock } from './useOrientation';

/**
 * Landscape is not a style choice here, it is a design constraint.
 *
 * Age of War is a single horizontal lane. Reach is the core mechanic: you need
 * to see that your trebuchet covers 300m and the enemy's does not, that a push
 * is 200m from your gate, and where your own front line has stalled. In portrait
 * you get roughly a third of the readable lane, which forces either a zoomed-out
 * camera nobody can read on a phone, or a vertical lane, which is a different
 * game. So: landscape, locked, with an honest gate rather than a squashed HUD.
 */
export function OrientationGate() {
  return (
    <div className="gate">
      <div className="gate__inner">
        <div className="hazard-rule" />
        <p className="stamp gate__stamp">Orientation check</p>
        <h1 className="gate__title">Turn the device sideways</h1>
        <p className="gate__body">
          The battlefield is one long lane. Field Command needs the width to show you both gates,
          your front line and everything in reach between them.
        </p>

        <div className="gate__diagram" aria-hidden="true">
          <div className="gate__phone">
            <div className="gate__lane">
              <span className="gate__gate gate__gate--mine" />
              <span className="gate__front" />
              <span className="gate__gate gate__gate--theirs" />
            </div>
          </div>
          <p className="stamp">16 : 9 landscape</p>
        </div>

        <button className="btn btn--ghost" onClick={() => void requestLandscapeLock()}>
          Try to lock rotation
        </button>
        <p className="gate__note">
          Rotation lock on your device may need turning off first.
        </p>
      </div>
    </div>
  );
}
