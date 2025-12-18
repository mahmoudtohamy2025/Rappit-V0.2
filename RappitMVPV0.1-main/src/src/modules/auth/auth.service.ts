import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@common/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string; // userId
  orgId: string; // organizationId
  role: string; // role in that organization
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Register new user and create their organization
   * User becomes ADMIN of the new organization
   */
  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user + organization + membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          settings: {},
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
        },
      });

      // Create membership with ADMIN role
      const membership = await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'ADMIN',
        },
      });

      return { user, organization, membership };
    });

    this.logger.log(
      `New user registered: ${result.user.email} for organization: ${result.organization.name}`,
    );

    // Generate JWT with organization context
    const token = this.generateToken(
      result.user.id,
      result.organization.id,
      'ADMIN',
    );

    return {
      access_token: token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        role: 'ADMIN',
      },
    };
  }

  /**
   * Login user to a specific organization
   * If organizationId not provided, uses the first organization the user belongs to
   */
  async login(dto: LoginDto) {
    // Find user with all their organization memberships
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has any organization memberships
    if (user.memberships.length === 0) {
      throw new UnauthorizedException('User does not belong to any organization');
    }

    // Determine which organization to login to
    let selectedMembership = user.memberships[0];

    if (dto.organizationId) {
      // User specified an organization
      selectedMembership = user.memberships.find(
        (m) => m.organizationId === dto.organizationId,
      );

      if (!selectedMembership) {
        throw new UnauthorizedException(
          'User does not have access to the specified organization',
        );
      }
    }

    // Check if organization is active
    if (!selectedMembership.organization) {
      throw new UnauthorizedException('Organization not found');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT with organization context
    const token = this.generateToken(
      user.id,
      selectedMembership.organizationId,
      selectedMembership.role,
    );

    this.logger.log(
      `User logged in: ${user.email} to organization: ${selectedMembership.organization.name}`,
    );

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: selectedMembership.organization.id,
        name: selectedMembership.organization.name,
        role: selectedMembership.role,
      },
      // Include all organizations the user has access to
      availableOrganizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }

  /**
   * Get current user information with organization context
   */
  async getMe(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Find current organization membership
    const currentMembership = user.memberships.find(
      (m) => m.organizationId === organizationId,
    );

    if (!currentMembership) {
      throw new UnauthorizedException('Access to organization denied');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
      },
      currentOrganization: {
        id: currentMembership.organization.id,
        name: currentMembership.organization.name,
        role: currentMembership.role,
        settings: currentMembership.organization.settings,
      },
      availableOrganizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    };
  }

  /**
   * Generate JWT token with user + organization context
   */
  private generateToken(
    userId: string,
    organizationId: string,
    role: string,
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      orgId: organizationId,
      role: role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate user exists and is active (used by JWT strategy)
   */
  async validateUser(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { organizationId },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('User does not have access to organization');
    }

    const membership = user.memberships[0];

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: membership.organizationId,
      role: membership.role,
    };
  }
}
