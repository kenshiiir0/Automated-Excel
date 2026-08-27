// Launches backend (server.js) and frontend (Vite) together for local development.
// Written as a plain Node script (instead of an inline npm "dev" one-liner) because
// Windows cmd.exe was mangling the nested double-quotes concurrently's CLI needs,
// producing a bogus "'conc' is not recognized" error.
import concurrently from 'concurrently';

concurrently(
  [
    { command: 'node server.js', name: 'BACKEND', prefixColor: 'blue' },
    { command: 'npm run dev --prefix frontend', name: 'FRONTEND', prefixColor: 'green' },
  ],
  {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 0,
  }
).result.catch(() => process.exit(1));
