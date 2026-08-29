// This app is on Express 4.x (confirmed via package.json), which does
// NOT automatically forward a rejected promise from an async route
// handler to next(err) -- that behavior only arrives in Express 5.
// Every controller in this codebase currently wraps its body in its own
// try/catch as a matter of convention, which works today, but it's a
// convention, not a guarantee: the first future handler that forgets
// one turns into an unhandled promise rejection that never reaches
// server.js's centralized error handler. On Vercel's serverless
// runtime that typically surfaces as a raw platform-level crash --
// no JSON body, no helmet headers, inconsistent behavior -- rather
// than the clean, generic error response every other failure mode in
// this app produces.
//
// Wrapping a route handler in asyncHandler makes that structural rather
// than conventional: any thrown error or rejected promise from the
// wrapped function is caught here and handed to next(err), so it always
// reaches the centralized handler in server.js, even if that handler's
// own try/catch is ever accidentally omitted.
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
