import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors'; 


//import the db config -- CRITICAL, because the type is module we are using the .js extension
// triggers the pool.connect in db.ts to test the supabase connection 
import './config/db.js';

dotenv.config();

const app = express();


//security middleware 
app.use(helmet()); // sets secure http headers
app.use(cors()); //enables cross origin resource sharing (CORS) 
app.use(express.json()); //allows the server to read json body content 


//basic routes
app.get('/', (req, res) => {
    res.send('Journada Backend API is running');
});


// start the server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
});

export default app; 