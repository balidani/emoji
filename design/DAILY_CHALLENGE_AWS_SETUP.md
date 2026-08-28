# Daily Challenge — AWS Setup Runbook

Companion to `DAILY_CHALLENGE_DESIGN.md`. This is the operational guide for
standing up the backend: every AWS resource, its **exact name**, its config,
and the commands to create and wire it. Read the design doc first for *why*;
this doc is *how* and *what we call things*.

Two paths are given:

- **Path A — AWS CLI (primary).** Full control over every name, transparent,
  matches "create the pieces and hook them up." Copy-paste in order.
- **Path B — AWS SAM (appendix §12).** One `template.yaml`, one
  `sam deploy`, one `sam delete` to tear down. Same names, same resources.

Do **A or B**, not both. Everything is serverless and on-demand, so an idle
backend costs ~nothing.

---

## 0. Naming — the authoritative table

The implementation agent must use these exact names everywhere (CLI, SAM,
handler env-var reads, client config). Prefix is `emoji-daily`.

| Kind | Name | Notes |
|---|---|---|
| Region | `eu-central-1` | Frankfurt — closest to Zürich. Override via `$AWS_REGION` if desired; keep it consistent across all resources. |
| DynamoDB table (seeds) | `emoji-daily-seeds` | PK `date` (S). |
| DynamoDB table (scores) | `emoji-daily-scores` | PK `pk` (S), SK `sk` (S). |
| Lambda (seed) | `emoji-daily-seed` | `GET /daily/seed`. |
| Lambda (validate) | `emoji-daily-validate` | `POST /daily/submit`. Bundles game `src/` + jsdom. |
| Lambda (leaderboard) | `emoji-daily-leaderboard` | `GET /daily/leaderboard`. |
| IAM role (seed) | `emoji-daily-seed-role` | |
| IAM role (validate) | `emoji-daily-validate-role` | |
| IAM role (leaderboard) | `emoji-daily-leaderboard-role` | |
| HTTP API | `emoji-daily-api` | API Gateway **HTTP** API (not REST). |
| API stage | `$default` | Auto-deploy; served at the API root (no stage prefix in the URL). |
| S3 bucket (optional replay archive) | `emoji-daily-replays-<ACCOUNT_ID>` | Only if audit archival is enabled. Bucket names are global — the account-id suffix keeps it unique. |
| CloudWatch log groups | `/aws/lambda/emoji-daily-*` | Created automatically per function. |

### Environment variables (set on the Lambdas)

| Var | On | Value | Purpose |
|---|---|---|---|
| `SEEDS_TABLE` | seed, validate | `emoji-daily-seeds` | |
| `SCORES_TABLE` | validate, leaderboard | `emoji-daily-scores` | |
| `APP_VERSION` | validate | e.g. `1.0.4` | Must equal the `CURRENT_VERSION` of the `src/` copy bundled into the function. Submissions with a different `appVersion` are rejected. |
| `SCORE_PAD_WIDTH` | validate | `30` | Fixed width for the zero-padded score in the sort key. Must exceed the largest plausible score's digit count. |
| `ALLOWED_ORIGIN` | validate (and CORS) | `https://<branch>.<appid>.amplifyapp.com` | The exact Amplify site origin. Add a second origin for local dev if needed. |
| `REPLAY_BUCKET` | validate (optional) | `emoji-daily-replays-<ACCOUNT_ID>` | Only if archiving replays. |

---

## 1. Prerequisites

- An AWS account and the **AWS CLI v2** installed and configured
  (`aws configure`) with credentials that can create IAM/Lambda/DynamoDB/API
  Gateway resources.
- **Node 20** locally (matches the Lambda runtime) for packaging the
  validator.
- The repo checked out at the commit you intend to validate against. The
  validator ships a **copy of `src/`** from that commit; the seed the site
  plays and the code the server validates with must be the same version.
- Your Amplify site's origin URL (Amplify console → your app → the branch
  domain, e.g. `https://main.d1abcd2efgh.amplifyapp.com`, or your custom
  domain).

Set shell variables used throughout Path A:

```bash
export AWS_REGION=eu-central-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ALLOWED_ORIGIN='https://<branch>.<appid>.amplifyapp.com'   # <-- edit
export APP_VERSION=1.0.4                                          # <-- match src/ CURRENT_VERSION
```

