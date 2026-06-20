/**
 * Service to generate a unique hardware fingerprint based on browser sandbox parameters.
 * Combines Canvas rendering, WebGL renderer specs, CPU core count, Screen resolution, and RAM size.
 */

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-ctx';
    
    // Draw text with various fills to create a unique rasterization profile
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial' or 'sans-serif'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#aa3bff";
    ctx.fillRect(10, 10, 150, 40);
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText("SmartMarketOfflinePOS_#1! 💎", 15, 35);
    
    ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
    ctx.fillText("SmartMarketOfflinePOS_#1! 💎", 17, 37);
    
    return canvas.toDataURL();
  } catch {
    return 'canvas-err';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null 
      || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no-gl';
    
    const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbgRenderInfo) return 'no-gl-info';
    
    const vendor = gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL);
    return `${vendor}||${renderer}`;
  } catch {
    return 'webgl-err';
  }
}

export async function getHardwareFingerprint(): Promise<string> {
  const canvasInfo = getCanvasFingerprint();
  const webGLInfo = getWebGLFingerprint();
  
  // CPU Cores
  const cpuCores = navigator.hardwareConcurrency || 4;
  
  // RAM size in GB (navigator.deviceMemory is standard in Chromium)
  const ramSize = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  
  // Screen details
  const screenDetails = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  
  // Platform & Languages
  const platformInfo = navigator.platform || 'unknown';
  const language = navigator.language || 'en';
  
  // Build raw fingerprint payload
  const rawFingerprint = [
    canvasInfo,
    webGLInfo,
    cpuCores,
    ramSize,
    screenDetails,
    platformInfo,
    language
  ].join('##');
  
  return await sha256(rawFingerprint);
}
