// GET /daily/seed?date=YYYY-MM-DD -- see DAILY_CHALLENGE_AWS_SETUP.md #4, #7.3.
//
// Idempotent create-then-read: PutItem a fresh random seed guarded by
// attribute_not_exists(date); on a conditional-check failure (another
// request already created today's row), GetItem the existing one instead.
// First writer wins, and every subsequent reader -- including the validate
// Lambda -- sees the same seed for the day.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SEEDS_TABLE = process.env.SEEDS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const todayUTC = () => new Date().toISOString().slice(0, 10);

// 8 lowercase letters, matching src/core/rng.js's setRandomSeed() alphabet
// -- setSeed() itself SHA-1s whatever string it's given, so any string
// would work, but staying in the same alphabet keeps a server-generated
// seed indistinguishable from a locally-generated one.
const randomSeedPhrase = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== 'GET') {
    return json(405, { reason: 'Method not allowed.' });
  }

  // Defaults to today -- and refuses any other date -- so the seed stays
  // unpredictable until its own day (DAILY_CHALLENGE_DESIGN.md #7.3).
  const date = event.queryStringParameters?.date || todayUTC();
  if (date !== todayUTC()) {
    return json(400, { reason: 'date must be the current UTC date.' });
  }

  const seed = randomSeedPhrase();
  const createdAt = new Date().toISOString();
  try {
    await client.send(
      new PutCommand({
        TableName: SEEDS_TABLE,
        Item: { date, seed, createdAt },
        ConditionExpression: 'attribute_not_exists(#d)',
        ExpressionAttributeNames: { '#d': 'date' },
      })
    );
    return json(200, { date, seed });
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') {
      throw err;
    }
    const { Item } = await client.send(
      new GetCommand({ TableName: SEEDS_TABLE, Key: { date } })
    );
    return json(200, { date, seed: Item.seed });
  }
};
