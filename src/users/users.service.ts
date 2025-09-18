import { Injectable, BadRequestException, NotFoundException, Inject, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddUserPropertyDto } from './dto/add-user-property.dto';
import { IdentifyUserDto } from './dto/identify-user.dto';
import { Prisma } from '@prisma/client';
import * as Papa from 'papaparse';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findAll(workspaceId: string, limit: number, cursor?: string, search?: string) {
    // Build search conditions
    const whereCondition: any = { workspaceId };
    
    if (search?.trim()) {
      const searchTerm = search.trim().toLowerCase();
      whereCondition.OR = [
        // Search in distinctId
        {
          distinctId: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        // Search in properties.name (JSONB search)
        {
          properties: {
            path: ['name'],
            string_contains: searchTerm
          }
        },
        // Search in properties.email (JSONB search)
        {
          properties: {
            path: ['email'],
            string_contains: searchTerm
          }
        }
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereCondition,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'asc', // Or any other deterministic order
      },
      include: {
        events: {
          take: 5, // Include some recent events for filtering
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });

    const nextCursor = users.length === limit ? users[users.length - 1].id : null;

    return {
      users,
      nextCursor,
      totalCount: search ? undefined : await this.getTotalUserCount(workspaceId), // Only count when not searching
    };
  }
  
  private async getTotalUserCount(workspaceId: string): Promise<number> {
    return this.prisma.user.count({
      where: { workspaceId }
    });
  }

  async upsert(createUserDto: CreateUserDto) {
    const { workspaceId, user } = createUserDto;
    const { distinct_id, properties } = user;

    if (distinct_id) {
      // Upsert logic: if distinct_id is provided
      return this.prisma.user.upsert({
        where: { workspaceId_distinctId: { workspaceId, distinctId: distinct_id } },
        update: { properties: properties || {} },
        create: {
          workspaceId,
          distinctId: distinct_id,
          properties: properties || {},
        },
      });
    } else {
      // Create logic: if distinct_id is not provided
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) {
        throw new NotFoundException(`Workspace with ID "${workspaceId}" not found.`);
      }

      return this.prisma.user.create({
        data: {
          properties: properties || {},
          workspace: {
            connect: {
              id: workspaceId,
            },
          },
        } as Prisma.UserCreateInput,
      });
    }
  }

  async findOneById(workspaceId: string, id: string, eventLimit: number, eventNextToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, workspaceId },
      include: {
        events: {
          orderBy: {
            timestamp: 'desc',
          },
          take: eventLimit,
          // Cursor-based pagination would be implemented here using the eventNextToken
        }
      }
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    // Shaping the response to match the desired output
    const { events, ...userData } = user;

    return {
      ...userData,
      events,
      nextEventToken: events.length === eventLimit ? events[events.length - 1].id : null,
    };
  }

  async findOneByDistinctId(workspaceId: string, distinctId: string, eventLimit: number, eventNextToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { workspaceId_distinctId: { workspaceId, distinctId } },
      include: {
        events: {
          orderBy: {
            timestamp: 'desc',
          },
          take: eventLimit,
          // Cursor-based pagination would be implemented here using the eventNextToken
        }
      }
    });

    if (!user) {
      throw new NotFoundException(`User with distinctId "${distinctId}" not found.`);
    }

    // Shaping the response to match the desired output
    const { events, ...userData } = user;

    console.log('[UsersService] Final user object with events:', JSON.stringify({ ...userData, events }, null, 2));

    return {
      ...userData,
      events,
      nextEventToken: events.length === eventLimit ? events[events.length - 1].id : null,
    };
  }

  async bulkUpsertFromJsonl(workspaceId: string, jsonl: string) {
    if (!jsonl || jsonl.trim() === '') {
      throw new BadRequestException('Cannot process an empty or blank file.');
    }

    // Pre-process the string to handle the specific incorrect format
    let cleanJsonl = jsonl;
    if (cleanJsonl.startsWith('"') && cleanJsonl.endsWith('"')) {
      cleanJsonl = cleanJsonl.substring(1, cleanJsonl.length - 1);
    }
    cleanJsonl = cleanJsonl.replace(/\\"/g, '"').replace(/\\n/g, '\n');

    // Regex to find JSON objects, robust against newlines within the object
    const jsonObjects = cleanJsonl.match(/({.*?})/g) || [];

    const parsingResults = jsonObjects.map(objStr => {
      try {
        const parsed = JSON.parse(objStr);
        return { success: true, data: parsed };
      } catch (e) {
        return { success: false, data: objStr }; // JSON parsing error
      }
    });

    const successfulUsers = parsingResults.filter(r => r.success).map(r => r.data);
    const failedLines = parsingResults.filter(r => !r.success).map(r => r.data);

    console.log('--- Bulk User Import Summary ---');
    console.log(`Total potential objects found: ${jsonObjects.length}`);
    console.log(`Successfully parsed users: ${successfulUsers.length}`);
    console.log(`Failed to parse objects: ${failedLines.length}`);
    if (successfulUsers.length > 0) {
      console.log('Sample of successfully parsed users (up to 3):', JSON.stringify(successfulUsers.slice(0, 3), null, 2));
    }
    if (failedLines.length > 0) {
      console.log('Sample of failed lines (up to 3):', failedLines.slice(0, 3));
    }
    console.log('-----------------------------');


    if (successfulUsers.length === 0) {
      throw new BadRequestException('No valid user data found in the provided file.');
    }

    const promises = successfulUsers.map(user => {
      const { distinct_id, properties } = user as { distinct_id?: string, properties: any };
      
      if (distinct_id) {
        return this.prisma.user.upsert({
          where: { workspaceId_distinctId: { workspaceId, distinctId: distinct_id } },
          update: { properties: properties || {} },
          create: {
            workspaceId,
            distinctId: distinct_id,
            properties: properties || {},
          },
        });
      } else {
        return this.prisma.user.create({
          data: {
            workspace: { connect: { id: workspaceId } },
            properties: properties || {},
          },
        });
      }
    });
    
    // This will run in the background
    // We don't await here to avoid blocking the request, but we handle the promise to avoid unhandled rejection errors.
    this.prisma.$transaction(promises).then(result => {
      console.log(`Processed ${result.length} users for workspace ${workspaceId}`);
    }).catch(error => {
      console.error(`Error processing bulk upsert for workspace ${workspaceId}:`, error);
    });
  }

  async bulkUpsertFromCsv(workspaceId: string, csvContent: string) {
    if (!csvContent || csvContent.trim() === '') {
      throw new BadRequestException('Cannot process an empty or blank file.');
    }

    const { data: users, errors } = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors.length > 0) {
      console.warn('CSV parsing errors found:', errors);
    }
    
    if (!users || users.length === 0) {
      throw new BadRequestException('No valid user data found in the provided CSV file.');
    }

    const promises = (users as Record<string, any>[]).map(row => {
      const { distinct_id, ...properties } = row;
      
      if (distinct_id) {
        return this.prisma.user.upsert({
          where: { workspaceId_distinctId: { workspaceId, distinctId: distinct_id } },
          update: { properties },
          create: {
            workspaceId,
            distinctId: distinct_id,
            properties,
          },
        });
      } else {
        return this.prisma.user.create({
          data: {
            workspace: { connect: { id: workspaceId } },
            properties,
          },
        });
      }
    });
    
    this.prisma.$transaction(promises).then(result => {
      console.log(`Processed ${result.length} users from CSV for workspace ${workspaceId}`);
    }).catch(error => {
      console.error(`Error processing bulk upsert from CSV for workspace ${workspaceId}:`, error);
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const mergedProperties = {
      ...((user.properties || {}) as object),
      ...((updateUserDto.properties || {}) as object),
    };

    return this.prisma.user.update({
      where: { id },
      data: {
        properties: mergedProperties,
      },
    });
  }

  async addProperty(id: string, addUserPropertyDto: AddUserPropertyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const currentProperties = (user.properties || {}) as object;
    const { key, value } = addUserPropertyDto;

    if (key in currentProperties) {
      throw new ConflictException(`Property with key "${key}" already exists.`);
    }

    const newProperties = {
      ...currentProperties,
      [key]: value,
    };

    return this.prisma.user.update({
      where: { id },
      data: {
        properties: newProperties,
      },
    });
  }

  async identify(identifyUserDto: IdentifyUserDto) {
    const { workspaceId, newDistinctId, userToIdentify } = identifyUserDto;

    // 1. Check if the newDistinctId is already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { workspaceId_distinctId: { workspaceId, distinctId: newDistinctId } },
    });
    if (existingUser) {
      throw new ConflictException(`Distinct ID "${newDistinctId}" is already in use.`);
    }

    // 2. Find the user to identify
    let userToUpdate;
    if (userToIdentify.id) {
      userToUpdate = await this.prisma.user.findUnique({ where: { id: userToIdentify.id } });
    } else if (userToIdentify.properties?.email) {
      userToUpdate = await this.prisma.user.findFirst({
        where: {
          workspaceId,
          properties: {
            path: ['email'],
            equals: userToIdentify.properties.email,
          },
        },
      });
    }

    if (!userToUpdate) {
      throw new NotFoundException('User to identify not found.');
    }
    
    // 3. Update the user with the new distinctId
    return this.prisma.user.update({
      where: { id: userToUpdate.id },
      data: { distinctId: newDistinctId },
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  // Get unique property keys across all users in workspace for template variables
  async getUniqueProperties(workspaceId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { workspaceId },
      select: { properties: true },
    });

    const propertyKeys = new Set<string>();
    
    // Extract all unique keys from user properties
    users.forEach(user => {
      if (user.properties && typeof user.properties === 'object') {
        Object.keys(user.properties as object).forEach(key => {
          propertyKeys.add(key);
        });
      }
    });

    // Return sorted array of property keys
    return Array.from(propertyKeys).sort();
  }
}