---

## 2. DynamoDB tables

On-demand billing (`PAY_PER_REQUEST`) so there's no capacity to manage and it
scales to zero.

```bash
aws dynamodb create-table \
  --table-name emoji-daily-seeds \
  --attribute-definitions AttributeName=date,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region "$AWS_REGION"

aws dynamodb create-table \
  --table-name emoji-daily-scores \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST --region "$AWS_REGION"
```

### Item shapes (contract for the handlers)

**`emoji-daily-seeds`**

```
{ "date": "2026-08-07",            // UTC date, PK
  "seed": "qkzmrtba",             // the day's seed phrase
  "createdAt": "2026-08-07T00:00:11Z" }
```

**`emoji-daily-scores`** — one partition per day, sorted so a single
descending query yields the top 100.

```
{ "pk": "DATE#2026-08-07",                        // PK
  "sk": "SCORE#000...0004210#<submissionId>",     // "SCORE#" + zeroPad(score, SCORE_PAD_WIDTH) + "#" + uuid
  "name": "dan",                                   // sanitized player name
  "score": "4210",                                 // exact integer as a string (may exceed JS safe int)
  "ts": "2026-08-07T13:02:44Z",
  "appVersion": "1.0.4",
  "replayKey": "2026-08-07/<submissionId>.txt"     // optional, only if archiving to S3
}
```

Top-100 query the leaderboard handler runs:
`Query(pk = "DATE#"+date, ScanIndexForward=false, Limit=100)`. Rank = index.

---

## 3. IAM roles (least privilege, one per function)

Shared Lambda trust policy:

```bash
cat > /tmp/lambda-trust.json <<'JSON'
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole" }] }
JSON
```

Create the three roles and attach basic logging to each:

```bash
for R in emoji-daily-seed-role emoji-daily-validate-role emoji-daily-leaderboard-role; do
  aws iam create-role --role-name "$R" \
    --assume-role-policy-document file:///tmp/lambda-trust.json
  aws iam attach-role-policy --role-name "$R" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
done
```

Inline data-access policies:

```bash
SEEDS_ARN="arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/emoji-daily-seeds"
SCORES_ARN="arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/emoji-daily-scores"

# seed: put + get on seeds only
cat > /tmp/seed-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[
  { "Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:GetItem"],"Resource":"${SEEDS_ARN}" }]}
JSON
aws iam put-role-policy --role-name emoji-daily-seed-role \
  --policy-name data --policy-document file:///tmp/seed-policy.json

# validate: read seeds, write + query scores
cat > /tmp/validate-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[
  { "Effect":"Allow","Action":["dynamodb:GetItem"],"Resource":"${SEEDS_ARN}" },
  { "Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:Query"],"Resource":"${SCORES_ARN}" }]}
JSON
aws iam put-role-policy --role-name emoji-daily-validate-role \
  --policy-name data --policy-document file:///tmp/validate-policy.json

# leaderboard: query scores only
cat > /tmp/leaderboard-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[
  { "Effect":"Allow","Action":["dynamodb:Query"],"Resource":"${SCORES_ARN}" }]}
JSON
aws iam put-role-policy --role-name emoji-daily-leaderboard-role \
  --policy-name data --policy-document file:///tmp/leaderboard-policy.json
```

If archiving replays, add `s3:PutObject` on
`arn:aws:s3:::emoji-daily-replays-${ACCOUNT_ID}/*` to the validate policy.

---

## 4. Package the Lambdas

Create an `aws/lambda/` area in the repo with one folder per function. Handler
files are the implementation agent's job; this section pins the **file layout,
packaging rules, and handler contracts** so names line up.

```
aws/lambda/
  seed/         index.mjs  package.json
  leaderboard/  index.mjs  package.json
  validate/     index.mjs  package.json  index.html  src/  node_modules/(jsdom)
```

Rules:

- **ESM handlers.** Each function's `package.json` has `"type": "module"` and
  the handler exports `export const handler = async (event) => {...}`
  (`--handler index.handler`).
- **AWS SDK v3 is in the Node 20 runtime** — import `@aws-sdk/client-dynamodb`
  / `@aws-sdk/lib-dynamodb` (and `@aws-sdk/client-s3` if archiving) **without
  bundling** them.
