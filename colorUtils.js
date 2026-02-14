/**
 * Color conversion utilities for PDF dark mode
 */
const ColorUtils = {
  // Convert RGB to XYZ color space
  rgbToXyz: function(r, g, b) {
    // Normalize RGB values
    r = r / 255;
    g = g / 255;
    b = b / 255;
    
    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // Scale the values
    r *= 100;
    g *= 100;
    b *= 100;
    
    // Convert to XYZ
    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    
    return { x, y, z };
  },
  
  // Convert XYZ to Lab color space
  xyzToLab: function(x, y, z) {
    // D65 standard illuminant reference values
    const refX = 95.047;
    const refY = 100.0;
    const refZ = 108.883;
    
    x = x / refX;
    y = y / refY;
    z = z / refZ;
    
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
    
    const l = (116 * y) - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);
    
    return { l, a, b };
  },
  
  // Convert Lab to XYZ color space
  labToXyz: function(l, a, b) {
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;
    
    // D65 standard illuminant reference values
    const refX = 95.047;
    const refY = 100.0;
    const refZ = 108.883;
    
    // Apply the reverse transformation
    x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16/116) / 7.787;
    y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16/116) / 7.787;
    z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16/116) / 7.787;
    
    x *= refX;
    y *= refY;
    z *= refZ;
    
    return { x, y, z };
  },
  
  // Convert XYZ to RGB color space
  xyzToRgb: function(x, y, z) {
    // Normalize the values
    x = x / 100;
    y = y / 100;
    z = z / 100;
    
    // Apply the transformation matrix
    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let b = x * 0.0557 + y * -0.2040 + z * 1.0570;
    
    // Apply gamma correction
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1/2.4) - 0.055 : 12.92 * b;
    
    // Clamp the values
    r = Math.max(0, Math.min(1, r)) * 255;
    g = Math.max(0, Math.min(1, g)) * 255;
    b = Math.max(0, Math.min(1, b)) * 255;
    
    return {
      r: Math.round(r),
      g: Math.round(g),
      b: Math.round(b)
    };
  },
  
  // Convert RGB to Lab color space
  rgbToLab: function(r, g, b) {
    const xyz = this.rgbToXyz(r, g, b);
    return this.xyzToLab(xyz.x, xyz.y, xyz.z);
  },
  
  // Convert Lab to RGB color space
  labToRgb: function(l, a, b) {
    const xyz = this.labToXyz(l, a, b);
    return this.xyzToRgb(xyz.x, xyz.y, xyz.z);
  },
  
  // Invert the color using Lab color space
  invertColor: function(r, g, b, inversionStrength, contrastLevel) {
    // Convert to Lab
    const lab = this.rgbToLab(r, g, b);

    // Clamp inputs
    const strength = Math.max(0, Math.min(100, Number(inversionStrength || 100)));
    const contrast = Math.max(0, Math.min(300, Number(contrastLevel || 100)));

    // Original L
    const origL = lab.l;
    // Target inverted L
    const invertedL = 100 - origL;

    // Interpolate between original and inverted using inversion strength (0-100)
    const t = strength / 100;
    let newL = origL * (1 - t) + invertedL * t;

    // Apply contrast around midpoint (50)
    const contrastFactor = contrast / 100;
    const midpoint = 50;
    newL = midpoint + (newL - midpoint) * contrastFactor;

    // Ensure L is within valid range
    newL = Math.max(0, Math.min(100, newL));

    // Build new Lab color
    const newLab = { l: newL, a: lab.a, b: lab.b };

    // Convert back to RGB
    return this.labToRgb(newLab.l, newLab.a, newLab.b);
  },
  
  // Calculate CIE2000 distance between two Lab colors
  deltaE2000: function(lab1, lab2) {
    const { l: l1, a: a1, b: b1 } = lab1;
    const { l: l2, a: a2, b: b2 } = lab2;
    
    // Implementation of the CIEDE2000 color difference algorithm
    // This is a complex calculation to determine perceptual color difference
    // Simplified version for our use case
    const deltaL = l2 - l1;
    const meanL = (l1 + l2) / 2;
    const deltaA = a2 - a1;
    const deltaB = b2 - b1;
    
    const c1 = Math.sqrt(a1 * a1 + b1 * b1);
    const c2 = Math.sqrt(a2 * a2 + b2 * b2);
    const deltaC = c2 - c1;
    
    const deltaH = Math.sqrt(deltaA * deltaA + deltaB * deltaB - deltaC * deltaC);
    
    const sL = 1;
    const sC = 1 + 0.045 * ((c1 + c2) / 2);
    const sH = 1 + 0.015 * ((c1 + c2) / 2);
    
    const deltaLKlsl = deltaL / sL;
    const deltaCKcsc = deltaC / sC;
    const deltaHKhsh = deltaH / sH;
    
    return Math.sqrt(
      deltaLKlsl * deltaLKlsl + 
      deltaCKcsc * deltaCKcsc + 
      deltaHKhsh * deltaHKhsh
    );
  }
};

// Export the ColorUtils object
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = ColorUtils;
} else {
  window.ColorUtils = ColorUtils;
}
