import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; 



import test from 'node:test';


//loading variables from .env file 
dotenv.config(); 


// 2. configure the connection pool 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: false //this allow the connection to supabase/cloud providers
    }
}); 

//connection smoke test 

pool.on('connect', ()=> {
    console.log('✅connect to db successful');
}); 

pool.on('error', (err)=> {
    console.error('❌Unexpected error on idle client', err);
    process.exit(-1);
});

//export the query helper
export const query = (text: string, params?: any[])=> pool.query(text,params); 



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