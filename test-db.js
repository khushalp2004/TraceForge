import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM "Error" ORDER BY "lastSeen" DESC LIMIT 5;');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

run().catch(console.error);
