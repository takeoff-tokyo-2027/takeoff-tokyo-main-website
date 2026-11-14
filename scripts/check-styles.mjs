import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokenFile = 'src/styles/tokens.css';
const errors = [];
const report = (file, message) => errors.push(`${file}: ${message}`);
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const files = filesIn(join(root, 'src'));
const styles = files.filter(file => file.endsWith('.css')).map(file => ({
  file: relative(root, file),
  // Comments must not be mistaken for declarations or variable references.
  css: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
}));
const uiCss = readFileSync(fileURLToPath(import.meta.resolve('@takeoff-tokyo/ui/css')), 'utf8');
const definitions = new Set(
  [...[uiCss, ...styles.map(({ css }) => css)].join('\n').matchAll(/(--[\w-]+)\s*:/g)]
    .map(match => match[1]),
);
const rawColor = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\s*\(/i;
const typeProperties = /^(?:font(?:-family|-size|-weight)?|line-height|letter-spacing|border-radius|z-index)$/;
const spacingProperties = /^(?:(?:margin|padding|scroll-margin|scroll-padding)(?:-[\w-]+)?|gap|row-gap|column-gap|outline-offset)$/;
const fontRoles = new Set(['body']);
const breakpoints = new Set(['480', '640', '768', '1024', '1200']);

function checkVariables(file, css) {
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!definitions.has(match[1])) report(file, `undefined variable ${match[1]}`);
  }
  for (const [, role] of css.matchAll(/--site-font-size-([\w-]+)\s*:/g)) {
    if (file !== tokenFile || !fontRoles.has(role)) {
      report(file, `font-size-${role}: use the single shared font size in ${tokenFile}`);
    }
  }
}

function checkBreakpoints(file, css) {
  for (const [, condition] of css.matchAll(/@media\s*([^{}]+)/g)) {
    if (!/width/.test(condition)) continue;
    const breakpoint = condition.trim().match(/^\(width (?:<|>=) (\d+)px\)$/);
    if (!breakpoint) {
      report(file, 'use a documented width range breakpoint');
    } else if (!breakpoints.has(breakpoint[1])) {
      report(file, 'use a shared breakpoint: 480, 640, 768, 1024, or 1200px');
    }
  }
}

function checkDeclarations(file, css) {
  // Site styles use plain CSS declarations, including declarations inside media rules.
  for (const [, property, value] of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    if (rawColor.test(value)) report(file, `${property}: put literal colors in ${tokenFile}`);
    if (property === 'font-size' && !/^(?:100%|inherit|var\(--site-font-size-[\w-]+\))$/.test(value.trim())) {
      report(file, 'font-size: use --site-font-size-body (root font-size may be 100%)');
    }
    if (typeProperties.test(property) && !/var\(/.test(value)
      && !/^(?:0|50%|100%|inherit|initial|unset|normal)$/.test(value.trim())) {
      report(file, `${property}: use a shared variable`);
    }
    if (property === 'max-width' && !/^(?:none|100%|var\([\s\S]+\))$/.test(value.trim())) {
      report(file, 'max-width: use a shared container width or reading measure');
    }
    if (/^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?(?:-color)?)$/.test(property)
      && !/var\(/.test(value) && !/^(?:0|none|transparent|currentColor|inherit|initial|unset)$/i.test(value.trim())) {
      report(file, `${property}: use a theme variable`);
    }
    if (spacingProperties.test(property)) {
      // Zero env fallbacks and the visually-hidden -1px margin are structural.
      const dimensions = value.replace(/(?<![\w.])0px\b/g, '0').replace(/(?<![\w.])-1px\b/g, '0');
      if (/-?(?:\d*\.)?\d+(?:px|rem|em)\b/.test(dimensions)) {
        report(file, `${property}: use a spacing variable`);
      }
    }
  }
}

function checkComponentStyles(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    const inline = ts.isJsxAttribute(node) && node.name.getText(source) === 'style';
    const styleTag = (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(source) === 'style';
    const styleMutation = ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      && /\.style(?:\.|\[|$)/.test(node.left.getText(source));
    if (inline || styleTag || styleMutation) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      report(`${relative(root, file)}:${line + 1}`, 'use a CSS class instead of inline styling');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

for (const { file, css } of styles) {
  checkVariables(file, css);
  if (file === tokenFile) continue;
  checkBreakpoints(file, css);
  checkDeclarations(file, css);
}

for (const file of files.filter(file => /\.[jt]sx?$/.test(file))) {
  checkComponentStyles(file);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Style policy passed (${styles.length} stylesheets; theme variables and component styles checked).`);
}
