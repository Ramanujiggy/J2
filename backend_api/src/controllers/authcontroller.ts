// Controller- this talks to the user via requests and then feeds back to the model

import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as userModel from '../models/userModel.js';

// ---- Register ---------------------------------------------------------------

export const register = async (req: Request, res: Response) => {
    try {
        const {email, password } = req.body;

        //validation that email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // check if the user already exists, using the user model
        const existingUser = await userModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        //Hardening: scrable the password using bcrypt
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        //save the new user using the user model
        const newUser  = await userModel.createUser(email, hashedPassword);

        //success response
        res.status(201).json({ message: "User registered successfully.",
            user: {id: newUser.id, email: newUser.email}
        });

    } catch (error){
        console.error("❌ Error during user registration:", error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ---- Login ------------------------------------------------------------------

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // validation that email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // look up the user — return a generic message to avoid leaking whether the email exists
        const user = await userModel.findUserByEmail(email);
        if (!user || !user.id) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // compare the provided password against the stored hash
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // sign a JWT with the user's id and email as the payload
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('❌ JWT_SECRET is not set in environment variables');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            secret,
            { expiresIn: '24h' }
        );

        console.log('✅ User logged in:', user.email);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        console.error('❌ Error during login:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



