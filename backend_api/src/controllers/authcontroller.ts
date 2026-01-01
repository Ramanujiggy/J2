// Controller- this talks to the user via requests and then feeds back to the model 

import { Request, Response } from 'express'; 
import bcrypt from 'bcrypt'; 
import * as userModel from '../models/userModel.js';


//register a new user 

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


    }
    catch (error){
        console.error("❌ Error during user registration:", error);
        res.status(500).json({ message: 'Server error' })
    }
    };



