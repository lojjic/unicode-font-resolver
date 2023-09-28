/**
 * Very simplistic check for Korean/Japanese languages
 * https://gist.github.com/ceshine/1f8cd81ce34d89f1429d0928c28d97e4#file-detector-py
 */
export function detectLanguage(text: string): string {
  if (/[\uac00-\ud7a3]/.test(text)) return 'ko'
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'
  // zh-Hant?
  return 'en'
}
