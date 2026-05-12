import { Pool, types } from 'pg';
import dotenv from 'dotenv';


//loading variables from .env file
dotenv.config();

// Return PostgreSQL DATE columns as raw YYYY-MM-DD strings instead of JS Date
// objects. All our models type these fields as `string` and call `.slice(0,10)`
// on them — without this override the pg driver silently parses them into Date,
// which breaks string methods at runtime (e.g. intentionController:64).
types.setTypeParser(types.builtins.DATE, (val: string) => val);


// 2. configure the connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // required for Supabase / cloud providers
    },
    max: 20,                        // max concurrent connections (pg default is 10)
    idleTimeoutMillis: 30_000,      // close idle connections after 30s
    connectionTimeoutMillis: 5_000, // fail fast if pool is exhausted
    application_name: 'journada-backend',
});

// connection smoke test

pool.on('connect', () => {
    console.log('✅ connected to db');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// export the query helper
export const query = (text: string, params?: unknown[]) => pool.query(text, params);



//hard handshake test

const testConnection = async ()=> {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ PostgreSQL Connected! Database time is:', res.rows[0].now);
    } catch (err) {
        console.error('❌Database connection failed:', err);
    }};

testConnection();

export default pool;