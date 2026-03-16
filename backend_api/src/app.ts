import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import intentionRoutes from './routes/intentionRoutes.js';


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

// auth routes: POST /auth/register, POST /auth/login
app.use('/auth', authRoutes);

// session routes: POST /api/sessions, GET /api/sessions
app.use('/api', sessionRoutes);

// profile routes: GET /api/profile, PUT /api/profile
app.use('/api', profileRoutes);

// intention routes: POST/GET /api/intentions, GET /api/intentions/current, DELETE /api/intentions/:id
app.use('/api/intentions', intentionRoutes);


// start the server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Mat time is starting on http://localhost:${PORT}`);
});

export default app; 