// GET /daily/leaderboard?date=YYYY-MM-DD -- see DAILY_CHALLENGE_AWS_SETUP.md
// #4, #7.4. Read-only top-100 query, defaulting to today; unlike /daily/seed
// and /daily/submit this does not reject other dates -- viewing a past day's
// board is harmless (only the seed endpoint gates on "current date" to keep
// the seed unpredictable ahead of time).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SCORES_TABLE = process.env.SCORES_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const todayUTC = () => new Date().toISOString().slice(0, 10);

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== 'GET') {
    return json(405, { reason: 'Method not allowed.' });
  }

  const date = event.queryStringParameters?.date || todayUTC();

  // Top-100 in one query: SK is "SCORE#" + zero-padded score + submissionId,
  // so descending SK order is descending score order (see
  // DAILY_CHALLENGE_AWS_SETUP.md #2). Rank is just the row index.
  const { Items } = await client.send(
    new QueryCommand({
      TableName: SCORES_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `DATE#${date}` },
      ScanIndexForward: false,
      Limit: 100,
    })
  );

  const top = (Items ?? []).map((item, i) => ({
    name: item.name,
    score: Number(item.score),
    topEmoji: (item.topEmoji ?? []).map(({ emoji, money }) => ({
      emoji,
      money: Number(money),
    })),
    rank: i + 1,
  }));

  return json(200, { date, top });
};
