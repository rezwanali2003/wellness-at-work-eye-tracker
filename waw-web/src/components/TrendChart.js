// src/components/TrendChart.js

/**
 * Minimal sparkline-style trend chart for blink data.
 *
 * Expects `data` as an array of objects: [{ blinks: number }, ...].
 * Renders a simple SVG line with points, scaled to the given height.
 */
export function TrendChart({ data = [], height = 160 }) {
  // Empty state
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">
        No trend data yet
      </div>
    );
  }

  // Basic chart geometry
  const width = 400;         // SVG viewBox width (fixed logical width)
  const paddingX = 16;       // left/right padding inside viewBox
  const paddingY = 12;       // top/bottom padding inside viewBox

  const values = data.map((d) => d.blinks ?? 0);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const n = data.length;

  /**
   * Map data index -> x coordinate in the SVG.
   * If only one point, place it in the horizontal center.
   */
  const getX = (index) =>
    paddingX +
    (n === 1 ? width / 2 : (index / (n - 1)) * (width - paddingX * 2));

  /**
   * Map blinks value -> y coordinate in the SVG.
   * Higher values appear higher on the chart.
   */
  const getY = (value) => {
    if (maxVal === minVal) {
      // Flat series: draw a straight line through the middle.
      return height / 2;
    }
    const t = (value - minVal) / (maxVal - minVal); // normalize 0..1
    return height - paddingY - t * (height - paddingY * 2);
  };

  // Precompute SVG points
  const points = values.map((v, i) => ({
    x: getX(i),
    y: getY(v),
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-40 text-blue-400"
      role="img"
      aria-label="Blink rate trend"
    >
      {/* Background (kept for potential grid styling) */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="none"
        className="text-zinc-800"
      />

      {/* Trend line */}
      <polyline
        fill="none"
        stroke="rgba(59,130,246,0.3)"
        strokeWidth="2"
        points={polylinePoints}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          className="fill-blue-400"
        />
      ))}
    </svg>
  );
}