- **`seed` and `leaderboard` are tiny** — no third-party deps, just the SDK
  from the runtime. Zip `index.mjs` + `package.json`.
- **`validate` bundles the game unmodified.** It must contain:
  - a **raw copy of the repo's `src/`** — do **not** esbuild/minify it;
    `catalog.js` uses dynamic `import(source)` on relative paths that only
    resolve if the files exist on disk in the zip;
  - a copy of the repo's **`index.html`** — the validator loads its `<body>`
    into jsdom and clones the template into `.game`, exactly as
    `test/unit/replay-roundtrip.test.js` does, so every selector the engine
    touches (`.game .info`, `.game .shop`, `.game .progression-bar`, the score
    screen in `game.over()`) resolves like it does in the browser;
  - `node_modules/` with **jsdom** only (`npm install jsdom` inside
    `aws/lambda/validate/`).

A build script keeps the bundled `src/`/`index.html` in sync and stamps the
version:

```bash
# aws/lambda/validate/build.sh  (run from repo root)
set -euo pipefail
cd aws/lambda/validate
rm -rf src index.html
cp -R ../../../src ./src
cp ../../../index.html ./index.html
npm install --omit=dev jsdom
zip -qr function.zip index.mjs package.json index.html src node_modules
echo "APP_VERSION should be: $(grep -oE "CURRENT_VERSION = '[^']+'" src/progression.js)"
```

For `seed` and `leaderboard`:

```bash
( cd aws/lambda/seed        && zip -qr function.zip index.mjs package.json )
( cd aws/lambda/leaderboard && zip -qr function.zip index.mjs package.json )
```

### Handler contracts

All handlers speak API Gateway **HTTP API payload format 2.0**: method at
`event.requestContext.http.method`, query at `event.queryStringParameters`,
body at `event.body` (JSON string; may be base64 per `event.isBase64Encoded`).
All responses set `Access-Control-Allow-Origin: $ALLOWED_ORIGIN` and JSON
`content-type`.

- **`emoji-daily-seed`** — `GET /daily/seed?date=YYYY-MM-DD`
  - Default `date` to the current **UTC** date. Reject any date that isn't the
    current UTC date (keeps the seed unpredictable until its day) → `400`.
  - Idempotent create-then-read on `emoji-daily-seeds`: `PutItem` a fresh
    random seed with `ConditionExpression: attribute_not_exists(#d)`; on
    `ConditionalCheckFailedException`, `GetItem` the existing row. First writer
    wins; everyone (including the validator) sees the same seed.
  - Seed phrase: 8 lowercase letters (matches `rng.js` `setRandomSeed`'s
    alphabet), or any string — `setSeed` SHA-1s it.
  - Response `200 { "date", "seed" }`.

- **`emoji-daily-validate`** — `POST /daily/submit`
  - Body `{ "date", "name", "replay" }` (`replay` = the base64 `EMOJIRPLY1`
    code from `recorder.serialize()`).
  - Reject if `date` isn't the current UTC date, or `name` fails
    sanitization (trim; ≤ 20 graphemes; strip control chars; optional profanity
    filter).
  - `GetItem` the day's seed from `emoji-daily-seeds` (`404`/`409` if missing —
    shouldn't happen if the client fetched a seed first).
  - Set up jsdom globals (`window`, `document`) from the bundled `index.html`;
    ensure `globalThis.crypto` (Node 20 webcrypto), `TextEncoder`,
    `Intl.Segmenter` are present (all native in Node 20 except the DOM).
  - Call the design doc's headless `validateReplay(replay, { seed, appVersion:
    process.env.APP_VERSION })` from the bundled `src/replay.js`. That function:
    rejects on `appVersion` mismatch; `setSeed(seed)` **before** building the
    catalog (so import-time draws match — see `rng.js`/`bootstrap.js`); builds
    the canonical daily catalog + `restrictTo(dailyAllowedEmoji(...))`;
    constructs the canonical daily `Game`; drives the recorded `events`; and
    returns `{ valid, score, reason? }`. Invalid → `422 { reason }`.
  - On valid: write the `emoji-daily-scores` row (§2 shape; `score` computed
    server-side, never from the client), optionally archive the raw replay to
    S3, then run the top-100 query.
  - Response `200 { "score", "rank", "top": [ { "name","score","rank" }, ... ] }`.

- **`emoji-daily-leaderboard`** — `GET /daily/leaderboard?date=YYYY-MM-DD`
  - Query top 100 for the date (§2). Response `200 { "date", "top": [...] }`.

---

## 5. Create the Lambda functions

```bash
# seed
aws lambda create-function --function-name emoji-daily-seed \
  --runtime nodejs20.x --handler index.handler \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/emoji-daily-seed-role" \
  --timeout 5 --memory-size 128 \
  --environment "Variables={SEEDS_TABLE=emoji-daily-seeds}" \
  --zip-file fileb://aws/lambda/seed/function.zip --region "$AWS_REGION"

