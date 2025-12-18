import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all users in an organization
   */
  async findAll(organizationId: string) {
    const memberships = await this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.user,
      role: m.role,
      membershipId: m.id,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Get a specific user in an organization
   */
  async findOne(userId: string, organizationId: string) {
    const membership = await this.prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('User not found in this organization');
    }

    return {
      ...membership.user,
      role: membership.role,
      membershipId: membership.id,
      joinedAt: membership.createdAt,
    };
  }

  /**
   * Invite/Add a new user to an organization
   */
  async create(
    createUserDto: CreateUserDto,
    organizationId: string,
    createdByRole: UserRole,
  ) {
    // Only ADMIN can invite users
    if (createdByRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can invite users');
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    // Check if user is already a member
    if (user) {
      const existingMembership = await this.prisma.userOrganization.findFirst({
        where: {
          userId: user.id,
          organizationId,
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'User is already a member of this organization',
        );
      }
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(
        createUserDto.password || this.generateRandomPassword(),
        10,
      );

      user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          isActive: true,
        },
      });

      this.logger.log(`New user created: ${user.email}`);
    }

    // Create membership
    const membership = await this.prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId,
        role: createUserDto.role || 'OPERATOR',
      },
    });

    this.logger.log(
      `User ${user.email} added to organization ${organizationId} with role ${membership.role}`,
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: membership.role,
      membershipId: membership.id,
    };
  }

  /**
   * Update user's role in an organization
   */
  async updateRole(
    userId: string,
    organizationId: string,
    newRole: UserRole,
    updatedByRole: UserRole,
  ) {
    // Only ADMIN can update roles
    if (updatedByRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update user roles');
    }

    const membership = await this.prisma.userOrganization.findFirst({
      where: { userId, organizationId },
    });

    if (!membership) {
      throw new NotFoundException('User not found in this organization');
    }

    const updated = await this.prisma.userOrganization.update({
      where: { id: membership.id },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `User ${updated.user.email} role updated to ${newRole} in organization ${organizationId}`,
    );

    return {
      ...updated.user,
      role: updated.role,
    };
  }

  /**
   * Remove user from an organization
   */
  async remove(
    userId: string,
    organizationId: string,
    removedByRole: UserRole,
  ) {
    // Only ADMIN can remove users
    if (removedByRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can remove users');
    }

    const membership = await this.prisma.userOrganization.findFirst({
      where: { userId, organizationId },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('User not found in this organization');
    }

    // Prevent removing the last admin
    if (membership.role === 'ADMIN') {
      const adminCount = await this.prisma.userOrganization.count({
        where: { organizationId, role: 'ADMIN' },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last admin from the organization',
        );
      }
    }

    await this.prisma.userOrganization.delete({
      where: { id: membership.id },
    });

    this.logger.log(
      `User ${membership.user.email} removed from organization ${organizationId}`,
    );

    return { message: 'User removed from organization successfully' };
  }

  /**
   * Generate a random password for new users
   */
  private generateRandomPassword(): string {
    return Math.random().toString(36).slice(-12) + 'Aa1!';
  }
}
