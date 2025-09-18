import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async track(trackEventDto: TrackEventDto): Promise<void> {
    const { workspaceId, event } = trackEventDto;
    const { userId, name, timestamp, properties } = event;

    // 1. Validate workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace with ID "${workspaceId}" not found.`);
    }

    // 2. Find or validate user exists by distinct_id
    const user = await this.prisma.user.findUnique({
      where: { 
        workspaceId_distinctId: { 
          workspaceId, 
          distinctId: userId 
        } 
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with distinct_id "${userId}" not found in workspace "${workspaceId}".`
      );
    }

    // 3. Parse timestamp or use current time
    let eventTimestamp: Date;
    if (timestamp) {
      eventTimestamp = new Date(timestamp);
      if (isNaN(eventTimestamp.getTime())) {
        throw new BadRequestException('Invalid timestamp format. Use ISO 8601 format.');
      }
    } else {
      eventTimestamp = new Date();
    }

    // 4. Store event in PostgreSQL
    await this.prisma.event.create({
      data: {
        userId: user.id,
        name,
        timestamp: eventTimestamp,
        properties: properties || {},
      },
    });

    // TODO: In the future, publish to Pub/Sub for async processing
    // For Phase 1 MVP, we store directly to PostgreSQL
  }

  async getUniqueEventNames(workspaceId: string): Promise<string[]> {
    // Get unique event names from all events in the workspace
    const events = await this.prisma.event.findMany({
      where: {
        user: {
          workspaceId: workspaceId,
        },
      },
      select: {
        name: true,
      },
      distinct: ['name'],
      orderBy: {
        name: 'asc',
      },
    });

    return events.map(event => event.name);
  }
}
