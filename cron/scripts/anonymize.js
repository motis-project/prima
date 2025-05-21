import pg from 'pg';
const { Client } = pg;
import 'dotenv/config';

function getTimestamp(monthOffset) {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + monthOffset;
	const date = new Date(year, month, 1, 0, 0, 0);
	return Math.floor(date.getTime());
}

async function main() {
	const t1 = getTimestamp(-1);
	const t2 = getTimestamp(0) - 24 * 60 * 60 * 1000;

	const client = new Client({
		host: 'pg',
		user: 'postgres',
		password: 'pw',
		database: 'prima'
	});

	try {
		await client.connect();
		await client.query(`CALL anonymize($1, $2)`, [t1, t2]);
		console.log(
			`Anonymization successful between ${new Date(t1).toISOString()} and ${new Date(t2).toISOString()}`
		);
	} catch (error) {
		console.error('Failed to run anonymization procedure:', error);
		process.exit(1);
	} finally {
		await client.end();
	}
}

main();
