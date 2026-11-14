import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const quote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";
export const shellCommand = (args) => 'exec ' + args.map(quote).join(' ');
const tmux = (args) =>
  execFileSync('tmux', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const links = [
  'Website: http://127.0.0.1:8788',
  'Studio:  http://127.0.0.1:54323',
  'Inbox:   http://127.0.0.1:54324',
];

export function createSession({ session, cwd, commands }) {
  const toolsCommand =
    "printf '%s\\n' " +
    links.map(quote).join(' ') +
    '; ' +
    shellCommand([process.env.SHELL || '/bin/sh']);
  const tools = tmux([
    'new-session',
    '-d',
    '-s',
    session,
    '-n',
    'local',
    '-c',
    cwd,
    '-e',
    `PATH=${process.env.PATH || ''}`,
    '-e',
    `SCHEMA_REPO_DIR=${resolve(process.env.SCHEMA_REPO_DIR || resolve(cwd, '../takeoff-tokyo-supabase'))}`,
    '-x',
    '160',
    '-y',
    '48',
    '-P',
    '-F',
    '#{pane_id}',
    toolsCommand,
  ]);
  try {
    const window = tmux(['display-message', '-p', '-t', tools, '#{window_id}']);
    tmux(['set-option', '-w', '-t', window, 'remain-on-exit', 'on']);
    tmux(['set-option', '-w', '-t', window, 'pane-border-status', 'top']);
    tmux(['set-option', '-w', '-t', window, 'pane-border-format', ' #{pane_title} ']);
    tmux(['select-pane', '-t', tools, '-T', 'Shell · Studio & inbox links']);
    const panes = [];
    for (const [title, args] of commands) {
      const pane = tmux([
        'split-window',
        '-d',
        '-t',
        tools,
        '-c',
        cwd,
        '-P',
        '-F',
        '#{pane_id}',
        shellCommand(args),
      ]);
      tmux(['select-pane', '-t', pane, '-T', title]);
      panes.push(pane);
      tmux(['select-layout', '-t', window, 'tiled']);
    }
    if (panes[0]) tmux(['select-pane', '-t', panes[0]]);
    return { window, panes, tools };
  } catch (error) {
    // Only discard the session created by this invocation if layout setup failed.
    spawnSync('tmux', ['kill-session', '-t', '=' + session], { stdio: 'ignore' });
    throw error;
  }
}

function runScript(name, args = []) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', name), ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(`${name} ${args.join(' ')} failed; the tmux services were not started.`);
}

function main() {
  let session = process.env.TAKEOFF_TMUX_SESSION || 'takeoff-tokyo';
  let detach = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--detach') detach = true;
    else if (args[i] === '--session') session = args[++i] || '';
    else if (args[i] === '--help') {
      console.log(
        'Usage: npm run local:tmux -- [--detach] [--session NAME]\nStarts local Supabase, prepares local credentials and Stripe, then opens a four-pane tmux session. Running it again reattaches to the existing session.',
      );
      return;
    } else throw Error(`Unknown option: ${args[i]}`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(session))
    throw Error('Session name must contain only letters, numbers, underscores, or hyphens.');
  if (spawnSync('tmux', ['-V'], { stdio: 'ignore' }).status !== 0)
    throw Error('tmux is required to run local:tmux.');
  const target = '=' + session;
  const existing =
    spawnSync('tmux', ['has-session', '-t', target], { stdio: 'ignore' }).status === 0;
  if (!existing) {
    for (const binary of ['docker', 'stripe'])
      if (spawnSync(binary, ['--version'], { stdio: 'ignore' }).status !== 0)
        throw Error(`${binary} is required to run local:tmux.`);
    if (!existsSync(resolve(root, 'node_modules/.bin/supabase')))
      throw Error('Install the project dependencies before running local:tmux.');
    console.log('Starting local Supabase and preparing the development environment…');
    runScript('local-testing.mjs', ['start']);
    runScript('local-testing.mjs', ['prepare']);
    // Write the listener secret before the website reads its runtime bindings.
    runScript('local-stripe.mjs', ['--configure-only']);
    createSession({
      session,
      cwd: root,
      commands: [
        [
          'Website & API · :8788',
          [process.execPath, resolve(root, 'scripts/local-testing.mjs'), 'web'],
        ],
        [
          'Stripe webhooks',
          [process.execPath, resolve(root, 'scripts/local-stripe.mjs'), '--listen-only'],
        ],
        [
          'Ticket email worker',
          [process.execPath, resolve(root, 'scripts/local-testing.mjs'), 'email'],
        ],
      ],
    });
  }
  console.log(`tmux session: ${session}\n${links.join('\n')}`);
  if (detach || !process.stdin.isTTY) {
    console.log(`Attach with: tmux attach-session -t ${session}`);
    return;
  }
  const result = spawnSync(
    'tmux',
    [process.env.TMUX ? 'switch-client' : 'attach-session', '-t', target],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('Local tmux startup failed:', error.message);
    process.exitCode = 1;
  }
}
