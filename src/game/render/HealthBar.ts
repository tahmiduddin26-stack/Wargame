import Phaser from 'phaser';

/** Rounded track and fill shared by forts and soldiers, centred on their anchor. */
export class HealthBar extends Phaser.GameObjects.Graphics {
  private lastRatio = -1;
  private lastColour = -1;

  constructor(
    scene: Phaser.Scene,
    private barWidth: number,
    private barHeight: number,
    colour: number,
    private background = 0xfff5da,
    private strokeWidth = 2,
  ) {
    super(scene);
    scene.add.existing(this);
    this.setProgress(1, colour);
  }

  setProgress(value: number, colour = this.lastColour): this {
    const ratio = Number.isFinite(value) ? Phaser.Math.Clamp(value, 0, 1) : 0;
    // HP usually stays unchanged for many frames; rebuild paths on HP changes.
    if (ratio === this.lastRatio && colour === this.lastColour) return this;
    this.lastRatio = ratio;
    this.lastColour = colour;

    const x = -this.barWidth / 2, y = -this.barHeight / 2;
    const radius = this.barHeight / 2;
    const inset = this.strokeWidth / 2;
    const fillWidth = (this.barWidth - 2 * inset) * ratio;
    const fillHeight = this.barHeight - 2 * inset;
    this.clear();
    this.fillStyle(this.background, 1);
    this.fillRoundedRect(x, y, this.barWidth, this.barHeight, radius);
    if (fillWidth > 0) {
      this.fillStyle(colour, 1);
      // A tiny remainder shrinks into a dot inside the left cap, rather than
      // drawing a tall sliver outside the track's curved corners.
      const visibleHeight = Math.min(fillWidth, fillHeight);
      this.fillRoundedRect(x + inset, -visibleHeight / 2, fillWidth, visibleHeight, visibleHeight / 2);
    }
    this.lineStyle(this.strokeWidth, 0x2d302e, 1);
    this.strokeRoundedRect(x, y, this.barWidth, this.barHeight, radius);
    return this;
  }
}
