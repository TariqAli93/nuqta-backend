import { User } from "../entities/User.js";

export interface IUserRepository {
  findByUsername(username: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  create(user: User): Promise<User>;
  findAll(): Promise<User[]>;
  update(id: number, data: Partial<User>): Promise<User>;
  count(): Promise<number>;
  updateLastLogin(id: number): Promise<void>;
}
