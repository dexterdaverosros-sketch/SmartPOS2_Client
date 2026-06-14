import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id, 
      username: insertUser.username || null,
      email: insertUser.email || null,
      mobile: insertUser.mobile || null,
      password: insertUser.password,
      role: insertUser.role,
      staffId: insertUser.staffId || null,
      businessName: insertUser.businessName || null,
      ownerName: insertUser.ownerName || null,
      location: insertUser.location || null,
      profileImage: null,
      securityQuestion1: insertUser.securityQuestion1 || null,
      securityAnswer1: insertUser.securityAnswer1 || null,
      securityQuestion2: insertUser.securityQuestion2 || null,
      securityAnswer2: insertUser.securityAnswer2 || null,
      securityQuestion3: insertUser.securityQuestion3 || null,
      securityAnswer3: insertUser.securityAnswer3 || null,
      failedAttemptCount: 0,
      lockoutUntil: null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
