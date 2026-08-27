// Build-time/deploy-time site config. No secrets belong here -- the Daily
// Challenge API base URL is not sensitive, just environment-specific (see
// DAILY_CHALLENGE_AWS_SETUP.md #7).
//
// Empty until the AWS backend is deployed and this is pointed at it, e.g.
// 'https://abc123.execute-api.eu-central-1.amazonaws.com'. daily-api.js
// treats an empty string as "Daily Challenge backend not configured".
export const DAILY_API_BASE =
  'https://monavr1mh0.execute-api.eu-central-1.amazonaws.com';