# leaderboard
aws lambda create-function --function-name emoji-daily-leaderboard \
  --runtime nodejs20.x --handler index.handler \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/emoji-daily-leaderboard-role" \
  --timeout 5 --memory-size 128 \
  --environment "Variables={SCORES_TABLE=emoji-daily-scores}" \
  --zip-file fileb://aws/lambda/leaderboard/function.zip --region "$AWS_REGION"

# validate (more memory + time for jsdom + full replay)
aws lambda create-function --function-name emoji-daily-validate \
  --runtime nodejs20.x --handler index.handler \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/emoji-daily-validate-role" \
  --timeout 30 --memory-size 1024 \
  --environment "Variables={SEEDS_TABLE=emoji-daily-seeds,SCORES_TABLE=emoji-daily-scores,APP_VERSION=${APP_VERSION},SCORE_PAD_WIDTH=30,ALLOWED_ORIGIN=${ALLOWED_ORIGIN}}" \
  --zip-file fileb://aws/lambda/validate/function.zip --region "$AWS_REGION"
```

Redeploy after code changes with
`aws lambda update-function-code --function-name <name> --zip-file fileb://.../function.zip`.
IAM role creation can lag a few seconds — if `create-function` complains the
role can't be assumed, wait and retry.

---

## 6. HTTP API + routes + CORS

CORS is configured **on the API** (HTTP APIs answer the OPTIONS preflight
automatically — no OPTIONS route needed):

```bash
API_ID=$(aws apigatewayv2 create-api \
  --name emoji-daily-api --protocol-type HTTP \
  --cors-configuration "AllowOrigins=${ALLOWED_ORIGIN},AllowMethods=GET,POST,AllowHeaders=content-type,MaxAge=300" \
  --query ApiId --output text --region "$AWS_REGION")
echo "API_ID=$API_ID"
```

Create one AWS_PROXY integration + route per function:

```bash
route () {  # $1 function name, $2 route key
  local fn="$1" key="$2"
  local integ
  integ=$(aws apigatewayv2 create-integration --api-id "$API_ID" \
    --integration-type AWS_PROXY --payload-format-version 2.0 \
    --integration-uri "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${fn}" \
    --query IntegrationId --output text --region "$AWS_REGION")
  aws apigatewayv2 create-route --api-id "$API_ID" \
    --route-key "$key" --target "integrations/${integ}" --region "$AWS_REGION"
}
route emoji-daily-seed        'GET /daily/seed'
route emoji-daily-validate    'POST /daily/submit'
route emoji-daily-leaderboard 'GET /daily/leaderboard'
```

`$default` stage with auto-deploy + basic throttling (protects the validator):

```bash
aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' \
  --auto-deploy \
  --default-route-settings 'ThrottlingBurstLimit=20,ThrottlingRateLimit=10' \
  --region "$AWS_REGION"
```

Allow API Gateway to invoke each function:

```bash
perm () {  # $1 function, $2 statement-id suffix, $3 route path
  aws lambda add-permission --function-name "$1" \
    --statement-id "apigw-$2" --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/$3" \
    --region "$AWS_REGION"
}
perm emoji-daily-seed        seed        'daily/seed'
perm emoji-daily-validate    submit      'daily/submit'
perm emoji-daily-leaderboard leaderboard 'daily/leaderboard'
```

Get the base URL (with `$default`, routes live directly under it):

