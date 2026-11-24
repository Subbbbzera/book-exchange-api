import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  role: Role;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
