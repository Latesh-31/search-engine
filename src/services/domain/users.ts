import { User } from '@prisma/client';

import {
  CreateUserData,
  UpdateUserData,
  UserRepository,
} from '../../repositories/userRepository';

export interface UserService {
  createUser(data: CreateUserData): Promise<User>;
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserData): Promise<User | null>;
  deleteUser(id: string): Promise<User | null>;
}

export const createUserService = (userRepository: UserRepository): UserService => ({
  createUser: (data) => userRepository.createUser(data),
  listUsers: () => userRepository.listUsers(),
  getUser: (id) => userRepository.getUserById(id),
  updateUser: (id, data) => userRepository.updateUser(id, data),
  deleteUser: (id) => userRepository.deleteUser(id),
});