```bash
API_URL=$(aws apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text --region "$AWS_REGION")
echo "$API_URL"   # e.g. https://abc123.execute-api.eu-central-1.amazonaws.com
```

---

## 7. Wire the client

Add the base URL to the site's config (a small `config.js` read by the daily
mode code, or an Amplify build-time env var surfaced into the bundle — do
**not** hardcode secrets, there are none):

```js
export const DAILY_API_BASE = 'https://abc123.execute-api.eu-central-1.amazonaws.com';
```

Client calls, matching the handler contracts:

- On entering daily mode: `GET ${DAILY_API_BASE}/daily/seed` → seed the run.
- On game over in daily mode: `POST ${DAILY_API_BASE}/daily/submit` with
  `{ date, name, replay: recorder.serialize() }` → render the returned `top`.
- Read-only view: `GET ${DAILY_API_BASE}/daily/leaderboard?date=...`.

If you add a local dev origin (e.g. `http://localhost:8000`), include it in the
API's `AllowOrigins` and in the validate function's `ALLOWED_ORIGIN` handling
(support a small allow-list rather than a single string).

---

## 8. Smoke test

```bash
# 1) get today's seed
curl -s "$API_URL/daily/seed"

# 2) leaderboard (empty until a valid submission lands)
curl -s "$API_URL/daily/leaderboard?date=$(date -u +%F)"

# 3) submit — use a real replay code produced by playing a daily run in the
#    browser (recorder.serialize()), or by the phase-2 Vitest round-trip.
curl -s -X POST "$API_URL/daily/submit" \
  -H 'content-type: application/json' \
  -d '{"date":"'"$(date -u +%F)"'","name":"dan","replay":"<EMOJIRPLY1...>"}'
```

Tail logs while testing:
`aws logs tail /aws/lambda/emoji-daily-validate --follow --region "$AWS_REGION"`.

A hand-written or tampered replay should come back `422` with a `reason`
(divergence) — that's the validator doing its job. A genuine completed daily
run should return a `score` and a `rank`.

---

## 9. Cost & ops

- DynamoDB on-demand, Lambda, and HTTP API all scale to zero; at hobby traffic
  this is within/near the free tier — expect cents/month, dominated by the
  validate function's memory-seconds (jsdom). Nothing is provisioned 24/7.
- Logs land in `/aws/lambda/emoji-daily-*`; set a retention policy if you care
  (`aws logs put-retention-policy --log-group-name ... --retention-in-days 14`).
- Watch validate cold starts; 1024 MB / 30 s is comfortable, tune down if
  runs are short.

---

## 10. Security checklist

- [ ] CORS `AllowOrigins` is the exact Amplify origin(s), not `*`.
- [ ] IAM: each role has only its table actions (§3); no `dynamodb:*`.
- [ ] Score is computed **server-side** from the replay; the client never
      sends a score.
- [ ] Validator rejects `appVersion` mismatches and non-current dates.
- [ ] Validator derives the start state from the **server's** seed; it does
      not trust the replay's `rng`/`seed`/`settings`/`mode` for scoring.
- [ ] Names are sanitized and length-capped.
- [ ] Stage throttling is set; consider a per-IP cap on `submit` if abused.
- [ ] No secrets on the client (the API base URL is not a secret).

---

## 11. Teardown

Path A:

```bash
aws apigatewayv2 delete-api --api-id "$API_ID" --region "$AWS_REGION"
for FN in emoji-daily-seed emoji-daily-validate emoji-daily-leaderboard; do
  aws lambda delete-function --function-name "$FN" --region "$AWS_REGION"
done
for R in emoji-daily-seed-role emoji-daily-validate-role emoji-daily-leaderboard-role; do
  aws iam delete-role-policy --role-name "$R" --policy-name data 2>/dev/null || true
  aws iam detach-role-policy --role-name "$R" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam delete-role --role-name "$R"
done
aws dynamodb delete-table --table-name emoji-daily-seeds  --region "$AWS_REGION"
aws dynamodb delete-table --table-name emoji-daily-scores --region "$AWS_REGION"
# If created: empty then delete the S3 bucket.
```

Path B: `sam delete`.

---

## 12. Appendix — Path B: SAM template

