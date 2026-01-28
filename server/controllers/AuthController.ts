import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { storage } from '../storage';
import { hashPassword } from '../auth';
import { setupRegistrationSchema } from '@shared/schema';

export class AuthController extends BaseController {
    /**
     * Check if the system is set up (has an admin user)
     */
    async getSetupStatus(_req: Request, res: Response) {
        try {
            const userCount = await storage.getUserCount();
            return res.json({
                needsSetup: userCount === 0,
                message: userCount === 0 ? "No users found. Registration required." : "System is configured."
            });
        } catch (error) {
            return this.handleError(error, res, 'AuthController.getSetupStatus');
        }
    }

    /**
     * Register the first admin user
     */
    async registerAdmin(req: Request, res: Response) {
        try {
            const userCount = await storage.getUserCount();

            if (userCount > 0) {
                return res.status(403).json({
                    error: "Registration is disabled. An admin account already exists."
                });
            }

            const { username, email, password } = this.validateBody(setupRegistrationSchema, req.body);

            const existingUser = await storage.getUserByUsername(username);
            if (existingUser) {
                return res.status(400).json({ error: "Username already exists" });
            }

            const hashedPassword = await hashPassword(password);
            const user = await storage.createUser({
                username,
                email,
                password: hashedPassword,
            });

            this.logInfo("SETUP", `Admin account created: ${username}`);

            return res.json({
                success: true,
                message: "Admin account created successfully. Please log in.",
                user: { id: user.id, username: user.username }
            });
        } catch (error) {
            return this.handleError(error, res, 'AuthController.registerAdmin');
        }
    }
}
