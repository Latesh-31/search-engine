import { Prisma, PrismaClient, User } from '@prisma/client';

export interface CreateUserData {
  email: string;
  displayName: string;
}

export interface UpdateUserData {
  email?: string;
  displayName?: string;
}

export interface UserRepository {
  createUser(data: CreateUserData): Promise<User>;
  listUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserData): Promise<User | null>;
  deleteUser(id: string): Promise<User | null>;
}

const handleNotFound = (error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createUserRepository = (prisma: PrismaClient): UserRepository => ({
  async createUser(data) {
    return prisma.user.create({ data });
  },
  async listUsers() {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },
  async updateUser(id, data) {
    try {
      return await prisma.user.update({ where: { id }, data });
    } catch (error) {
      return handleNotFound(error);
    }
  },
  async deleteUser(id) {
    try {
      return await prisma.user.delete({ where: { id } });
    } catch (error) {
      return handleNotFound(error);
    }
  },
});
