import html2canvas from 'html2canvas';

/**
 * Renders a specific DOM element to a canvas and triggers a PNG download.
 * Ensures the exported PNG has a white background (useful for transparent SVGs)
 * and uses a higher scale for report printing quality.
 *
 * @param elementId The ID of the DOM element to capture
 * @param filename The desired output filename without extension (e.g. 'regime-timeline')
 */
export const exportChart = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`exportChart: Element with id '${elementId}' not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,           // 2x size for high DPI / Retina (Report quality)
      backgroundColor: '#ffffff', // Force white background
      useCORS: true,
      logging: false,     // Disable noisy console logs
    });

    const dataUrl = canvas.toDataURL('image/png');

    // Create a dummy link to trigger the download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('exportChart component capture failed:', err);
  }
};