One-shot deploy/teardown alternative. Same names as the table above. Put this
at `aws/template.yaml`. Each function folder has its own `package.json`
(`"type":"module"`); `sam build` runs `npm install` per function. The
validate folder must also contain the copied `src/` and `index.html` (reuse
the copy step from §4's `build.sh`, minus the `zip`, before `sam build`).

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Emoji daily challenge backend

Parameters:
  AllowedOrigin: { Type: String }         # https://<branch>.<appid>.amplifyapp.com
  AppVersion:    { Type: String, Default: '1.0.4' }

Globals:
  Function:
    Runtime: nodejs20.x
    Handler: index.handler
    MemorySize: 128
    Timeout: 5

Resources:
  SeedsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: emoji-daily-seeds
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions: [ { AttributeName: date, AttributeType: S } ]
      KeySchema:            [ { AttributeName: date, KeyType: HASH } ]

  ScoresTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: emoji-daily-scores
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - { AttributeName: pk, AttributeType: S }
        - { AttributeName: sk, AttributeType: S }
      KeySchema:
        - { AttributeName: pk, KeyType: HASH }
        - { AttributeName: sk, KeyType: RANGE }

  DailyApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: $default
      CorsConfiguration:
        AllowOrigins: [ !Ref AllowedOrigin ]
        AllowMethods: [ GET, POST ]
        AllowHeaders: [ content-type ]
      # Physical API name: tag it; the console display name is stack-derived.
      Tags: { Name: emoji-daily-api }

  SeedFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: emoji-daily-seed
      CodeUri: lambda/seed/
      Environment: { Variables: { SEEDS_TABLE: !Ref SeedsTable } }
      Policies: [ { DynamoDBCrudPolicy: { TableName: !Ref SeedsTable } } ]
      Events:
        Get: { Type: HttpApi, Properties: { ApiId: !Ref DailyApi, Method: GET, Path: /daily/seed } }

  ValidateFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: emoji-daily-validate
      CodeUri: lambda/validate/
      MemorySize: 1024
      Timeout: 30
      Environment:
        Variables:
          SEEDS_TABLE: !Ref SeedsTable
          SCORES_TABLE: !Ref ScoresTable
          APP_VERSION: !Ref AppVersion
          SCORE_PAD_WIDTH: '30'
          ALLOWED_ORIGIN: !Ref AllowedOrigin
      Policies:
        - { DynamoDBReadPolicy:  { TableName: !Ref SeedsTable } }
        - { DynamoDBCrudPolicy:  { TableName: !Ref ScoresTable } }
      Events:
        Post: { Type: HttpApi, Properties: { ApiId: !Ref DailyApi, Method: POST, Path: /daily/submit } }

  LeaderboardFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: emoji-daily-leaderboard
      CodeUri: lambda/leaderboard/
      Environment: { Variables: { SCORES_TABLE: !Ref ScoresTable } }
      Policies: [ { DynamoDBReadPolicy: { TableName: !Ref ScoresTable } } ]
      Events:
        Get: { Type: HttpApi, Properties: { ApiId: !Ref DailyApi, Method: GET, Path: /daily/leaderboard } }

Outputs:
  ApiUrl:
    Description: Base URL for the client's DAILY_API_BASE
    Value: !Sub 'https://${DailyApi}.execute-api.${AWS::Region}.amazonaws.com'
```

Deploy:

```bash
cd aws
bash lambda/validate/copy-src.sh   # copy ../src and ../index.html into lambda/validate/
sam build
sam deploy --guided \
  --stack-name emoji-daily \
  --parameter-overrides AllowedOrigin="$ALLOWED_ORIGIN" AppVersion="$APP_VERSION" \
  --capabilities CAPABILITY_IAM
# subsequent deploys: sam build && sam deploy
```

`sam deploy` prints the `ApiUrl` output → that's the client's
`DAILY_API_BASE`. Tear down with `sam delete --stack-name emoji-daily`.

Note: SAM's HTTP API physical name is derived from the stack rather than set
to `emoji-daily-api` exactly; if an exact API name matters, use Path A, or
replace `AWS::Serverless::HttpApi` with an explicit `AWS::ApiGatewayV2::Api`
(`Name: emoji-daily-api`) plus integrations/routes. Every other resource is
named exactly per §0.
