import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '@/hooks/useTheme';

/**
 * Declarative Chart.js wrapper.
 * Rebuilds the instance when the config or theme changes and always
 * destroys it on unmount so canvases never leak between routes.
 */
export function ChartCanvas({ type, data, options, height = 320, label }) {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return undefined;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-2').trim();
    const gridColor = styles.getPropertyValue('--border').trim();

    const instance = new Chart(context, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        color: textColor,
        plugins: {
          legend: { labels: { color: textColor, usePointStyle: true, boxWidth: 8 } },
          ...options?.plugins,
        },
        scales: options?.scales
          ? Object.fromEntries(
              Object.entries(options.scales).map(([key, scale]) => [
                key,
                {
                  ...scale,
                  ticks: { color: textColor, ...scale.ticks },
                  grid: { color: gridColor, ...scale.grid },
                },
              ]),
            )
          : undefined,
        ...options,
      },
    });

    return () => instance.destroy();
  }, [type, data, options, theme]);

  return (
    <div className="chart-container" style={{ height }}>
      <canvas className="chart-canvas" ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
