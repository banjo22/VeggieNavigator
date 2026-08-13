export function createScanGate(cooldownMs = 2500) {
  let lastCode = "";
  let lastAt = 0;
  return (code: string, now = Date.now()) => {
    if (code === lastCode && now - lastAt < cooldownMs) return false;
    lastCode = code;
    lastAt = now;
    return true;
  };
}
