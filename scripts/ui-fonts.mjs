import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';

// The published UI stylesheet embeds TTF data URLs. Keep its font declarations
// and theme intact, but let Vite serve our compressed fonts as cacheable assets.
/** @returns {import('vite').Plugin} */
export function uiFonts() {
  const stylesheet = realpathSync(fileURLToPath(import.meta.resolve('@takeoff-tokyo/ui/css')));
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/fonts');
  const { fonts } = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));

  return {
    name: 'takeoff-ui-fonts',
    enforce: 'pre',
    load(id) {
      if (normalizePath(id) !== normalizePath(stylesheet)) return;
      return readFileSync(stylesheet, 'utf8').replace(
        /url\(data:font\/ttf;base64,([A-Za-z0-9+/=]+)\)\s*format\("truetype"\)/g,
        (_match, data) => {
          const hash = createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
          const filename = fonts[hash];
          if (!filename)
            throw new Error('UI fonts changed. Run python3 scripts/prepare-ui-fonts.py.');
          return `url("${normalizePath(resolve(directory, filename))}") format("woff2")`;
        },
      );
    },
  };
}
